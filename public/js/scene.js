// scene.js — PREMIUM FINAL: stunning visuals

const Scene3D = (() => {
  let renderer, scene, camera;
  let boardGroup, piecesGroup, highlightGroup;
  let currentBg = 0;
  let pendingAnims = [];
  let camAnim = null;
  const envLights = { candles:[], flames:[], stars:null };

  // Materials — created in init()
  let matLightSq, matDarkSq, matFrame, matBase, matEdge, matLeg;
  let matHlMove, matHlSel, matHlCap, matHlChk;

  const SQ = 1.0, OFF = -3.5;

  // ── Adaptive camera ───────────────────────────────────────────────────
  function _camSetup() {
    const a = window.innerWidth / window.innerHeight;
    const dist  = a < 0.50 ? 25 : a < 0.60 ? 22 : a < 0.70 ? 20 : a < 0.85 ? 18 : a < 1.10 ? 15 : a < 1.50 ? 14 : 13;
    const angle = a < 0.60 ? 64 : a < 0.75 ? 60 : a < 1.00 ? 56 : 52;
    const rad   = angle * Math.PI / 180;
    camera.position.set(0, dist * Math.sin(rad), dist * Math.cos(rad));
    camera.lookAt(0, 0, 0);
  }

  // ── Init ──────────────────────────────────────────────────────────────
  function init(canvas) {
    // Premium board materials
    matLightSq = new THREE.MeshStandardMaterial({ color:0xc8955a, roughness:0.42, metalness:0.02 });
    matDarkSq  = new THREE.MeshStandardMaterial({ color:0x2c0e04, roughness:0.58, metalness:0.02 });
    matFrame   = new THREE.MeshStandardMaterial({ color:0x1e0c04, roughness:0.50, metalness:0.08 });
    matBase    = new THREE.MeshStandardMaterial({ color:0x120802, roughness:0.65, metalness:0.05 });
    matEdge    = new THREE.MeshStandardMaterial({ color:0xd4a012, roughness:0.12, metalness:0.95 });
    matLeg     = new THREE.MeshStandardMaterial({ color:0x0e0602, roughness:0.75, metalness:0.08 });

    // Highlight materials
    matHlMove = new THREE.MeshBasicMaterial({ color:0x00e676, transparent:true, opacity:0.40, depthWrite:false });
    matHlSel  = new THREE.MeshBasicMaterial({ color:0xffd600, transparent:true, opacity:0.50, depthWrite:false });
    matHlCap  = new THREE.MeshBasicMaterial({ color:0xff1744, transparent:true, opacity:0.45, depthWrite:false });
    matHlChk  = new THREE.MeshBasicMaterial({ color:0xff1744, transparent:true, opacity:0.60, depthWrite:false });

    // Renderer
    renderer = new THREE.WebGLRenderer({ canvas, antialias:true, powerPreference:'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2.5));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = false; // тени отключены — чище выглядит
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.outputEncoding = THREE.sRGBEncoding;

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(40, window.innerWidth/window.innerHeight, 0.1, 120);
    _camSetup();

    boardGroup     = new THREE.Group();
    piecesGroup    = new THREE.Group();
    highlightGroup = new THREE.Group();
    scene.add(boardGroup, piecesGroup, highlightGroup);

    _buildBoard();
    _buildLighting();
    setBackground(0);
    _render();
    window.addEventListener('resize', _onResize);
  }

  // ── PREMIUM BOARD ─────────────────────────────────────────────────────
  function _buildBoard() {
    // Thick base with beveled edges
    const base = new THREE.Mesh(new THREE.BoxGeometry(12.2, 0.70, 12.2), matBase);
    base.position.y = -0.37; base.receiveShadow = false;
    boardGroup.add(base);

    // Wood frame — slightly raised
    const frame = new THREE.Mesh(new THREE.BoxGeometry(11.4, 0.12, 11.4), matFrame);
    frame.position.y = 0.00; frame.receiveShadow = false;
    boardGroup.add(frame);

    // Gold inlay border — 4 strips
    const kantH = 0.06;
    [
      [0, 0.07, -5.72, 11.48, kantH, 0.09],
      [0, 0.07,  5.72, 11.48, kantH, 0.09],
      [-5.72, 0.07, 0, 0.09, kantH, 11.48],
      [ 5.72, 0.07, 0, 0.09, kantH, 11.48],
    ].forEach(([x,y,z,w,h,d]) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), matEdge);
      m.position.set(x,y,z); boardGroup.add(m);
    });

    // Inner border — thin gold line inside frame
    [
      [0, 0.067, -4.12, 8.28, 0.04, 0.06],
      [0, 0.067,  4.12, 8.28, 0.04, 0.06],
      [-4.12, 0.067, 0, 0.06, 0.04, 8.28],
      [ 4.12, 0.067, 0, 0.06, 0.04, 8.28],
    ].forEach(([x,y,z,w,h,d]) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), matEdge);
      m.position.set(x,y,z); boardGroup.add(m);
    });

    // Squares — perfectly flush, slight variation in roughness
    const sqGeo = new THREE.BoxGeometry(SQ-0.003, 0.09, SQ-0.003);
    for (let r=0; r<8; r++) {
      for (let c=0; c<8; c++) {
        const isLight = (r+c)%2 === 0;
        const mat = isLight ? matLightSq : matDarkSq;
        const mesh = new THREE.Mesh(sqGeo, mat);
        mesh.position.set(OFF+c*SQ, 0.085, OFF+r*SQ);
        mesh.receiveShadow = false;
        mesh.userData = { isSquare:true, row:r, col:c };
        boardGroup.add(mesh);
      }
    }

    // ── КООРДИНАТЫ НА ДОСКЕ (как на настоящих шахматах) ──────────────────
    const files = ['a','b','c','d','e','f','g','h'];
    const ranks = ['1','2','3','4','5','6','7','8'];
    const labelCanvas = document.createElement('canvas');
    labelCanvas.width = 64; labelCanvas.height = 64;
    const ctx = labelCanvas.getContext('2d');

    function makeLabel(text, isLight) {
      ctx.clearRect(0,0,64,64);
      ctx.fillStyle = isLight ? '#5c2e0e' : '#c8955a';
      ctx.font = 'bold 36px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 32, 34);
      const tex = new THREE.CanvasTexture(labelCanvas);
      tex.needsUpdate = true;
      return tex.clone();
    }

    const labelMat = (text, isLight) => new THREE.MeshBasicMaterial({
      map: makeLabel(text, isLight),
      transparent: true, depthWrite: false, side: THREE.DoubleSide
    });

    const LBL_SIZE = 0.72;
    const LBL_Y   = 0.135;
    const MARGIN  = 0.50; // отступ от края клеток

    // Буквы a-h — снизу и сверху
    for (let c = 0; c < 8; c++) {
      const isLight = c % 2 === 0;
      const x = OFF + c * SQ;

      // Снизу (rank 0 side)
      const geoB = new THREE.PlaneGeometry(LBL_SIZE, LBL_SIZE);
      const mB = new THREE.Mesh(geoB, labelMat(files[c], isLight));
      mB.rotation.x = -Math.PI/2;
      mB.position.set(x, LBL_Y, OFF - MARGIN);
      boardGroup.add(mB);

      // Сверху (rank 7 side)
      const geoT = new THREE.PlaneGeometry(LBL_SIZE, LBL_SIZE);
      const mT = new THREE.Mesh(geoT, labelMat(files[c], !isLight));
      mT.rotation.x = -Math.PI/2;
      mT.rotation.z = Math.PI; // перевёрнуто
      mT.position.set(x, LBL_Y, OFF + 8*SQ - 1 + MARGIN);
      boardGroup.add(mT);
    }

    // Цифры 1-8 — слева и справа
    for (let r = 0; r < 8; r++) {
      const isLight = r % 2 === 1;
      const z = OFF + r * SQ;

      // Слева (file a side)
      const geoL = new THREE.PlaneGeometry(LBL_SIZE, LBL_SIZE);
      const mL = new THREE.Mesh(geoL, labelMat(ranks[r], isLight));
      mL.rotation.x = -Math.PI/2;
      mL.position.set(OFF - MARGIN, LBL_Y, z);
      boardGroup.add(mL);

      // Справа (file h side)
      const geoR = new THREE.PlaneGeometry(LBL_SIZE, LBL_SIZE);
      const mR = new THREE.Mesh(geoR, labelMat(ranks[r], !isLight));
      mR.rotation.x = -Math.PI/2;
      mR.rotation.z = Math.PI; // перевёрнуто
      mR.position.set(OFF + 8*SQ - 1 + MARGIN, LBL_Y, z);
      boardGroup.add(mR);
    }

    // Elegant turned legs
    const legGeo = _buildLegGeo();
    [[-4.2,-4.2],[4.2,-4.2],[-4.2,4.2],[4.2,4.2]].forEach(([x,z]) => {
      const leg = new THREE.Mesh(legGeo, matLeg);
      leg.position.set(x, -0.88, z);
      boardGroup.add(leg);
    });

    // Coordinate labels A-H and 1-8
    _buildCoords();
  }

  function _makeLabel(text) {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 128;
    const ctx = c.getContext('2d');
    ctx.clearRect(0,0,128,128);
    ctx.fillStyle = 'rgba(212,160,80,0.9)';
    ctx.font = 'bold 56px Georgia,serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 64, 66);
    const tex = new THREE.CanvasTexture(c);
    const mat = new THREE.MeshBasicMaterial({ map:tex, transparent:true, depthWrite:false, side:THREE.DoubleSide });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.58, 0.58), mat);
    mesh.rotation.x = -Math.PI / 2;
    return mesh;
  }

  function _buildCoords() {
    const FILES = ['A','B','C','D','E','F','G','H'];
    const Y = 0.10;

    FILES.forEach((letter, i) => {
      const x = OFF + i * SQ;
      // Bottom row
      const lb = _makeLabel(letter);
      lb.position.set(x, Y, OFF - 0.68);
      boardGroup.add(lb);
      // Top row
      const lt = _makeLabel(letter);
      lt.position.set(x, Y, OFF + 8*SQ + 0.08);
      boardGroup.add(lt);
    });

    for (let r = 0; r < 8; r++) {
      const z = OFF + (7 - r) * SQ;
      const num = String(r + 1);
      // Left
      const ll = _makeLabel(num);
      ll.position.set(OFF - 0.68, Y, z);
      boardGroup.add(ll);
      // Right
      const lr = _makeLabel(num);
      lr.position.set(OFF + 8*SQ + 0.08, Y, z);
      boardGroup.add(lr);
    }
  }

  function _buildLegGeo() {
    // Lathe for turned wood leg
    const pts = [
      [0,0],[.18,0],[.22,.03],[.18,.06],[.14,.12],
      [.16,.20],[.18,.24],[.16,.28],[.12,.30],
      [.14,.34],[.18,.38],[.16,.42],[.10,.44],
      [.10,.46]
    ];
    return new THREE.LatheGeometry(pts.map(([x,y]) => new THREE.Vector2(x,y)), 14);
  }

  // ── PREMIUM LIGHTING ──────────────────────────────────────────────────
  function _buildLighting() {
    // Warm ambient — like firelight
    scene.add(new THREE.AmbientLight(0xfff0d8, 0.45));

    // Key light — sharp, dramatic
    const key = new THREE.DirectionalLight(0xfff8f0, 2.0);
    key.position.set(4, 16, 8);

    scene.add(key);

    // Fill light — cool, from opposite side
    const fill = new THREE.DirectionalLight(0xc8d8ff, 0.22);
    fill.position.set(-8, 6, -5);
    scene.add(fill);

    // Top light — subtle overhead
    const top = new THREE.DirectionalLight(0xfffff0, 0.18);
    top.position.set(0, 20, 0);
    scene.add(top);
  }

  // ── BACKGROUNDS ───────────────────────────────────────────────────────
  function _clearEnv() {
    envLights.candles.length = 0;
    envLights.flames.length  = 0;
    envLights.stars          = null;
    const rem = [];
    scene.traverse(o => { if (o.userData.env) rem.push(o); });
    rem.forEach(o => {
      scene.remove(o);
      if (o.geometry) o.geometry.dispose();
      if (o.material) [].concat(o.material).forEach(m => m.dispose());
    });
  }

  function setBackground(idx) {
    currentBg = idx % 3; _clearEnv();
    [_bgCastle, _bgSpace, _bgMinimal][currentBg]();
  }
  function cycleBackground() { setBackground((currentBg+1)%3); return currentBg; }

  // CASTLE — dramatic stone hall with candles
  function _bgCastle() {
    scene.background = new THREE.Color(0x080402);
    scene.fog = new THREE.FogExp2(0x080402, 0.032);

    // Stone floor with subtle pattern
    const floorMat = new THREE.MeshStandardMaterial({ color:0x0a0704, roughness:0.98, metalness:0.01 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(80,80), floorMat);
    floor.rotation.x=-Math.PI/2; floor.position.y=-1.1;  floor.userData.env=true;
    scene.add(floor);

    // Candelabras
    const candlePos = [[-7,0,-6],[-7,0,6],[7,0,-6],[7,0,6],[-10,0,0],[10,0,0]];
    candlePos.forEach(([x,,z],i) => {
      const h = 0.65 + Math.random()*0.2;

      // Stand
      const stand = new THREE.Mesh(new THREE.CylinderGeometry(.04,.07,h,8),
        new THREE.MeshStandardMaterial({ color:0xe8dcc0, roughness:0.85 }));
      stand.position.set(x,-1.1+h/2,z); stand.userData.env=true; scene.add(stand);

      // Flame glow sphere
      const flameMat = new THREE.MeshStandardMaterial({
        color:0xff9500, emissive:new THREE.Color(0xff6600),
        emissiveIntensity:3.0, transparent:true, opacity:0.92
      });
      const flame = new THREE.Mesh(new THREE.SphereGeometry(.065,8,6), flameMat);
      flame.position.set(x,-1.1+h+.07,z); flame.userData.env=true;
      scene.add(flame);
      envLights.flames.push({ mesh:flame, baseY:flame.position.y, idx:i });

      // Point light
      const cl = new THREE.PointLight(0xff8820, 1.1, 11);
      cl.position.set(x,-1.1+h+.10,z); cl.userData.env=true; scene.add(cl);
      envLights.candles.push({ light:cl, ox:x, idx:i, base:1.1 });
    });

    // Stone pillars
    const pillarMat = new THREE.MeshStandardMaterial({ color:0x14100a, roughness:0.95 });
    [[-10,0,-10],[-10,0,10],[10,0,-10],[10,0,10]].forEach(([x,,z]) => {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(.42,.52,13,14), pillarMat);
      p.position.set(x,5.4,z);  p.userData.env=true; scene.add(p);
      // Capital
      const cap = new THREE.Mesh(new THREE.BoxGeometry(1.2,.3,1.2), pillarMat);
      cap.position.set(x,12,z); cap.userData.env=true; scene.add(cap);
    });

    // Ceiling arches (implied by fog)
    // Window light from above
    const windowLight = new THREE.SpotLight(0x8090ff, 0.8, 25, 0.3, 0.5);
    windowLight.position.set(-8, 14, -8);
    windowLight.target.position.set(0,0,0);
    windowLight.userData.env=true; scene.add(windowLight); scene.add(windowLight.target);
  }

  // SPACE — deep cosmos with nebula
  function _bgSpace() {
    scene.background = new THREE.Color(0x010108);
    scene.fog = new THREE.FogExp2(0x010108, 0.018);

    // Void floor
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(80,80),
      new THREE.MeshStandardMaterial({ color:0x020210, roughness:1.0 }));
    floor.rotation.x=-Math.PI/2; floor.position.y=-1.1; floor.userData.env=true; scene.add(floor);

    // Dense starfield — two layers
    [4000, 1500].forEach((count, li) => {
      const pos = new Float32Array(count*3);
      const sizes = new Float32Array(count);
      for (let i=0; i<count; i++) {
        const t=Math.random()*Math.PI*2, p=Math.acos(2*Math.random()-1), r=20+li*10+Math.random()*25;
        pos[i*3]=r*Math.sin(p)*Math.cos(t); pos[i*3+1]=r*Math.sin(p)*Math.sin(t); pos[i*3+2]=r*Math.cos(p);
        sizes[i]=li===0?.5+Math.random():.3;
      }
      const sg=new THREE.BufferGeometry();
      sg.setAttribute('position',new THREE.BufferAttribute(pos,3));
      const sm=new THREE.PointsMaterial({
        color: li===0 ? 0xffffff : 0xaaddff,
        size: li===0 ? 0.10 : 0.18,
        transparent:true, opacity: li===0 ? 0.88 : 0.5
      });
      const stars=new THREE.Points(sg,sm);
      stars.userData.env=true;
      if (li===0) envLights.stars=stars;
      scene.add(stars);
    });

    // Nebula — coloured fog planes
    const nebulaCols = [0x5533aa, 0x223388, 0xaa2266, 0x114488];
    nebulaCols.forEach((col,i) => {
      const geo=new THREE.PlaneGeometry(55,55);
      const mat=new THREE.MeshBasicMaterial({ color:col, transparent:true, opacity:.035, side:THREE.DoubleSide, depthWrite:false });
      const p=new THREE.Mesh(geo,mat);
      p.rotation.set(Math.random()*Math.PI, i*0.8+0.3, Math.random()*0.5);
      p.userData.env=true; scene.add(p);
    });

    // Planet in distance
    const planet=new THREE.Mesh(
      new THREE.SphereGeometry(3,24,18),
      new THREE.MeshStandardMaterial({ color:0x2244aa, roughness:0.9, metalness:0.1, emissive:new THREE.Color(0x112244), emissiveIntensity:.3 })
    );
    planet.position.set(22,8,-30); planet.userData.env=true; scene.add(planet);

    // Planet glow
    const glow=new THREE.Mesh(new THREE.SphereGeometry(3.8,16,12),
      new THREE.MeshBasicMaterial({ color:0x1133aa, transparent:true, opacity:.08, side:THREE.BackSide }));
    glow.position.copy(planet.position); glow.userData.env=true; scene.add(glow);
  }

  // MINIMAL — ultra-clean black with reflective floor
  function _bgMinimal() {
    scene.background = new THREE.Color(0x060606);
    scene.fog = new THREE.Fog(0x060606, 14, 40);

    const floor=new THREE.Mesh(new THREE.PlaneGeometry(80,80),
      new THREE.MeshStandardMaterial({ color:0x080808, roughness:0.05, metalness:0.85 }));
    floor.rotation.x=-Math.PI/2; floor.position.y=-1.1;
     floor.userData.env=true; scene.add(floor);

    // Subtle light strips
    const stripMat=new THREE.MeshBasicMaterial({ color:0xc9a84c, transparent:true, opacity:.06 });
    [-1,1].forEach(side => {
      const strip=new THREE.Mesh(new THREE.PlaneGeometry(.02,20), stripMat);
      strip.rotation.x=-Math.PI/2; strip.position.set(side*6,-1.09,0);
      strip.userData.env=true; scene.add(strip);
    });
  }

  // ── Board color change ────────────────────────────────────────────────
  function setBoardColors(light, dark) {
    if (matLightSq) matLightSq.color.setHex(light);
    if (matDarkSq)  matDarkSq.color.setHex(dark);
  }

  // ── Pieces ────────────────────────────────────────────────────────────
  function squareToWorld(file,rank){ return {x:OFF+file*SQ, z:OFF+(7-rank)*SQ}; }

  function placePiece(type,color,file,rank){
    const piece=PieceFactory.createPiece(type,color);
    if(!piece) return null;
    const p=squareToWorld(file,rank);
    piece.position.set(p.x, 0.13, p.z);
    piece.userData.file=file; piece.userData.rank=rank;
    // No shadows on pieces
    piece.traverse(c=>{ c.castShadow=false; c.receiveShadow=false; });
    piecesGroup.add(piece); return piece;
  }
  function removePiece(file,rank){
    piecesGroup.children.filter(p=>p.userData.file===file&&p.userData.rank===rank)
      .forEach(p=>{piecesGroup.remove(p);p.traverse(c=>{if(c.geometry)c.geometry.dispose();});});
  }
  function clearPieces(){
    while(piecesGroup.children.length){
      const p=piecesGroup.children[0]; piecesGroup.remove(p);
      p.traverse(c=>{if(c.geometry)c.geometry.dispose();});
    }
  }
  function getPieceAt(file,rank){ return piecesGroup.children.find(p=>p.userData.file===file&&p.userData.rank===rank); }

  function animatePiece(file,rank,toFile,toRank,onComplete){
    const piece=getPieceAt(file,rank);
    if(!piece){if(onComplete)onComplete();return null;}
    const target=squareToWorld(toFile,toRank);
    const sx=piece.position.x, sz=piece.position.z; let t=0;
    return dt=>{
      t=Math.min(t+dt/0.30,1);
      const e=t<0.5?2*t*t:-1+(4-2*t)*t;
      piece.position.x=sx+(target.x-sx)*e;
      piece.position.z=sz+(target.z-sz)*e;
      piece.position.y=0.13+Math.sin(t*Math.PI)*1.1;
      if(t>=1){piece.position.y=0.13;piece.userData.file=toFile;piece.userData.rank=toRank;if(onComplete)onComplete();return true;}
      return false;
    };
  }

  // ── Highlights ────────────────────────────────────────────────────────
  function clearHighlights(){ while(highlightGroup.children.length) highlightGroup.remove(highlightGroup.children[0]); }

  function highlightSquare(file,rank,type='move'){
    const mats={move:matHlMove,select:matHlSel,capture:matHlCap,check:matHlChk};
    const pos=squareToWorld(file,rank); const mat=mats[type]||matHlMove;
    const sq=new THREE.Mesh(new THREE.PlaneGeometry(0.94,0.94),mat);
    sq.rotation.x=-Math.PI/2; sq.position.set(pos.x,0.14,pos.z); highlightGroup.add(sq);
    if(type==='move'){
      const ring=new THREE.Mesh(new THREE.RingGeometry(0.12,0.18,20), mat);
      ring.rotation.x=-Math.PI/2; ring.position.set(pos.x,0.145,pos.z); highlightGroup.add(ring);
    }
  }

  // ── Raycasting ────────────────────────────────────────────────────────
  const ray=new THREE.Raycaster(); const mp=new THREE.Vector2();

  function getClickedSquare(cx,cy){
    const rect=renderer.domElement.getBoundingClientRect();
    mp.x=((cx-rect.left)/rect.width)*2-1;
    mp.y=-((cy-rect.top)/rect.height)*2+1;
    ray.setFromCamera(mp,camera);
    const hits=ray.intersectObjects(boardGroup.children.filter(c=>c.userData.isSquare));
    if(hits.length){const d=hits[0].object.userData;return{file:d.col,rank:7-d.row};}
    const ph=ray.intersectObjects(piecesGroup.children,true);
    if(ph.length){let o=ph[0].object;while(o.parent&&!o.userData.isChessPiece)o=o.parent;if(o.userData.isChessPiece)return{file:o.userData.file,rank:o.userData.rank};}
    return null;
  }

  // ── Camera ────────────────────────────────────────────────────────────
  function _getAngle(){ const a=window.innerWidth/window.innerHeight; return (a<0.60?64:a<0.75?60:a<1.00?56:52)*Math.PI/180; }
  function _getDist() { const a=window.innerWidth/window.innerHeight; return a<0.50?25:a<0.60?22:a<0.70?20:a<0.85?18:a<1.10?15:a<1.50?14:13; }

  function rotateCameraToWhite(){ const d=_getDist(),ang=_getAngle(); _animCam(0,d*Math.sin(ang),d*Math.cos(ang)); }
  function rotateCameraToBlack(){ const d=_getDist(),ang=_getAngle(); _animCam(0,d*Math.sin(ang),-d*Math.cos(ang)); }
  function flipCamera(){ if(camera.position.z>0)rotateCameraToBlack();else rotateCameraToWhite(); }

  function _animCam(tx,ty,tz){
    const sx=camera.position.x,sy=camera.position.y,sz=camera.position.z;let t=0;
    camAnim=dt=>{t=Math.min(t+dt/0.7,1);const e=t<0.5?4*t*t*t:(t-1)*(2*t-2)*(2*t-2)+1;
      camera.position.set(sx+(tx-sx)*e,sy+(ty-sy)*e,sz+(tz-sz)*e);camera.lookAt(0,0,0);return t>=1;};
  }
  function addAnimation(fn){ if(fn) pendingAnims.push(fn); }

  // ── Render loop ───────────────────────────────────────────────────────
  let clock=0, lastT=0;

  function _render(){
    lastT=performance.now();
    const loop=()=>{
      requestAnimationFrame(loop);
      const now=performance.now(); const dt=Math.min((now-lastT)/1000,.05);
      lastT=now; clock+=dt;

      if(camAnim){if(camAnim(dt))camAnim=null;}
      if(pendingAnims.length) pendingAnims=pendingAnims.filter(fn=>!fn(dt));

      // Candle animation — cached, no traverse
      envLights.candles.forEach(({light,ox,idx})=>{
        light.intensity=0.85+Math.sin(clock*3.7+ox)*0.22+Math.sin(clock*7.1+idx)*0.10;
      });
      envLights.flames.forEach(({mesh,baseY,idx})=>{
        mesh.position.y=baseY+Math.sin(clock*9+idx*1.4)*0.004;
        mesh.scale.x=1+Math.sin(clock*6.5+idx)*0.10;
        mesh.scale.z=1+Math.sin(clock*5.8+idx*0.7)*0.08;
      });
      if(envLights.stars) envLights.stars.rotation.y+=0.00004;

      renderer.render(scene,camera);
    };
    loop();
  }

  function _onResize(){
    const w=window.innerWidth,h=window.innerHeight;
    camera.aspect=w/h; camera.updateProjectionMatrix();
    renderer.setSize(w,h); _camSetup();
  }

  return {
    init, placePiece, removePiece, clearPieces, getPieceAt,
    animatePiece, clearHighlights, highlightSquare,
    squareToWorld, getClickedSquare,
    flipCamera, rotateCameraToWhite, rotateCameraToBlack,
    setBackground, cycleBackground, addAnimation, setBoardColors,
    get scene(){ return scene; }, get camera(){ return camera; }
  };
})();
