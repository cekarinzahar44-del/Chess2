// scene.js — фиксированная камера, красивая доска

const Scene3D = (() => {
  let renderer, scene, camera, controls;
  let boardGroup, piecesGroup, highlightGroup;
  let currentBg = 0;
  let pendingAnimations = [];
  let cameraAnimation = null;

  let lightSquareMat, darkSquareMat, boardFrameMat, boardSideMat;
  let highlightMoveMat, highlightSelectMat, highlightCaptureMat, highlightCheckMat;

  const SQ = 1.0;
  const OFF = -3.5;

  // ── Init ─────────────────────────────────────────────────────────────────
  function init(canvas) {
    // Материалы — создаём ЗДЕСЬ, после загрузки THREE
    lightSquareMat = new THREE.MeshStandardMaterial({
      color: 0xc8956c, roughness: 0.55, metalness: 0.0
    });
    darkSquareMat = new THREE.MeshStandardMaterial({
      color: 0x5c2e0e, roughness: 0.65, metalness: 0.0
    });
    boardFrameMat = new THREE.MeshStandardMaterial({
      color: 0x3b1a08, roughness: 0.4, metalness: 0.05
    });
    boardSideMat = new THREE.MeshStandardMaterial({
      color: 0x2a1205, roughness: 0.5, metalness: 0.05
    });
    highlightMoveMat    = new THREE.MeshStandardMaterial({ color: 0x44ff88, transparent: true, opacity: 0.5,  depthWrite: false });
    highlightSelectMat  = new THREE.MeshStandardMaterial({ color: 0xffdd00, transparent: true, opacity: 0.6,  depthWrite: false });
    highlightCaptureMat = new THREE.MeshStandardMaterial({ color: 0xff2222, transparent: true, opacity: 0.55, depthWrite: false });
    highlightCheckMat   = new THREE.MeshStandardMaterial({ color: 0xff0000, transparent: true, opacity: 0.7,  depthWrite: false, emissive: new THREE.Color(0xff0000), emissiveIntensity: 0.4 });

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

    // Camera — фиксированный угол, смотрит на доску сверху-сбоку
    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 13, 7);
    camera.lookAt(0, 0, 0);

    // Controls — ТОЛЬКО вращение по горизонтали, зум отключён на мобилке
    controls = new THREE.OrbitControls(camera, canvas);
    controls.enableDamping   = true;
    controls.dampingFactor   = 0.08;
    controls.enablePan       = false;   // запрет перемещения
    controls.enableZoom      = false;   // запрет зума — доска не уезжает
    controls.minPolarAngle   = Math.PI / 5;
    controls.maxPolarAngle   = Math.PI / 3.8;
    controls.minAzimuthAngle = -Infinity;
    controls.maxAzimuthAngle =  Infinity;
    controls.target.set(0, 0, 0);
    controls.update();

    // Groups
    boardGroup     = new THREE.Group();
    piecesGroup    = new THREE.Group();
    highlightGroup = new THREE.Group();
    scene.add(boardGroup, piecesGroup, highlightGroup);

    buildBoard();
    buildLighting();
    setBackground(0);
    startRender();

    window.addEventListener('resize', onResize);
  }

  // ── Красивая доска ────────────────────────────────────────────────────────
  function buildBoard() {

    // === ОСНОВАНИЕ ДОСКИ (толстое, как настоящее) ===
    const baseGeo = new THREE.BoxGeometry(10.4, 0.55, 10.4);
    const base = new THREE.Mesh(baseGeo, boardSideMat);
    base.position.y = -0.30;
    base.receiveShadow = true;
    base.castShadow = true;
    boardGroup.add(base);

    // === РАМКА (чуть меньше основания, сверху) ===
    const frameGeo = new THREE.BoxGeometry(9.85, 0.08, 9.85);
    const frame = new THREE.Mesh(frameGeo, boardFrameMat);
    frame.position.y = 0.0;
    frame.receiveShadow = true;
    boardGroup.add(frame);

    // === ЗОЛОТОЙ КАНТ ===
    const edgeMat = new THREE.MeshStandardMaterial({
      color: 0xb8860b, roughness: 0.2, metalness: 0.85
    });

    // 4 полосы канта по периметру
    const cantW = 9.9, cantT = 0.12, cantH = 0.06;
    [
      { pos: [0, 0.08, -4.9],  rot: [0,0,0],            size: [cantW, cantH, cantT] },
      { pos: [0, 0.08,  4.9],  rot: [0,0,0],            size: [cantW, cantH, cantT] },
      { pos: [-4.9, 0.08, 0],  rot: [0, Math.PI/2, 0],  size: [cantW, cantH, cantT] },
      { pos: [ 4.9, 0.08, 0],  rot: [0, Math.PI/2, 0],  size: [cantW, cantH, cantT] },
    ].forEach(({ pos, rot, size }) => {
      const g = new THREE.BoxGeometry(...size);
      const m = new THREE.Mesh(g, edgeMat);
      m.position.set(...pos);
      m.rotation.set(...rot);
      boardGroup.add(m);
    });

    // Угловые золотые углы
    [[-4.9,-4.9],[4.9,-4.9],[-4.9,4.9],[4.9,4.9]].forEach(([x,z]) => {
      const cg = new THREE.BoxGeometry(0.14, 0.07, 0.14);
      const cm = new THREE.Mesh(cg, edgeMat);
      cm.position.set(x, 0.085, z);
      boardGroup.add(cm);
    });

    // === ИГРОВЫЕ КЛЕТКИ ===
    const sqGeo = new THREE.BoxGeometry(SQ - 0.005, 0.10, SQ - 0.005);
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const isLight = (r + c) % 2 === 0;
        const mesh = new THREE.Mesh(sqGeo, isLight ? lightSquareMat : darkSquareMat);
        mesh.position.set(OFF + c * SQ, 0.09, OFF + r * SQ);
        mesh.receiveShadow = true;
        mesh.userData = { isSquare: true, row: r, col: c };
        boardGroup.add(mesh);
      }
    }

    // === БУКВЫ И ЦИФРЫ (простые метки через маленькие плашки) ===
    // Пропускаем — добавим через Canvas texture если нужно

    // === НОЖКИ ДОСКИ ===
    const legMat = new THREE.MeshStandardMaterial({ color: 0x1e0d04, roughness: 0.6, metalness: 0.1 });
    [[-4.2,-4.2],[4.2,-4.2],[-4.2,4.2],[4.2,4.2]].forEach(([x,z]) => {
      const lg = new THREE.CylinderGeometry(0.18, 0.25, 0.35, 10);
      const lm = new THREE.Mesh(lg, legMat);
      lm.position.set(x, -0.75, z);
      lm.castShadow = true;
      boardGroup.add(lm);
    });
  }

  // ── Освещение ─────────────────────────────────────────────────────────────
  function buildLighting() {
    // Мягкий ambient
    scene.add(new THREE.AmbientLight(0xfff5e0, 0.45));

    // Основной свет (сверху-сбоку)
    const main = new THREE.DirectionalLight(0xfff8e8, 1.6);
    main.position.set(4, 14, 6);
    main.castShadow = true;
    main.shadow.mapSize.set(2048, 2048);
    main.shadow.camera.left   = -8;
    main.shadow.camera.right  =  8;
    main.shadow.camera.top    =  8;
    main.shadow.camera.bottom = -8;
    main.shadow.bias = -0.001;
    scene.add(main);

    // Заполняющий свет с другой стороны
    const fill = new THREE.DirectionalLight(0xaabbff, 0.3);
    fill.position.set(-5, 6, -5);
    scene.add(fill);

    // Подсветка снизу доски (имитация отражённого света от стола)
    const bounce = new THREE.PointLight(0xff9955, 0.4, 15);
    bounce.position.set(0, -2, 0);
    scene.add(bounce);
  }

  // ── Фоны ─────────────────────────────────────────────────────────────────
  function clearEnvProps() {
    const rem = [];
    scene.traverse(o => { if (o.userData.envProp) rem.push(o); });
    rem.forEach(o => {
      scene.remove(o);
      if (o.geometry) o.geometry.dispose();
      if (o.material) [].concat(o.material).forEach(m => m.dispose());
    });
  }

  function setBackground(idx) {
    currentBg = idx % 3;
    clearEnvProps();
    [_bgCastle, _bgSpace, _bgMinimal][currentBg]();
  }

  function _bgCastle() {
    scene.background = new THREE.Color(0x100806);
    scene.fog = new THREE.FogExp2(0x100806, 0.045);

    const floorMat = new THREE.MeshStandardMaterial({ color: 0x0d0804, roughness: 0.98 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -1.1;
    floor.receiveShadow = true;
    floor.userData.envProp = true;
    scene.add(floor);

    // Свечи
    [[-7,0,-7],[-7,0,7],[7,0,-7],[7,0,7],[-9,0,0],[9,0,0]].forEach(([x,,z]) => {
      const h = 0.5 + Math.random() * 0.4;
      const body = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.07, h, 8),
        new THREE.MeshStandardMaterial({ color: 0xf0e8d0, roughness: 0.9 })
      );
      body.position.set(x, -1.1 + h/2, z);
      body.userData.envProp = true;
      scene.add(body);

      const flame = new THREE.Mesh(
        new THREE.SphereGeometry(0.07, 6, 6),
        new THREE.MeshStandardMaterial({ color: 0xff9900, emissive: new THREE.Color(0xff6600), emissiveIntensity: 2.5, transparent: true, opacity: 0.9 })
      );
      flame.position.set(x, -1.1 + h + 0.1, z);
      flame.userData.envProp = true;
      flame.userData.isFlame = true;
      scene.add(flame);

      const cl = new THREE.PointLight(0xff8833, 1.0, 10);
      cl.position.set(x, -1.1 + h + 0.15, z);
      cl.userData.envProp = true;
      cl.userData.isCandle = true;
      scene.add(cl);
    });

    // Колонны
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x1a100a, roughness: 0.95 });
    [[-10,0,-10],[-10,0,10],[10,0,-10],[10,0,10]].forEach(([x,,z]) => {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 10, 12), pillarMat);
      p.position.set(x, 3.9, z);
      p.castShadow = true;
      p.userData.envProp = true;
      scene.add(p);
    });
  }

  function _bgSpace() {
    scene.background = new THREE.Color(0x00010f);
    scene.fog = new THREE.FogExp2(0x00010f, 0.025);

    const n = 3000, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const t = Math.random()*Math.PI*2, p = Math.acos(2*Math.random()-1), r = 25+Math.random()*30;
      pos[i*3]=r*Math.sin(p)*Math.cos(t); pos[i*3+1]=r*Math.sin(p)*Math.sin(t); pos[i*3+2]=r*Math.cos(p);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 0.14, transparent: true, opacity: 0.95 }));
    stars.userData.envProp = true;
    stars.userData.isStars = true;
    scene.add(stars);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(60, 60),
      new THREE.MeshStandardMaterial({ color: 0x020214, roughness: 1.0 })
    );
    floor.rotation.x = -Math.PI/2; floor.position.y = -1.1;
    floor.userData.envProp = true;
    scene.add(floor);
  }

  function _bgMinimal() {
    scene.background = new THREE.Color(0x080808);
    scene.fog = new THREE.Fog(0x080808, 15, 35);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(60, 60),
      new THREE.MeshStandardMaterial({ color: 0x090909, roughness: 0.1, metalness: 0.7 })
    );
    floor.rotation.x = -Math.PI/2; floor.position.y = -1.1;
    floor.receiveShadow = true;
    floor.userData.envProp = true;
    scene.add(floor);

    const grid = new THREE.GridHelper(30, 30, 0x1c1c1c, 0x141414);
    grid.position.y = -1.09;
    grid.userData.envProp = true;
    scene.add(grid);
  }

  function cycleBackground() {
    setBackground((currentBg + 1) % 3);
    return currentBg;
  }

  // ── Фигуры ────────────────────────────────────────────────────────────────
  function squareToWorld(file, rank) {
    return { x: OFF + file * SQ, z: OFF + (7 - rank) * SQ };
  }

  function placePiece(type, color, file, rank) {
    const piece = PieceFactory.createPiece(type, color);
    if (!piece) return null;
    const pos = squareToWorld(file, rank);
    piece.position.set(pos.x, 0.1, pos.z);
    piece.userData.file = file;
    piece.userData.rank = rank;
    piecesGroup.add(piece);
    return piece;
  }

  function removePiece(file, rank) {
    const toRemove = piecesGroup.children.filter(p => p.userData.file === file && p.userData.rank === rank);
    toRemove.forEach(p => {
      piecesGroup.remove(p);
      p.traverse(c => { if (c.geometry) c.geometry.dispose(); });
    });
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
    return (delta) => {
      t = Math.min(t + delta / 0.32, 1);
      const e = t < 0.5 ? 2*t*t : -1+(4-2*t)*t;
      piece.position.x = sx + (target.x - sx) * e;
      piece.position.z = sz + (target.z - sz) * e;
      piece.position.y = 0.1 + Math.sin(t * Math.PI) * 1.0;
      if (t >= 1) {
        piece.position.y = 0.1;
        piece.userData.file = toFile;
        piece.userData.rank = toRank;
        if (onComplete) onComplete();
        return true;
      }
      return false;
    };
  }

  // ── Подсветка клеток ──────────────────────────────────────────────────────
  function clearHighlights() {
    while (highlightGroup.children.length) highlightGroup.remove(highlightGroup.children[0]);
  }

  function highlightSquare(file, rank, type = 'move') {
    const mats = { move: highlightMoveMat, select: highlightSelectMat, capture: highlightCaptureMat, check: highlightCheckMat };
    const pos = squareToWorld(file, rank);
    const mat = mats[type] || highlightMoveMat;

    const sq = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), mat);
    sq.rotation.x = -Math.PI / 2;
    sq.position.set(pos.x, 0.1, pos.z);
    highlightGroup.add(sq);

    if (type === 'move') {
      const dot = new THREE.Mesh(new THREE.CircleGeometry(0.16, 16), mat);
      dot.rotation.x = -Math.PI / 2;
      dot.position.set(pos.x, 0.11, pos.z);
      highlightGroup.add(dot);
    }
  }

  // ── Raycasting ────────────────────────────────────────────────────────────
  const raycaster = new THREE.Raycaster();
  const mouse2 = new THREE.Vector2();

  function getClickedSquare(eventOrTouch) {
    const canvas = renderer.domElement;
    const rect = canvas.getBoundingClientRect();
    const clientX = eventOrTouch.clientX !== undefined ? eventOrTouch.clientX : eventOrTouch.touches[0].clientX;
    const clientY = eventOrTouch.clientY !== undefined ? eventOrTouch.clientY : eventOrTouch.touches[0].clientY;
    mouse2.x =  ((clientX - rect.left) / rect.width)  * 2 - 1;
    mouse2.y = -((clientY - rect.top)  / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse2, camera);

    const squareMeshes = boardGroup.children.filter(c => c.userData.isSquare);
    const hits = raycaster.intersectObjects(squareMeshes);
    if (hits.length) {
      const d = hits[0].object.userData;
      return { file: d.col, rank: 7 - d.row };
    }

    const pieceHits = raycaster.intersectObjects(piecesGroup.children, true);
    if (pieceHits.length) {
      let obj = pieceHits[0].object;
      while (obj.parent && !obj.userData.isChessPiece) obj = obj.parent;
      if (obj.userData.isChessPiece) return { file: obj.userData.file, rank: obj.userData.rank };
    }
    return null;
  }

  // ── Камера ────────────────────────────────────────────────────────────────
  function rotateCameraToWhite() { _animCamera(0, 10, 9); }
  function rotateCameraToBlack() { _animCamera(0, 10, -9); }

  function flipCamera() {
    if (camera.position.z > 0) rotateCameraToBlack();
    else rotateCameraToWhite();
  }

  function _animCamera(tx, ty, tz) {
    const sx = camera.position.x, sy = camera.position.y, sz = camera.position.z;
    let t = 0;
    cameraAnimation = (delta) => {
      t = Math.min(t + delta / 0.7, 1);
      const e = t < 0.5 ? 4*t*t*t : (t-1)*(2*t-2)*(2*t-2)+1;
      camera.position.set(sx+(tx-sx)*e, sy+(ty-sy)*e, sz+(tz-sz)*e);
      camera.lookAt(0, 0, 0);
      controls.target.set(0, 0, 0);
      return t >= 1;
    };
  }

  function addAnimation(fn) { if (fn) pendingAnimations.push(fn); }

  // ── Render loop ───────────────────────────────────────────────────────────
  let clock = 0, lastT = 0;

  function startRender() {
    lastT = performance.now();
    const loop = () => {
      requestAnimationFrame(loop);
      const now = performance.now();
      const dt  = Math.min((now - lastT) / 1000, 0.05);
      lastT = now;
      clock += dt;

      controls.update();

      if (cameraAnimation) { if (cameraAnimation(dt)) cameraAnimation = null; }
      pendingAnimations = pendingAnimations.filter(fn => !fn(dt));

      // Анимация свечей
      scene.traverse(o => {
        if (o.userData.isCandle) o.intensity = 0.8 + Math.sin(clock*3.7+o.position.x)*0.25+Math.sin(clock*7.1)*0.1;
        if (o.userData.isFlame)  { o.position.y += Math.sin(clock*9+o.position.x*3)*0.003; o.scale.x = 1+Math.sin(clock*7)*0.12; }
        if (o.userData.isStars)  o.rotation.y += 0.00006;
      });

      renderer.render(scene, camera);
    };
    loop();
  }

  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  return {
    init, placePiece, removePiece, clearPieces, getPieceAt,
    animatePiece, clearHighlights, highlightSquare,
    squareToWorld, getClickedSquare,
    flipCamera, rotateCameraToWhite, rotateCameraToBlack,
    cycleBackground, addAnimation,
    get scene() { return scene; },
    get camera() { return camera; }
  };
})();
