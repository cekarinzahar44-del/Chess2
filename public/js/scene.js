// scene.js — FINAL: фиксированная камера, адаптив, крупные фигуры

const Scene3D = (() => {
  let renderer, scene, camera;
  let boardGroup, piecesGroup, highlightGroup;
  let currentBg = 0;
  let pendingAnimations = [];
  let cameraAnimation = null;

  // Материалы — создаются в init() после загрузки THREE
  let lightSqMat, darkSqMat, frameMat, baseMat, edgeMat, legMat;
  let hlMove, hlSel, hlCap, hlChk;

  const SQ = 1.0;
  const OFF = -3.5;

  // ── Вычисляем дистанцию камеры под размер экрана ──────────────────────
  function _getCamDistance() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const aspect = w / h;
    // На узких экранах (телефон портрет) отодвигаем дальше
    if (aspect < 0.6)  return 19;   // очень узкий
    if (aspect < 0.75) return 17;   // телефон портрет
    if (aspect < 1.0)  return 15;   // телефон чуть шире
    if (aspect < 1.4)  return 14;   // планшет портрет
    return 13;                        // планшет/десктоп альбом
  }

  function _setCameraFixed() {
    const dist = _getCamDistance();
    // Угол 52° от горизонта — видна вся доска, не слишком сбоку
    const angleRad = 52 * Math.PI / 180;
    camera.position.set(0, dist * Math.sin(angleRad), dist * Math.cos(angleRad));
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }

  // ── Init ──────────────────────────────────────────────────────────────
  function init(canvas) {
    // Материалы
    lightSqMat = new THREE.MeshStandardMaterial({ color: 0xe8c99a, roughness: 0.5,  metalness: 0.0 });
    darkSqMat  = new THREE.MeshStandardMaterial({ color: 0x4a1e08, roughness: 0.65, metalness: 0.0 });
    frameMat   = new THREE.MeshStandardMaterial({ color: 0x3b1a08, roughness: 0.45, metalness: 0.05 });
    baseMat    = new THREE.MeshStandardMaterial({ color: 0x2a1205, roughness: 0.55, metalness: 0.05 });
    edgeMat    = new THREE.MeshStandardMaterial({ color: 0xb8860b, roughness: 0.18, metalness: 0.88 });
    legMat     = new THREE.MeshStandardMaterial({ color: 0x1e0d04, roughness: 0.6,  metalness: 0.1  });
    hlMove = new THREE.MeshStandardMaterial({ color: 0x44ff88, transparent: true, opacity: 0.5,  depthWrite: false });
    hlSel  = new THREE.MeshStandardMaterial({ color: 0xffdd00, transparent: true, opacity: 0.6,  depthWrite: false });
    hlCap  = new THREE.MeshStandardMaterial({ color: 0xff2222, transparent: true, opacity: 0.55, depthWrite: false });
    hlChk  = new THREE.MeshStandardMaterial({ color: 0xff0000, transparent: true, opacity: 0.7,  depthWrite: false, emissive: new THREE.Color(0xff0000), emissiveIntensity: 0.4 });

    // Renderer
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;

    // Scene
    scene = new THREE.Scene();

    // Camera — фиксированный FOV адаптивный
    camera = new THREE.PerspectiveCamera(
      42,
      window.innerWidth / window.innerHeight,
      0.1, 100
    );
    _setCameraFixed();

    // Groups
    boardGroup     = new THREE.Group();
    piecesGroup    = new THREE.Group();
    highlightGroup = new THREE.Group();
    scene.add(boardGroup, piecesGroup, highlightGroup);

    _buildBoard();
    _buildLighting();
    setBackground(0);
    _startRender();

    window.addEventListener('resize', _onResize);

    // Touch — только для кликов, вращение ОТКЛЮЧЕНО
    canvas.addEventListener('touchstart', _onTouchStart, { passive: true });
    canvas.addEventListener('touchend',   _onTouchEnd,   { passive: true });
    canvas.addEventListener('click',      _onCanvasClick);
  }

  // ── Доска ─────────────────────────────────────────────────────────────
  function _buildBoard() {
    // Основание
    const base = new THREE.Mesh(new THREE.BoxGeometry(10.6, 0.6, 10.6), baseMat);
    base.position.y = -0.32;
    base.receiveShadow = true; base.castShadow = true;
    boardGroup.add(base);

    // Рамка
    const frame = new THREE.Mesh(new THREE.BoxGeometry(9.9, 0.09, 9.9), frameMat);
    frame.position.y = -0.01;
    frame.receiveShadow = true;
    boardGroup.add(frame);

    // Золотой кант — 4 стороны
    [
      [0, 0.07, -4.95, 9.95, 0.05, 0.12],
      [0, 0.07,  4.95, 9.95, 0.05, 0.12],
      [-4.95, 0.07, 0, 0.12, 0.05, 9.95],
      [ 4.95, 0.07, 0, 0.12, 0.05, 9.95],
    ].forEach(([x,y,z,w,h,d]) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), edgeMat);
      m.position.set(x,y,z); boardGroup.add(m);
    });

    // Клетки — выступают над рамкой
    const sqGeo = new THREE.BoxGeometry(SQ - 0.004, 0.10, SQ - 0.004);
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const isLight = (r + c) % 2 === 0;
        const mesh = new THREE.Mesh(sqGeo, isLight ? lightSqMat : darkSqMat);
        mesh.position.set(OFF + c * SQ, 0.09, OFF + r * SQ);
        mesh.receiveShadow = true;
        mesh.userData = { isSquare: true, row: r, col: c };
        boardGroup.add(mesh);
      }
    }

    // Ножки
    [[-4.2,-4.2],[4.2,-4.2],[-4.2,4.2],[4.2,4.2]].forEach(([x,z]) => {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.26, 0.4, 10), legMat);
      leg.position.set(x, -0.82, z);
      leg.castShadow = true;
      boardGroup.add(leg);
    });
  }

  // ── Освещение ─────────────────────────────────────────────────────────
  function _buildLighting() {
    scene.add(new THREE.AmbientLight(0xfff5e0, 0.5));

    const main = new THREE.DirectionalLight(0xfff8e8, 1.8);
    main.position.set(5, 14, 7);
    main.castShadow = true;
    main.shadow.mapSize.set(2048, 2048);
    main.shadow.camera.left = main.shadow.camera.bottom = -9;
    main.shadow.camera.right = main.shadow.camera.top   =  9;
    main.shadow.bias = -0.001;
    scene.add(main);

    const fill = new THREE.DirectionalLight(0xaabbff, 0.35);
    fill.position.set(-6, 7, -5);
    scene.add(fill);

    const bounce = new THREE.PointLight(0xff9955, 0.35, 18);
    bounce.position.set(0, -2, 0);
    scene.add(bounce);
  }

  // ── Фоны ──────────────────────────────────────────────────────────────
  function _clearEnv() {
    const rem = [];
    scene.traverse(o => { if (o.userData.env) rem.push(o); });
    rem.forEach(o => {
      scene.remove(o);
      if (o.geometry) o.geometry.dispose();
      if (o.material) [].concat(o.material).forEach(m => m.dispose());
    });
  }

  function setBackground(idx) {
    currentBg = idx % 3;
    _clearEnv();
    [_bgCastle, _bgSpace, _bgMinimal][currentBg]();
  }

  function cycleBackground() { setBackground((currentBg + 1) % 3); return currentBg; }

  function _floor(color) {
    const f = new THREE.Mesh(
      new THREE.PlaneGeometry(80, 80),
      new THREE.MeshStandardMaterial({ color, roughness: 0.95 })
    );
    f.rotation.x = -Math.PI/2; f.position.y = -1.1;
    f.receiveShadow = true; f.userData.env = true;
    scene.add(f);
  }

  function _bgCastle() {
    scene.background = new THREE.Color(0x100806);
    scene.fog = new THREE.FogExp2(0x100806, 0.04);
    _floor(0x0d0804);

    [[-7,0,-7],[-7,0,7],[7,0,-7],[7,0,7],[-9,0,0],[9,0,0]].forEach(([x,,z]) => {
      const h = 0.5 + Math.random() * 0.35;
      const body = new THREE.Mesh(
        new THREE.CylinderGeometry(0.055, 0.075, h, 8),
        new THREE.MeshStandardMaterial({ color: 0xf0e8d0, roughness: 0.9 })
      );
      body.position.set(x, -1.1 + h/2, z);
      body.userData.env = true; scene.add(body);

      const flame = new THREE.Mesh(
        new THREE.SphereGeometry(0.075, 6, 6),
        new THREE.MeshStandardMaterial({ color: 0xff9900, emissive: new THREE.Color(0xff6600), emissiveIntensity: 2.5, transparent: true, opacity: 0.9 })
      );
      flame.position.set(x, -1.1 + h + 0.09, z);
      flame.userData.env = true; flame.userData.isFlame = true; scene.add(flame);

      const cl = new THREE.PointLight(0xff8833, 1.0, 10);
      cl.position.set(x, -1.1 + h + 0.12, z);
      cl.userData.env = true; cl.userData.isCandle = true; scene.add(cl);
    });

    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x1a100a, roughness: 0.95 });
    [[-10,0,-10],[-10,0,10],[10,0,-10],[10,0,10]].forEach(([x,,z]) => {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 11, 12), pillarMat);
      p.position.set(x, 4.4, z); p.castShadow = true; p.userData.env = true; scene.add(p);
    });
  }

  function _bgSpace() {
    scene.background = new THREE.Color(0x00010f);
    scene.fog = new THREE.FogExp2(0x00010f, 0.022);
    _floor(0x020214);

    const n = 3000, pos = new Float32Array(n*3);
    for (let i = 0; i < n; i++) {
      const t = Math.random()*Math.PI*2, p = Math.acos(2*Math.random()-1), r = 25+Math.random()*30;
      pos[i*3]=r*Math.sin(p)*Math.cos(t); pos[i*3+1]=r*Math.sin(p)*Math.sin(t); pos[i*3+2]=r*Math.cos(p);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 0.13, transparent: true, opacity: 0.95 }));
    stars.userData.env = true; stars.userData.isStars = true; scene.add(stars);
  }

  function _bgMinimal() {
    scene.background = new THREE.Color(0x080808);
    scene.fog = new THREE.Fog(0x080808, 16, 38);
    const f = new THREE.Mesh(
      new THREE.PlaneGeometry(80, 80),
      new THREE.MeshStandardMaterial({ color: 0x090909, roughness: 0.1, metalness: 0.7 })
    );
    f.rotation.x = -Math.PI/2; f.position.y = -1.1;
    f.receiveShadow = true; f.userData.env = true; scene.add(f);

    const grid = new THREE.GridHelper(30, 30, 0x1c1c1c, 0x131313);
    grid.position.y = -1.09; grid.userData.env = true; scene.add(grid);
  }

  // ── Фигуры ────────────────────────────────────────────────────────────
  function squareToWorld(file, rank) {
    return { x: OFF + file * SQ, z: OFF + (7 - rank) * SQ };
  }

  function placePiece(type, color, file, rank) {
    const piece = PieceFactory.createPiece(type, color);
    if (!piece) return null;
    const pos = squareToWorld(file, rank);
    piece.position.set(pos.x, 0.14, pos.z);
    piece.userData.file = file;
    piece.userData.rank = rank;
    piecesGroup.add(piece);
    return piece;
  }

  function removePiece(file, rank) {
    piecesGroup.children
      .filter(p => p.userData.file === file && p.userData.rank === rank)
      .forEach(p => { piecesGroup.remove(p); p.traverse(c => { if (c.geometry) c.geometry.dispose(); }); });
  }

  function clearPieces() {
    while (piecesGroup.children.length) {
      const p = piecesGroup.children[0];
      piecesGroup.remove(p);
      p.traverse(c => { if (c.geometry) c.geometry.dispose(); });
    }
  }

  function getPieceAt(file, rank) {
    return piecesGroup.children.find(p => p.userData.file === file && p.userData.rank === rank);
  }

  function animatePiece(file, rank, toFile, toRank, onComplete) {
    const piece = getPieceAt(file, rank);
    if (!piece) { if (onComplete) onComplete(); return null; }
    const target = squareToWorld(toFile, toRank);
    const sx = piece.position.x, sz = piece.position.z;
    let t = 0;
    return delta => {
      t = Math.min(t + delta / 0.30, 1);
      const e = t < 0.5 ? 2*t*t : -1+(4-2*t)*t;
      piece.position.x = sx + (target.x - sx) * e;
      piece.position.z = sz + (target.z - sz) * e;
      piece.position.y = 0.14 + Math.sin(t * Math.PI) * 1.1;
      if (t >= 1) {
        piece.position.y = 0.14;
        piece.userData.file = toFile; piece.userData.rank = toRank;
        if (onComplete) onComplete();
        return true;
      }
      return false;
    };
  }

  // ── Подсветка ─────────────────────────────────────────────────────────
  function clearHighlights() {
    while (highlightGroup.children.length) highlightGroup.remove(highlightGroup.children[0]);
  }

  function highlightSquare(file, rank, type = 'move') {
    const mats = { move: hlMove, select: hlSel, capture: hlCap, check: hlChk };
    const pos = squareToWorld(file, rank);
    const mat = mats[type] || hlMove;

    const sq = new THREE.Mesh(new THREE.PlaneGeometry(0.92, 0.92), mat);
    sq.rotation.x = -Math.PI/2; sq.position.set(pos.x, 0.145, pos.z);
    highlightGroup.add(sq);

    if (type === 'move') {
      const dot = new THREE.Mesh(new THREE.CircleGeometry(0.17, 16), mat);
      dot.rotation.x = -Math.PI/2; dot.position.set(pos.x, 0.15, pos.z);
      highlightGroup.add(dot);
    }
  }

  // ── Touch/Click обработка (только клики, без вращения) ────────────────
  let _touchStartX = 0, _touchStartY = 0, _touchStartTime = 0;
  const raycaster = new THREE.Raycaster();
  const mouse2    = new THREE.Vector2();
  let _clickCallback = null;

  function setClickCallback(fn) { _clickCallback = fn; }

  function _getSquareFromXY(clientX, clientY) {
    const canvas = renderer.domElement;
    const rect   = canvas.getBoundingClientRect();
    mouse2.x =  ((clientX - rect.left) / rect.width)  * 2 - 1;
    mouse2.y = -((clientY - rect.top)  / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse2, camera);

    const sqMeshes = boardGroup.children.filter(c => c.userData.isSquare);
    const hits = raycaster.intersectObjects(sqMeshes);
    if (hits.length) {
      const d = hits[0].object.userData;
      return { file: d.col, rank: 7 - d.row };
    }
    const pHits = raycaster.intersectObjects(piecesGroup.children, true);
    if (pHits.length) {
      let obj = pHits[0].object;
      while (obj.parent && !obj.userData.isChessPiece) obj = obj.parent;
      if (obj.userData.isChessPiece) return { file: obj.userData.file, rank: obj.userData.rank };
    }
    return null;
  }

  function _onTouchStart(e) {
    _touchStartX    = e.touches[0].clientX;
    _touchStartY    = e.touches[0].clientY;
    _touchStartTime = Date.now();
  }

  function _onTouchEnd(e) {
    const dx   = e.changedTouches[0].clientX - _touchStartX;
    const dy   = e.changedTouches[0].clientY - _touchStartY;
    const dist = Math.sqrt(dx*dx + dy*dy);
    const dt   = Date.now() - _touchStartTime;
    if (dist < 12 && dt < 400) {
      const sq = _getSquareFromXY(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
      if (sq && _clickCallback) _clickCallback(sq.file, sq.rank);
    }
  }

  function _onCanvasClick(e) {
    // Только для мыши (desktop)
    if (e.pointerType === 'touch') return;
    const sq = _getSquareFromXY(e.clientX, e.clientY);
    if (sq && _clickCallback) _clickCallback(sq.file, sq.rank);
  }

  // Публичный метод для совместимости с game.js
  function getClickedSquare(e) {
    const clientX = e.clientX !== undefined ? e.clientX : (e.touches ? e.touches[0].clientX : 0);
    const clientY = e.clientY !== undefined ? e.clientY : (e.touches ? e.touches[0].clientY : 0);
    return _getSquareFromXY(clientX, clientY);
  }

  // ── Камера — только отражение для чёрных ─────────────────────────────
  function rotateCameraToWhite() {
    const dist = _getCamDistance();
    const a    = 52 * Math.PI / 180;
    _animCamera(0, dist * Math.sin(a), dist * Math.cos(a));
  }

  function rotateCameraToBlack() {
    const dist = _getCamDistance();
    const a    = 52 * Math.PI / 180;
    _animCamera(0, dist * Math.sin(a), -dist * Math.cos(a));
  }

  function flipCamera() {
    if (camera.position.z > 0) rotateCameraToBlack();
    else rotateCameraToWhite();
  }

  function _animCamera(tx, ty, tz) {
    const sx = camera.position.x, sy = camera.position.y, sz = camera.position.z;
    let t = 0;
    cameraAnimation = delta => {
      t = Math.min(t + delta / 0.65, 1);
      const e = t < 0.5 ? 4*t*t*t : (t-1)*(2*t-2)*(2*t-2)+1;
      camera.position.set(sx+(tx-sx)*e, sy+(ty-sy)*e, sz+(tz-sz)*e);
      camera.lookAt(0, 0, 0);
      return t >= 1;
    };
  }

  function addAnimation(fn) { if (fn) pendingAnimations.push(fn); }

  // ── Render ────────────────────────────────────────────────────────────
  let clock = 0, lastT = 0;

  function _startRender() {
    lastT = performance.now();
    const loop = () => {
      requestAnimationFrame(loop);
      const now = performance.now();
      const dt  = Math.min((now - lastT) / 1000, 0.05);
      lastT = now; clock += dt;

      if (cameraAnimation) { if (cameraAnimation(dt)) cameraAnimation = null; }
      pendingAnimations = pendingAnimations.filter(fn => !fn(dt));

      scene.traverse(o => {
        if (o.userData.isCandle) o.intensity = 0.85 + Math.sin(clock*3.7+o.position.x)*0.22+Math.sin(clock*7.1)*0.1;
        if (o.userData.isFlame)  { o.position.y += Math.sin(clock*9+o.position.x*3)*0.003; o.scale.x = 1+Math.sin(clock*7)*0.12; }
        if (o.userData.isStars)  o.rotation.y += 0.00006;
      });

      renderer.render(scene, camera);
    };
    loop();
  }

  function _onResize() {
    const w = window.innerWidth, h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    _setCameraFixed(); // пересчитываем дистанцию под новый размер экрана
  }

  return {
    init, placePiece, removePiece, clearPieces, getPieceAt,
    animatePiece, clearHighlights, highlightSquare,
    squareToWorld, getClickedSquare, setClickCallback,
    flipCamera, rotateCameraToWhite, rotateCameraToBlack,
    cycleBackground, addAnimation,
    get scene()  { return scene;  },
    get camera() { return camera; }
  };
})();
