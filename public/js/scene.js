// public/js/scene.js
const Scene3D = (() => {
  let renderer, scene, camera, controls;
  let boardGroup, piecesGroup, highlightGroup;
  let materials;
  let currentBg = 0;
  let animFrameId;

  const BOARD_SIZE = 8;
  const SQUARE_SIZE = 1.0;
  const BOARD_OFFSET = -(BOARD_SIZE / 2) * SQUARE_SIZE + SQUARE_SIZE / 2;

  // ── Square materials ────────────────────────────────────────────────────
  const lightSquareMat = new THREE.MeshStandardMaterial({
    color: 0xd4a96a, roughness: 0.6, metalness: 0.05
  });
  const darkSquareMat = new THREE.MeshStandardMaterial({
    color: 0x6b3a2a, roughness: 0.7, metalness: 0.05
  });
  const boardFrameMat = new THREE.MeshStandardMaterial({
    color: 0x3d1f0a, roughness: 0.5, metalness: 0.1
  });
  const highlightMoveMat = new THREE.MeshStandardMaterial({
    color: 0x44ff88, transparent: true, opacity: 0.45,
    roughness: 0.4, metalness: 0.0, depthWrite: false
  });
  const highlightSelectMat = new THREE.MeshStandardMaterial({
    color: 0xffcc00, transparent: true, opacity: 0.55,
    roughness: 0.4, metalness: 0.0, depthWrite: false
  });
  const highlightCaptureMat = new THREE.MeshStandardMaterial({
    color: 0xff3333, transparent: true, opacity: 0.5,
    roughness: 0.4, metalness: 0.0, depthWrite: false
  });
  const highlightCheckMat = new THREE.MeshStandardMaterial({
    color: 0xff0000, transparent: true, opacity: 0.6,
    emissive: 0xff0000, emissiveIntensity: 0.3,
    roughness: 0.4, depthWrite: false
  });

  // ── Init ───────────────────────────────────────────────────────────────
  function init(canvas) {
    // Renderer
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;

    // Scene
    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x0a0a0f, 18, 40);

    // Camera
    camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 8, 9);
    camera.lookAt(0, 0, 0);

    // Controls
    controls = new THREE.OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.minDistance = 5;
    controls.maxDistance = 18;
    controls.minPolarAngle = 0.2;
    controls.maxPolarAngle = Math.PI / 2 - 0.05;
    controls.enableZoom = true;

    // Groups
    boardGroup = new THREE.Group();
    piecesGroup = new THREE.Group();
    highlightGroup = new THREE.Group();
    scene.add(boardGroup, piecesGroup, highlightGroup);

    // Materials
    materials = PieceFactory.createMaterials();

    buildBoard();
    buildLighting();
    setBackground(0);
    startRender();

    window.addEventListener('resize', onResize);
    return { renderer, scene, camera, controls };
  }

  // ── Board ──────────────────────────────────────────────────────────────
  function buildBoard() {
    // Frame
    const frameGeo = new THREE.BoxGeometry(9.6, 0.25, 9.6);
    const frame = new THREE.Mesh(frameGeo, boardFrameMat);
    frame.position.y = -0.14;
    frame.receiveShadow = true;
    boardGroup.add(frame);

    // Metallic edge strip
    const edgeMat = new THREE.MeshStandardMaterial({ color: 0x8b6914, roughness: 0.3, metalness: 0.6 });
    const edgeGeo = new THREE.BoxGeometry(9.8, 0.06, 9.8);
    const edge = new THREE.Mesh(edgeGeo, edgeMat);
    edge.position.y = -0.01;
    boardGroup.add(edge);

    // Squares
    const squareGeo = new THREE.BoxGeometry(SQUARE_SIZE - 0.02, 0.08, SQUARE_SIZE - 0.02);
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const isLight = (row + col) % 2 === 0;
        const mesh = new THREE.Mesh(squareGeo, isLight ? lightSquareMat : darkSquareMat);
        mesh.position.set(
          BOARD_OFFSET + col * SQUARE_SIZE,
          0,
          BOARD_OFFSET + row * SQUARE_SIZE
        );
        mesh.receiveShadow = true;
        mesh.userData = { isSquare: true, row, col, file: col, rank: 7 - row };
        boardGroup.add(mesh);
      }
    }

    // Coordinate labels
    const loader = null; // Skip canvas labels for performance
  }

  // ── Lighting ───────────────────────────────────────────────────────────
  function buildLighting() {
    // Ambient
    const ambient = new THREE.AmbientLight(0xfff8e8, 0.35);
    scene.add(ambient);

    // Main directional (sun/chandelier)
    const main = new THREE.DirectionalLight(0xfff5e0, 1.4);
    main.position.set(4, 10, 5);
    main.castShadow = true;
    main.shadow.mapSize.set(2048, 2048);
    main.shadow.camera.near = 0.5;
    main.shadow.camera.far = 30;
    main.shadow.camera.left = -8;
    main.shadow.camera.right = 8;
    main.shadow.camera.top = 8;
    main.shadow.camera.bottom = -8;
    main.shadow.bias = -0.001;
    scene.add(main);

    // Fill light
    const fill = new THREE.DirectionalLight(0x88aaff, 0.4);
    fill.position.set(-5, 5, -4);
    scene.add(fill);

    // Rim light (dramatic back lighting)
    const rim = new THREE.PointLight(0xffd080, 0.6, 20);
    rim.position.set(0, 6, -8);
    scene.add(rim);

    // Board glow
    const boardGlow = new THREE.PointLight(0xffaa44, 0.3, 12);
    boardGlow.position.set(0, 2, 0);
    scene.add(boardGlow);
  }

  // ── Backgrounds ────────────────────────────────────────────────────────
  const BACKGROUNDS = [
    // 0 — Castle Interior (candles)
    () => {
      scene.fog = new THREE.Fog(0x1a0a05, 15, 35);
      scene.background = new THREE.Color(0x0f0705);
      addCastleEnv();
    },
    // 1 — Starfield Space
    () => {
      scene.fog = new THREE.Fog(0x00010a, 20, 50);
      scene.background = new THREE.Color(0x00010a);
      addStarfield();
    },
    // 2 — Dark Minimalism
    () => {
      scene.fog = new THREE.Fog(0x060608, 12, 28);
      scene.background = new THREE.Color(0x060608);
      addMinimalEnv();
    }
  ];

  function addCastleEnv() {
    // Stone floor plane
    const floorGeo = new THREE.PlaneGeometry(40, 40);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x1a1208, roughness: 0.95, metalness: 0.0 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.5;
    floor.receiveShadow = true;
    scene.add(floor);
    floor.userData.envProp = true;

    // Candles — flickering point lights
    const candlePositions = [[-6,0,-6],[-6,0,6],[6,0,-6],[6,0,6],[-8,0,0],[8,0,0]];
    candlePositions.forEach(([x,,z]) => {
      // Candle body
      const candleGeo = new THREE.CylinderGeometry(0.06, 0.08, 0.6, 8);
      const candleMat = new THREE.MeshStandardMaterial({ color: 0xf0ead0, roughness: 0.8 });
      const candle = new THREE.Mesh(candleGeo, candleMat);
      candle.position.set(x, 0.1, z);
      candle.userData.envProp = true;
      scene.add(candle);

      // Flame
      const flameGeo = new THREE.SphereGeometry(0.08, 6, 6);
      const flameMat = new THREE.MeshStandardMaterial({
        color: 0xff8800, emissive: 0xff6600, emissiveIntensity: 2.0,
        transparent: true, opacity: 0.9
      });
      const flame = new THREE.Mesh(flameGeo, flameMat);
      flame.position.set(x, 0.5, z);
      flame.userData.envProp = true;
      flame.userData.isFlame = true;
      scene.add(flame);

      // Candle light
      const light = new THREE.PointLight(0xff8833, 0.8, 8);
      light.position.set(x, 0.6, z);
      light.userData.envProp = true;
      light.userData.isCandle = true;
      scene.add(light);
    });

    // Pillars
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x2a1f14, roughness: 0.9 });
    const pillarPositions = [[-9,0,-9],[-9,0,9],[9,0,-9],[9,0,9]];
    pillarPositions.forEach(([x,,z]) => {
      const pGeo = new THREE.CylinderGeometry(0.5, 0.6, 8, 12);
      const pillar = new THREE.Mesh(pGeo, pillarMat);
      pillar.position.set(x, 3.5, z);
      pillar.castShadow = true;
      pillar.userData.envProp = true;
      scene.add(pillar);
    });
  }

  function addStarfield() {
    // Star particles
    const starCount = 2000;
    const positions = new Float32Array(starCount * 3);
    const sizes = new Float32Array(starCount);
    for (let i = 0; i < starCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 30 + Math.random() * 20;
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
      sizes[i] = Math.random() * 1.5 + 0.5;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0xffffff, size: 0.12, sizeAttenuation: true,
      transparent: true, opacity: 0.9
    });
    const stars = new THREE.Points(starGeo, starMat);
    stars.userData.envProp = true;
    scene.add(stars);

    // Nebula glow planes
    const nebulaColors = [0x4411aa, 0xaa1144, 0x114488];
    nebulaColors.forEach((color, i) => {
      const geo = new THREE.PlaneGeometry(50, 50);
      const mat = new THREE.MeshBasicMaterial({
        color, transparent: true, opacity: 0.04,
        side: THREE.DoubleSide, depthWrite: false
      });
      const plane = new THREE.Mesh(geo, mat);
      plane.rotation.set(Math.random(), Math.random() * Math.PI, Math.random());
      plane.position.set(0, 0, 0);
      plane.userData.envProp = true;
      scene.add(plane);
    });

    // Space floor
    const floorGeo = new THREE.PlaneGeometry(40, 40);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x050510, roughness: 1.0, metalness: 0.0,
      transparent: true, opacity: 0.8
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.5;
    floor.receiveShadow = true;
    floor.userData.envProp = true;
    scene.add(floor);
  }

  function addMinimalEnv() {
    // Subtle reflective floor
    const floorGeo = new THREE.PlaneGeometry(50, 50);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x080808, roughness: 0.2, metalness: 0.5
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.5;
    floor.receiveShadow = true;
    floor.userData.envProp = true;
    scene.add(floor);

    // Thin grid lines
    const gridHelper = new THREE.GridHelper(20, 20, 0x222222, 0x111111);
    gridHelper.position.y = -0.49;
    gridHelper.userData.envProp = true;
    scene.add(gridHelper);
  }

  function setBackground(index) {
    currentBg = index % 3;
    clearEnvProps();
    BACKGROUNDS[currentBg]();
  }

  function clearEnvProps() {
    const toRemove = [];
    scene.traverse(obj => {
      if (obj.userData.envProp) toRemove.push(obj);
    });
    toRemove.forEach(obj => {
      scene.remove(obj);
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
        else obj.material.dispose();
      }
    });
  }

  function cycleBackground() {
    setBackground((currentBg + 1) % 3);
    return currentBg;
  }

  // ── Pieces ─────────────────────────────────────────────────────────────
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
    const toRemove = [];
    piecesGroup.children.forEach(p => {
      if (p.userData.file === file && p.userData.rank === rank) toRemove.push(p);
    });
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

  function animatePiece(file, rank, toFile, toRank, onComplete) {
    const piece = getPieceAt(file, rank);
    if (!piece) { if (onComplete) onComplete(); return; }
    const target = squareToWorld(toFile, toRank);
    const startPos = { x: piece.position.x, z: piece.position.z };
    const arcHeight = 0.8;
    let t = 0;
    const duration = 0.35;
    const tick = (delta) => {
      t += delta / duration;
      if (t >= 1) t = 1;
      const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      piece.position.x = startPos.x + (target.x - startPos.x) * ease;
      piece.position.z = startPos.z + (target.z - startPos.z) * ease;
      piece.position.y = Math.sin(t * Math.PI) * arcHeight;
      if (t >= 1) {
        piece.position.y = 0;
        piece.userData.file = toFile;
        piece.userData.rank = toRank;
        if (onComplete) onComplete();
        return true;
      }
      return false;
    };
    return tick;
  }

  function getPieceAt(file, rank) {
    return piecesGroup.children.find(p => p.userData.file === file && p.userData.rank === rank);
  }

  // ── Highlights ─────────────────────────────────────────────────────────
  function clearHighlights() {
    while (highlightGroup.children.length) highlightGroup.remove(highlightGroup.children[0]);
  }

  function highlightSquare(file, rank, type = 'move') {
    const geo = new THREE.PlaneGeometry(0.92, 0.92);
    const mats = { move: highlightMoveMat, select: highlightSelectMat, capture: highlightCaptureMat, check: highlightCheckMat };
    const mesh = new THREE.Mesh(geo, mats[type] || highlightMoveMat);
    const pos = squareToWorld(file, rank);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(pos.x, 0.05, pos.z);
    highlightGroup.add(mesh);

    // Dot for moves (smaller indicator)
    if (type === 'move') {
      const dotGeo = new THREE.CircleGeometry(0.18, 16);
      const dot = new THREE.Mesh(dotGeo, highlightMoveMat);
      dot.rotation.x = -Math.PI / 2;
      dot.position.set(pos.x, 0.06, pos.z);
      highlightGroup.add(dot);
    }
  }

  // ── Coordinate conversion ───────────────────────────────────────────────
  function squareToWorld(file, rank) {
    return {
      x: BOARD_OFFSET + file * SQUARE_SIZE,
      z: BOARD_OFFSET + (7 - rank) * SQUARE_SIZE
    };
  }

  function worldToSquare(x, z) {
    const file = Math.round((x - BOARD_OFFSET) / SQUARE_SIZE);
    const rank = 7 - Math.round((z - BOARD_OFFSET) / SQUARE_SIZE);
    if (file < 0 || file > 7 || rank < 0 || rank > 7) return null;
    return { file, rank };
  }

  // ── Raycasting ──────────────────────────────────────────────────────────
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  function getClickedSquare(event) {
    const canvas = renderer.domElement;
    const rect = canvas.getBoundingClientRect();
    const clientX = event.touches ? event.touches[0].clientX : event.clientX;
    const clientY = event.touches ? event.touches[0].clientY : event.clientY;
    mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);

    // Check board squares first
    const squareMeshes = boardGroup.children.filter(c => c.userData.isSquare);
    const boardHits = raycaster.intersectObjects(squareMeshes);
    if (boardHits.length) {
      const sq = boardHits[0].object.userData;
      return { file: sq.col, rank: 7 - sq.row };
    }

    // Check pieces
    const pieceHits = raycaster.intersectObjects(piecesGroup.children, true);
    if (pieceHits.length) {
      let obj = pieceHits[0].object;
      while (obj.parent && !obj.userData.isChessPiece) obj = obj.parent;
      if (obj.userData.isChessPiece) {
        return { file: obj.userData.file, rank: obj.userData.rank };
      }
    }
    return null;
  }

  // ── Camera ─────────────────────────────────────────────────────────────
  function rotateCameraToWhite() {
    animateCamera({ x: 0, y: 8, z: 9 }, 0);
  }

  function rotateCameraToBlack() {
    animateCamera({ x: 0, y: 8, z: -9 }, Math.PI);
  }

  function flipCamera() {
    const isWhiteSide = camera.position.z > 0;
    if (isWhiteSide) rotateCameraToBlack();
    else rotateCameraToWhite();
  }

  function animateCamera(targetPos, targetTheta) {
    const startPos = { x: camera.position.x, y: camera.position.y, z: camera.position.z };
    let t = 0;
    const dur = 0.8;
    const animTick = (delta) => {
      t += delta / dur;
      if (t > 1) t = 1;
      const ease = t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
      camera.position.x = startPos.x + (targetPos.x - startPos.x) * ease;
      camera.position.y = startPos.y + (targetPos.y - startPos.y) * ease;
      camera.position.z = startPos.z + (targetPos.z - startPos.z) * ease;
      camera.lookAt(0, 0, 0);
      controls.target.set(0, 0, 0);
      return t >= 1;
    };
    cameraAnimation = animTick;
  }

  let cameraAnimation = null;

  // ── Render loop ─────────────────────────────────────────────────────────
  let lastTime = performance.now();
  let clock = 0;

  function startRender() {
    const animate = () => {
      animFrameId = requestAnimationFrame(animate);
      const now = performance.now();
      const delta = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;
      clock += delta;

      controls.update();

      // Camera animation
      if (cameraAnimation) {
        const done = cameraAnimation(delta);
        if (done) cameraAnimation = null;
      }

      // Piece move animations
      if (pendingAnimations.length) {
        pendingAnimations = pendingAnimations.filter(anim => !anim(delta));
      }

      // Candle flicker
      scene.traverse(obj => {
        if (obj.userData.isCandle) {
          obj.intensity = 0.6 + Math.sin(clock * 3.7 + obj.position.x) * 0.2 + Math.sin(clock * 7.1) * 0.1;
        }
        if (obj.userData.isFlame) {
          obj.position.y += Math.sin(clock * 8 + obj.position.x * 3) * 0.003;
          obj.scale.x = 1 + Math.sin(clock * 6) * 0.1;
        }
      });

      renderer.render(scene, camera);
    };
    animate();
  }

  let pendingAnimations = [];

  function addAnimation(animFn) {
    pendingAnimations.push(animFn);
  }

  function stopRender() {
    if (animFrameId) cancelAnimationFrame(animFrameId);
  }

  function onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }

  // ── Public ─────────────────────────────────────────────────────────────
  return {
    init,
    placePiece,
    removePiece,
    clearPieces,
    animatePiece,
    getPieceAt,
    clearHighlights,
    highlightSquare,
    squareToWorld,
    worldToSquare,
    getClickedSquare,
    flipCamera,
    rotateCameraToWhite,
    rotateCameraToBlack,
    cycleBackground,
    addAnimation,
    get materials() { return materials; },
    get scene() { return scene; },
    get camera() { return camera; },
    get controls() { return controls; }
  };
})();
