// scene.js — PREMIUM FINAL

const Scene3D = (() => {
  let renderer, scene, camera;
  let boardGroup, piecesGroup, highlightGroup;
  let currentBg = 0;
  let pendingAnimations = [];
  let cameraAnimation = null;
  const candleLights = [], candleFlames = [];
  let starsObj = null;

  let lightSqMat, darkSqMat, frameMat, baseMat, edgeMat, legMat;
  let hlMove, hlSel, hlCap, hlChk;

  const SQ = 1.0, OFF = -3.5;

  function _camDist() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const a = w / h;
    // Телефон портрет — доска должна помещаться по ширине
    // Минимальная дистанция чтобы доска (10 units) влезла в FOV=40
    // dist = (boardSize/2) / tan(FOV_half * aspect_correction)
    if (a < 0.50) return 26;   // очень узкий iPhone SE
    if (a < 0.56) return 24;   // iPhone обычный
    if (a < 0.62) return 22;   // iPhone Plus
    if (a < 0.70) return 20;   // широкий телефон
    if (a < 0.85) return 18;   // небольшой планшет портрет
    if (a < 1.10) return 15;   // планшет портрет
    if (a < 1.50) return 14;   // планшет альбом
    return 13;                  // десктоп
  }

  function _setCamPos() {
    const d = _camDist();
    const a = window.innerWidth / window.innerHeight;
    // На телефоне угол выше (смотрим более сверху) чтобы вся доска влезла
    let angleDeg;
    if (a < 0.62)      angleDeg = 65;  // телефон узкий — смотрим почти сверху
    else if (a < 0.75) angleDeg = 62;
    else if (a < 1.0)  angleDeg = 57;
    else               angleDeg = 52;  // планшет/десктоп
    const ang = angleDeg * Math.PI / 180;
    camera.position.set(0, d * Math.sin(ang), d * Math.cos(ang));
    camera.lookAt(0, 0, 0);
  }

  function init(canvas) {
    // Premium materials
    lightSqMat = new THREE.MeshStandardMaterial({ color: 0xd4a96a, roughness: 0.45, metalness: 0.02 });
    darkSqMat  = new THREE.MeshStandardMaterial({ color: 0x5c2e0e, roughness: 0.6,  metalness: 0.02 });
    frameMat   = new THREE.MeshStandardMaterial({ color: 0x2d1206, roughness: 0.5,  metalness: 0.05 });
    baseMat    = new THREE.MeshStandardMaterial({ color: 0x1e0c04, roughness: 0.6,  metalness: 0.05 });
    edgeMat    = new THREE.MeshStandardMaterial({ color: 0xc8960c, roughness: 0.15, metalness: 0.9  });
    legMat     = new THREE.MeshStandardMaterial({ color: 0x180a02, roughness: 0.7,  metalness: 0.08 });
    hlMove = new THREE.MeshStandardMaterial({ color: 0x00e676, transparent: true, opacity: 0.45, depthWrite: false });
    hlSel  = new THREE.MeshStandardMaterial({ color: 0xffd600, transparent: true, opacity: 0.55, depthWrite: false });
    hlCap  = new THREE.MeshStandardMaterial({ color: 0xff1744, transparent: true, opacity: 0.5,  depthWrite: false });
    hlChk  = new THREE.MeshStandardMaterial({ color: 0xff1744, transparent: true, opacity: 0.65, depthWrite: false, emissive: new THREE.Color(0xff1744), emissiveIntensity: 0.5 });

    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.outputEncoding = THREE.sRGBEncoding;

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 100);
    _setCamPos();

    boardGroup     = new THREE.Group();
    piecesGroup    = new THREE.Group();
    highlightGroup = new THREE.Group();
    scene.add(boardGroup, piecesGroup, highlightGroup);

    _buildBoard();
    _buildLighting();
    setBackground(0);
    _startRender();
    window.addEventListener('resize', _onResize);
  }

  function _buildBoard() {
    // Массивное основание
    const base = new THREE.Mesh(new THREE.BoxGeometry(10.8, 0.65, 10.8), baseMat);
    base.position.y = -0.345;
    base.receiveShadow = true; base.castShadow = true;
    boardGroup.add(base);

    // Деревянная рамка
    const frame = new THREE.Mesh(new THREE.BoxGeometry(10.0, 0.10, 10.0), frameMat);
    frame.position.y = -0.005;
    frame.receiveShadow = true;
    boardGroup.add(frame);

    // Золотой кант — тонкий и элегантный
    const kantMat = edgeMat;
    [
      [0, 0.065, -5.02, 10.08, 0.04, 0.10],
      [0, 0.065,  5.02, 10.08, 0.04, 0.10],
      [-5.02, 0.065, 0, 0.10, 0.04, 10.08],
      [ 5.02, 0.065, 0, 0.10, 0.04, 10.08],
    ].forEach(([x,y,z,w,h,d]) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), kantMat);
      m.position.set(x,y,z); boardGroup.add(m);
    });
    // Угловые плашки
    [[-5.02,-5.02],[5.02,-5.02],[-5.02,5.02],[5.02,5.02]].forEach(([x,z]) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.11,0.045,0.11), kantMat);
      m.position.set(x,0.067,z); boardGroup.add(m);
    });

    // Клетки — выступают над рамкой
    const sqGeo = new THREE.BoxGeometry(SQ - 0.003, 0.09, SQ - 0.003);
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const m = new THREE.Mesh(sqGeo, (r+c)%2===0 ? lightSqMat : darkSqMat);
        m.position.set(OFF + c*SQ, 0.085, OFF + r*SQ);
        m.receiveShadow = true;
        m.userData = { isSquare: true, row: r, col: c };
        boardGroup.add(m);
      }
    }

    // Тонкие ножки
    [[-4.3,-4.3],[4.3,-4.3],[-4.3,4.3],[4.3,4.3]].forEach(([x,z]) => {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.22, 0.38, 12), legMat);
      leg.position.set(x, -0.85, z);
      leg.castShadow = true;
      boardGroup.add(leg);
    });
  }

  function _buildLighting() {
    // Мягкий ambient
    scene.add(new THREE.AmbientLight(0xfff0d0, 0.55));

    // Основной свет — мягкие тени
    const main = new THREE.DirectionalLight(0xfffaf0, 1.6);
    main.position.set(3, 16, 8);
    main.castShadow = true;
    main.shadow.mapSize.set(2048, 2048);
    main.shadow.camera.left = main.shadow.camera.bottom = -8;
    main.shadow.camera.right = main.shadow.camera.top   =  8;
    main.shadow.bias   = -0.0005;
    main.shadow.radius = 3; // мягкие тени
    scene.add(main);

    // Мягкий заполняющий свет
    const fill = new THREE.DirectionalLight(0xc0d8ff, 0.25);
    fill.position.set(-8, 8, -6);
    scene.add(fill);

    // Нет bounce — убираем лишние тени снизу
  }

  function _clearEnv() {
    candleLights.length = 0; candleFlames.length = 0; starsObj = null;
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

  function _bgCastle() {
    scene.background = new THREE.Color(0x0c0602);
    scene.fog = new THREE.FogExp2(0x0c0602, 0.038);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(80,80),
      new THREE.MeshStandardMaterial({ color: 0x080401, roughness: 0.98 }));
    floor.rotation.x=-Math.PI/2; floor.position.y=-1.1; floor.receiveShadow=true; floor.userData.env=true;
    scene.add(floor);
    [[-6.5,0,-6.5],[-6.5,0,6.5],[6.5,0,-6.5],[6.5,0,6.5]].forEach(([x,,z],i) => {
      const h = 0.6;
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.045,0.065,h,8),
        new THREE.MeshStandardMaterial({ color: 0xf0e8d0, roughness: 0.85 }));
      body.position.set(x,-1.1+h/2,z); body.userData.env=true; scene.add(body);
      const flame = new THREE.Mesh(new THREE.SphereGeometry(0.065,6,5),
        new THREE.MeshStandardMaterial({ color:0xffa500, emissive:new THREE.Color(0xff6600), emissiveIntensity:3, transparent:true, opacity:0.9 }));
      flame.position.set(x,-1.1+h+0.07,z); flame.userData.env=true; scene.add(flame);
      candleFlames.push(flame);
      const cl = new THREE.PointLight(0xff8820, 0.9, 9);
      cl.position.set(x,-1.1+h+0.1,z); cl.userData.env=true; scene.add(cl);
      candleLights.push({light:cl, ox:x, idx:i});
    });
    const pillarMat = new THREE.MeshStandardMaterial({color:0x160c06,roughness:0.95});
    [[-9.5,0,-9.5],[-9.5,0,9.5],[9.5,0,-9.5],[9.5,0,9.5]].forEach(([x,,z]) => {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.35,0.45,12,12),pillarMat);
      p.position.set(x,4.9,z); p.castShadow=true; p.userData.env=true; scene.add(p);
    });
  }

  function _bgSpace() {
    scene.background = new THREE.Color(0x00000f);
    scene.fog = new THREE.FogExp2(0x00000f, 0.02);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(80,80),
      new THREE.MeshStandardMaterial({color:0x010110,roughness:1.0}));
    floor.rotation.x=-Math.PI/2; floor.position.y=-1.1; floor.userData.env=true; scene.add(floor);
    const n=3500, pos=new Float32Array(n*3);
    for(let i=0;i<n;i++){
      const t=Math.random()*Math.PI*2, p=Math.acos(2*Math.random()-1), r=22+Math.random()*28;
      pos[i*3]=r*Math.sin(p)*Math.cos(t); pos[i*3+1]=r*Math.sin(p)*Math.sin(t); pos[i*3+2]=r*Math.cos(p);
    }
    const sg=new THREE.BufferGeometry(); sg.setAttribute('position',new THREE.BufferAttribute(pos,3));
    starsObj=new THREE.Points(sg,new THREE.PointsMaterial({color:0xffffff,size:0.11,transparent:true,opacity:0.9}));
    starsObj.userData.env=true; scene.add(starsObj);
  }

  function _bgMinimal() {
    scene.background = new THREE.Color(0x070707);
    scene.fog = new THREE.Fog(0x070707,14,36);
    const f=new THREE.Mesh(new THREE.PlaneGeometry(80,80),
      new THREE.MeshStandardMaterial({color:0x080808,roughness:0.08,metalness:0.75}));
    f.rotation.x=-Math.PI/2; f.position.y=-1.1; f.receiveShadow=true; f.userData.env=true; scene.add(f);
    const grid=new THREE.GridHelper(28,28,0x181818,0x101010);
    grid.position.y=-1.09; grid.userData.env=true; scene.add(grid);
  }

  function squareToWorld(file,rank){ return {x:OFF+file*SQ, z:OFF+(7-rank)*SQ}; }

  function placePiece(type,color,file,rank){
    const piece=PieceFactory.createPiece(type,color);
    if(!piece) return null;
    const p=squareToWorld(file,rank);
    piece.position.set(p.x,0.13,p.z);
    piece.userData.file=file; piece.userData.rank=rank;
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
    return delta=>{
      t=Math.min(t+delta/0.28,1);
      const e=t<0.5?2*t*t:-1+(4-2*t)*t;
      piece.position.x=sx+(target.x-sx)*e;
      piece.position.z=sz+(target.z-sz)*e;
      piece.position.y=0.13+Math.sin(t*Math.PI)*1.2;
      if(t>=1){piece.position.y=0.13;piece.userData.file=toFile;piece.userData.rank=toRank;if(onComplete)onComplete();return true;}
      return false;
    };
  }

  function clearHighlights(){ while(highlightGroup.children.length) highlightGroup.remove(highlightGroup.children[0]); }

  function highlightSquare(file,rank,type='move'){
    const mats={move:hlMove,select:hlSel,capture:hlCap,check:hlChk};
    const pos=squareToWorld(file,rank); const mat=mats[type]||hlMove;
    const sq=new THREE.Mesh(new THREE.PlaneGeometry(0.93,0.93),mat);
    sq.rotation.x=-Math.PI/2; sq.position.set(pos.x,0.14,pos.z); highlightGroup.add(sq);
    if(type==='move'){
      const dot=new THREE.Mesh(new THREE.CircleGeometry(0.16,16),mat);
      dot.rotation.x=-Math.PI/2; dot.position.set(pos.x,0.145,pos.z); highlightGroup.add(dot);
    }
  }

  const raycaster=new THREE.Raycaster(); const _mouse=new THREE.Vector2();
  function getClickedSquare(cx,cy){
    const canvas=renderer.domElement; const rect=canvas.getBoundingClientRect();
    _mouse.x=((cx-rect.left)/rect.width)*2-1;
    _mouse.y=-((cy-rect.top)/rect.height)*2+1;
    raycaster.setFromCamera(_mouse,camera);
    const hits=raycaster.intersectObjects(boardGroup.children.filter(c=>c.userData.isSquare));
    if(hits.length){const d=hits[0].object.userData;return{file:d.col,rank:7-d.row};}
    const ph=raycaster.intersectObjects(piecesGroup.children,true);
    if(ph.length){let o=ph[0].object;while(o.parent&&!o.userData.isChessPiece)o=o.parent;if(o.userData.isChessPiece)return{file:o.userData.file,rank:o.userData.rank};}
    return null;
  }

  function _getAngle(){
    const a=window.innerWidth/window.innerHeight;
    return (a<0.62?65:a<0.75?62:a<1.0?57:52)*Math.PI/180;
  }
  function rotateCameraToWhite(){const d=_camDist(),ang=_getAngle();_animCam(0,d*Math.sin(ang),d*Math.cos(ang));}
  function rotateCameraToBlack(){const d=_camDist(),ang=_getAngle();_animCam(0,d*Math.sin(ang),-d*Math.cos(ang));}
  function flipCamera(){if(camera.position.z>0)rotateCameraToBlack();else rotateCameraToWhite();}
  function _animCam(tx,ty,tz){
    const sx=camera.position.x,sy=camera.position.y,sz=camera.position.z;let t=0;
    cameraAnimation=delta=>{t=Math.min(t+delta/0.65,1);const e=t<0.5?4*t*t*t:(t-1)*(2*t-2)*(2*t-2)+1;
      camera.position.set(sx+(tx-sx)*e,sy+(ty-sy)*e,sz+(tz-sz)*e);camera.lookAt(0,0,0);return t>=1;};
  }
  function addAnimation(fn){if(fn)pendingAnimations.push(fn);}

  let clock=0,lastT=0;
  function _startRender(){
    lastT=performance.now();
    const loop=()=>{
      requestAnimationFrame(loop);
      const now=performance.now(); const dt=Math.min((now-lastT)/1000,0.05);
      lastT=now; clock+=dt;
      if(cameraAnimation){if(cameraAnimation(dt))cameraAnimation=null;}
      if(pendingAnimations.length) pendingAnimations=pendingAnimations.filter(fn=>!fn(dt));
      for(let i=0;i<candleLights.length;i++){
        const{light,ox,idx}=candleLights[i];
        light.intensity=0.8+Math.sin(clock*3.8+ox)*0.2+Math.sin(clock*7+idx)*0.08;
      }
      for(let i=0;i<candleFlames.length;i++){
        const f=candleFlames[i];
        f.position.y+=Math.sin(clock*9+i*1.3)*0.0025;
        f.scale.x=1+Math.sin(clock*7+i)*0.1;
      }
      if(starsObj) starsObj.rotation.y+=0.00005;
      renderer.render(scene,camera);
    };
    loop();
  }

  function _onResize(){
    const w=window.innerWidth,h=window.innerHeight;
    camera.aspect=w/h; camera.updateProjectionMatrix();
    renderer.setSize(w,h); _setCamPos();
  }

  // Dynamic board recolor
  function setBoardColors(light, dark) {
    if (lightSqMat) lightSqMat.color.setHex(light);
    if (darkSqMat)  darkSqMat.color.setHex(dark);
  }

  return {
    init,placePiece,removePiece,clearPieces,getPieceAt,
    animatePiece,clearHighlights,highlightSquare,
    squareToWorld,getClickedSquare,
    flipCamera,rotateCameraToWhite,rotateCameraToBlack,
    setBackground,cycleBackground,addAnimation,setBoardColors,
    get scene(){return scene;},get camera(){return camera;}
  };
})();
