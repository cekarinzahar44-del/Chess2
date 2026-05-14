// public/js/scene.js
const Scene3D = (() => {
  let renderer, scene, camera, controls;
  let boardGroup, piecesGroup, highlightGroup;
  let currentBg = 0;
  let animFrameId;
  let pendingAnimations = [];
  let cameraAnimation = null;

  // Materials — created inside init() after THREE is ready
  let lightSquareMat, darkSquareMat, boardFrameMat;
  let highlightMoveMat, highlightSelectMat, highlightCaptureMat, highlightCheckMat;

  const SQUARE_SIZE = 1.0;
  const BOARD_OFFSET = -3.5;

  function init(canvas) {
    // ── Materials (created HERE, after THREE is loaded) ──────────────────
    lightSquareMat   = new THREE.MeshStandardMaterial({ color: 0xd4a96a, roughness: 0.6, metalness: 0.05 });
    darkSquareMat    = new THREE.MeshStandardMaterial({ color: 0x6b3a2a, roughness: 0.7, metalness: 0.05 });
    boardFrameMat    = new THREE.MeshStandardMaterial({ color: 0x2c1505, roughness: 0.5, metalness: 0.12 });
    highlightMoveMat    = new THREE.MeshStandardMaterial({ color: 0x44ff88, transparent: true, opacity: 0.45, depthWrite: false });
    highlightSelectMat  = new THREE.MeshStandardMaterial({ color: 0xffcc00, transparent: true, opacity: 0.55, depthWrite: false });
    highlightCaptureMat = new THREE.MeshStandardMaterial({ color: 0xff3333, transparent: true, opacity: 0.5,  depthWrite: false });
    highlightCheckMat   = new THREE.MeshStandardMaterial({ color: 0xff0000, transparent: true, opacity: 0.6,  depthWrite: false, emissive: new THREE.Color(0xff0000), emissiveIntensity: 0.3 });

    // ── Renderer ─────────────────────────────────────────────────────────
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;

    // ── Scene ─────────────────────────────────────────────────────────────
    scene = new THREE.Scene();

    // ── Camera — зафиксирована, не уезжает ───────────────────────────────
    camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 9, 10);
    camera.lookAt(0, 0, 0);

    // ── Controls — только вращение, без пана и большого зума ─────────────
    controls = new THREE.OrbitControls(camera, canvas);
    controls.enableDamping  = true;
    controls.dampingFactor  = 0.07;
    controls.enablePan      = false;
    controls.enableZoom     = true;
    controls.minDistance    = 7;
    controls.maxDistance    = 16;
    controls.minPolarAngle  = 0.25;
    controls.maxPolarAngle  = Math.PI / 2.1;
    controls.target.set(0, 0, 0);

    // ── Groups ────────────────────────────────────────────────────────────
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

  // ── Board ───────────────────────────────────────────────────────────────
  function buildBoard() {
    // Рамка
    const frame = new THREE.Mesh(new THREE.BoxGeometry(9.8, 0.28, 9.8), boardFrameMat);
    frame.position.y = -0.15;
    frame.receiveShadow = true;
    boardGroup.add(frame);

    // Золотой кант
    const edgeMat = new THREE.MeshStandardMaterial({ color: 0x8b6914, roughness: 0.25, metalness: 0.7 });
    const edge = new THREE.Mesh(new THREE.BoxGeometry(9.95, 0.06, 9.95), edgeMat);
    edge.position.y = -0.01;
    boardGroup.add(edge);

    // Клетки
    const sqGeo = new THREE.BoxGeometry(0.98, 0.09, 0.98);
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const m = new THREE.Mesh(sqGeo, (r + c) % 2 === 0 ? lightSquareMat : darkSquareMat);
        m.position.set(BOARD_OFFSET + c, 0, BOARD_OFFSET + r);
        m.receiveShadow = true;
        m.userData = { isSquare: true, row: r, col: c };
        boardGroup.add(m);
      }
    }
  }

  // ── Lighting ────────────────────────────────────────────────────────────
  function buildLighting() {
    scene.add(new THREE.AmbientLight(0xfff8e8, 0.4));

    const main = new THREE.DirectionalLight(0xfff5e0, 1.5);
    main.position.set(5, 12, 6);
    main.castShadow = true;
    main.shadow.mapSize.set(2048, 2048);
    main.shadow.camera.left = main.shadow.camera.bottom = -7;
    main.shadow.camera.right = main.shadow.camera.top = 7;
    main.shadow.bias = -0.001;
    scene.add(main);

    const fill = new THREE.DirectionalLight(0x8899ff, 0.35);
    fill.position.set(-6, 5, -4);
    scene.add(fill);

    const rim = new THREE.PointLight(0xffd080, 0.5, 22);
    rim.position.set(0, 7, -9);
    scene.add(rim);
  }

  // ── Backgrounds ─────────────────────────────────────────────────────────
  function clearEnvProps() {
    const toRemove = [];
    scene.traverse(o => { if (o.userData.envProp) toRemove.push(o); });
    toRemove.forEach(o => {
      scene.remove(o);
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose());
      }
    });
  }

  function setBackground(idx) {
    currentBg = idx % 3;
    clearEnvProps();

    if (currentBg === 0) _bgCastle();
    else if (currentBg === 1) _bgSpace();
    else _bgMinimal();
  }

  function _bgCastle() {
    scene.background = new THREE.Color(0x0f0705);
    scene.fog = new THREE.Fog(0x1a0a05, 14, 32);

    // Пол
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(50, 50),
      new THREE.MeshStandardMaterial({ color: 0x0a0702, roughness: 0.95 })
    );
    floor.rotation.x = -Math.PI / 2; floor.position.y = -0.52;
    floor.receiveShadow = true; floor.userData.envProp = true;
    scene.add(floor);

    // Свечи
    [[-6,0,-6],[-6,0,6],[6,0,-6],[6,0,6]].forEach(([x,,z]) => {
      const cBody = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.08, 0.7, 8),
        new THREE.MeshStandardMaterial({ color: 0xf0ead0, roughness: 0.8 })
      );
      cBody.position.set(x, 0.1, z); cBody.userData.envProp = true;
      scene.add(cBody);

      const flame = new THREE.Mesh(
        new THREE.SphereGeometry(0.08, 6, 6),
        new THREE.MeshStandardMaterial({ color: 0xff8800, emissive: new THREE.Color(0xff6600), emissiveIntensity: 2.0, transparent: true, opacity: 0.9 })
      );
      flame.position.set(x, 0.55, z); flame.userData.envProp = true; flame.userData.isFlame = true;
      scene.add(flame);

      const cl = new THREE.PointLight(0xff8833, 0.9, 9);
      cl.position.set(x, 0.65, z); cl.userData.envProp = true; cl.userData.isCandle = true;
      scene.add(cl);
    });

    // Колонны
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x1e1510, roughness: 0.9 });
    [[-9,0,-9],[-9,0,9],[9,0,-9],[9,0,9]].forEach(([x,,z]) => {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 9, 10), pillarMat);
      p.position.set(x, 4, z); p.castShadow = true; p.userData.envProp = true;
      scene.add(p);
    });
  }

  function _bgSpace() {
    scene.background = new THREE.Color(0x00010a);
    scene.fog = new THREE.Fog(0x00010a, 22, 55);

    // Звёзды
    const n = 2500, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const t = Math.random() * Math.PI * 2, p = Math.acos(2 * Math.random() - 1), r = 28 + Math.random() * 22;
      pos[i*3] = r*Math.sin(p)*Math.cos(t); pos[i*3+1] = r*Math.sin(p)*Math.sin(t); pos[i*3+2] = r*Math.cos(p);
    }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 0.13, transparent: true, opacity: 0.9 }));
    stars.userData.envProp = true; stars.userData.isStars = true;
    scene.add(stars);

    // Туманность
    [0x4411aa, 0xaa1144, 0x114488].forEach((color, i) => {
      const pl = new THREE.Mesh(
        new THREE.PlaneGeometry(55, 55),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.035, side: THREE.DoubleSide, depthWrite: false })
      );
      pl.rotation.set(Math.random(), i * 1.1, Math.random()); pl.userData.envProp = true;
      scene.add(pl);
    });

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(50, 50),
      new THREE.MeshStandardMaterial({ color: 0x030310, roughness: 1.0 })
    );
    floor.rotation.x = -Math.PI / 2; floor.position.y = -0.52; floor.userData.envProp = true;
    scene.add(floor);
  }

  function _bgMinimal() {
    scene.background = new THREE.Color(0x080808);
    scene.fog = new THREE.Fog(0x060608, 12, 28);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(50, 50),
      new THREE.MeshStandardMaterial({ color: 0x080808, roughness: 0.15, metalness: 0.6 })
    );
    floor.rotation.x = -Math.PI / 2; floor.position.y = -0.52;
    floor.receiveShadow = true; floor.userData.envProp = true;
    scene.add(floor);

    const grid = new THREE.GridHelper(22, 22, 0x1a1a1a, 0x111111);
    grid.position.y = -0.51; grid.userData.envProp = true;
    scene.add(grid);
  }

  function cycleBackground() {
    setBackground((currentBg + 1) % 3);
    return currentBg;
  }

  // ── Pieces ──────────────────────────────────────────────────────────────
  function placePiece(type, color, file, rank) {
    const piece = PieceFactory.createPiece(type, color);
    if (!piece) return null;
    const pos = squareToWorld(file, rank);
    piece.position.set(pos.x, 0, pos.z);
    piece.userData.file = file;
    piece.userData.rank = rank;
    piecesGroup.add(piece);
    return piece;
  }

  function removePiece(file, rank) {
    const toRemove = piecesGroup.children.filter(p => p.userData.file === file && p.userData.rank === rank);
    toRemove.forEach(p => { piecesGroup.remove(p); p.traverse(c => { if (c.geometry) c.geometry.dispose(); }); });
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
    const startX = piece.position.x, startZ = piece.position.z;
    let t = 0;
    const fn = (delta) => {
      t = Math.min(t + delta / 0.35, 1);
      const e = t < 0.5 ? 2*t*t : -1+(4-2*t)*t;
      piece.position.x = startX + (target.x - startX) * e;
      piece.position.z = startZ + (target.z - startZ) * e;
      piece.position.y = Math.sin(t * Math.PI) * 0.9;
      if (t >= 1) {
        piece.position.y = 0;
        piece.userData.file = toFile; piece.userData.rank = toRank;
        if (onComplete) onComplete();
        return true;
      }
      return false;
    };
    return fn;
  }

  // ── Highlights ──────────────────────────────────────────────────────────
  function clearHighlights() {
    while (highlightGroup.children.length) highlightGroup.remove(highlightGroup.children[0]);
  }

  function highlightSquare(file, rank, type = 'move') {
    const mats = { move: highlightMoveMat, select: highlightSelectMat, capture: highlightCaptureMat, check: highlightCheckMat };
    const pos = squareToWorld(file, rank);

    const sq = new THREE.Mesh(new THREE.PlaneGeometry(0.91, 0.91), mats[type] || highlightMoveMat);
    sq.rotation.x = -Math.PI / 2; sq.position.set(pos.x, 0.055, pos.z);
    highlightGroup.add(sq);

    if (type === 'move') {
      const dot = new THREE.Mesh(new THREE.CircleGeometry(0.17, 16), highlightMoveMat);
      dot.rotation.x = -Math.PI / 2; dot.position.set(pos.x, 0.065, pos.z);
      highlightGroup.add(dot);
    }
  }

  // ── Coordinates ─────────────────────────────────────────────────────────
  function squareToWorld(file, rank) {
    return { x: BOARD_OFFSET + file * SQUARE_SIZE, z: BOARD_OFFSET + (7 - rank) * SQUARE_SIZE };
  }

  // ── Raycasting ──────────────────────────────────────────────────────────
  const raycaster = new THREE.Raycaster();
  const mouse2 = new THREE.Vector2();

  function getClickedSquare(event) {
    const canvas = renderer.domElement;
    const rect = canvas.getBoundingClientRect();
    const clientX = event.clientX !== undefined ? event.clientX : event.touches[0].clientX;
    const clientY = event.clientY !== undefined ? event.clientY : event.touches[0].clientY;
    mouse2.x = ((clientX - rect.left) / rect.width)  *  2 - 1;
    mouse2.y = ((clientY - rect.top)  / rect.height) * -2 + 1;
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

  // ── Camera helpers ──────────────────────────────────────────────────────
  function rotateCameraToWhite() { _animCamera(0, 9, 10); }
  function rotateCameraToBlack() { _animCamera(0, 9, -10); }
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
      camera.lookAt(0, 0, 0); controls.target.set(0, 0, 0);
      return t >= 1;
    };
  }

  function addAnimation(fn) { if (fn) pendingAnimations.push(fn); }

  // ── Render loop ─────────────────────────────────────────────────────────
  let clock = 0, lastT = 0;

  function startRender() {
    lastT = performance.now();
    const loop = () => {
      animFrameId = requestAnimationFrame(loop);
      const now = performance.now();
      const dt = Math.min((now - lastT) / 1000, 0.05);
      lastT = now;
      clock += dt;

      controls.update();

      if (cameraAnimation) { if (cameraAnimation(dt)) cameraAnimation = null; }
      pendingAnimations = pendingAnimations.filter(fn => !fn(dt));

      // Свечи
      scene.traverse(o => {
        if (o.userData.isCandle) o.intensity = 0.7 + Math.sin(clock*3.8+o.position.x)*0.22+Math.sin(clock*7.3)*0.1;
        if (o.userData.isFlame)  { o.position.y += Math.sin(clock*9+o.position.x*3)*0.003; o.scale.x = 1+Math.sin(clock*6)*0.08; }
        if (o.userData.isStars)  o.rotation.y += 0.00008;
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
window.Scene3D = Scene3D;
