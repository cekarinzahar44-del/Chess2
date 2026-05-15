// scene.js — Полная версия с красивыми фигурами, доской, анимациями и захватом

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

  // ===================== ФАБРИКА ФИГУР =====================
  const PieceFactory = {
    createPiece(type, color) {
      const isWhite = color === 'white';
      const baseColor = isWhite ? 0xf8f8f8 : 0x1a1a1a;
      const metal = isWhite ? 0.78 : 0.38;

      const material = new THREE.MeshStandardMaterial({ 
        color: baseColor, 
        metalness: metal, 
        roughness: 0.35 
      });

      let mainMesh;

      switch(type) {
        case 'pawn':
          mainMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.55, 16), material);
          break;
        case 'rook':
          mainMesh = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.68, 0.38), material);
          const rookTop = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.15, 16), material);
          rookTop.position.y = 0.41;
          mainMesh.add(rookTop);
          break;
        case 'knight':
          mainMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.28, 0.62, 16), material);
          const head = new THREE.Mesh(new THREE.SphereGeometry(0.23, 12, 12), material);
          head.position.set(0.1, 0.38, 0);
          head.rotation.z = 0.7;
          mainMesh.add(head);
          break;
        case 'bishop':
          mainMesh = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.75, 16), material);
          break;
        case 'queen':
          mainMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.32, 0.85, 16), material);
          const qCrown = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 12), material);
          qCrown.position.y = 0.5;
          mainMesh.add(qCrown);
          break;
        case 'king':
          mainMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.92, 16), material);
          const cross = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.28, 0.07), material);
          cross.position.y = 0.58;
          mainMesh.add(cross);
          break;
        default:
          mainMesh = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 16), material);
      }

      mainMesh.castShadow = true;
      mainMesh.receiveShadow = true;
      mainMesh.userData = { isChessPiece: true, type, color, file: -1, rank: -1 };

      // Подставка
      const base = new THREE.Mesh(
        new THREE.CylinderGeometry(0.35, 0.38, 0.12, 16),
        new THREE.MeshStandardMaterial({ color: baseColor, metalness: 0.6, roughness: 0.5 })
      );
      base.position.y = -0.07;
      mainMesh.add(base);

      return mainMesh;
    }
  };

  // ===================== INIT =====================
  function init(canvas) {
    // Материалы
    lightSquareMat = new THREE.MeshStandardMaterial({ color: 0xc89b6c, roughness: 0.6 });
    darkSquareMat  = new THREE.MeshStandardMaterial({ color: 0x5c2e0e, roughness: 0.7 });
    boardFrameMat  = new THREE.MeshStandardMaterial({ color: 0x3b1a08, roughness: 0.45 });
    boardSideMat   = new THREE.MeshStandardMaterial({ color: 0x2a1205, roughness: 0.55 });

    highlightMoveMat    = new THREE.MeshStandardMaterial({ color: 0x44ff88, transparent: true, opacity: 0.45 });
    highlightSelectMat  = new THREE.MeshStandardMaterial({ color: 0xffee44, transparent: true, opacity: 0.65 });
    highlightCaptureMat = new THREE.MeshStandardMaterial({ color: 0xff4444, transparent: true, opacity: 0.6 });
    highlightCheckMat   = new THREE.MeshStandardMaterial({ color: 0xff0000, transparent: true, opacity: 0.8, emissive: 0xff0000, emissiveIntensity: 0.5 });

    // Renderer
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;

    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 11, 12);
    camera.lookAt(0, 0, 0);

    controls = new THREE.OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controls.enablePan = false;
    controls.minDistance = 8;
    controls.maxDistance = 22;
    controls.minPolarAngle = Math.PI * 0.18;
    controls.maxPolarAngle = Math.PI * 0.62;
    controls.target.set(0, 0, 0);

    boardGroup = new THREE.Group();
    piecesGroup = new THREE.Group();
    highlightGroup = new THREE.Group();
    scene.add(boardGroup, piecesGroup, highlightGroup);

    buildBoard();
    buildLighting();
    setBackground(0);
    startRender();

    window.addEventListener('resize', onResize);
  }

  // ===================== ДОСКА =====================
  function buildBoard() {
    // Основание
    const base = new THREE.Mesh(new THREE.BoxGeometry(10.4, 0.55, 10.4), boardSideMat);
    base.position.y = -0.30;
    base.castShadow = true;
    base.receiveShadow = true;
    boardGroup.add(base);

    // Рамка
    const frame = new THREE.Mesh(new THREE.BoxGeometry(9.8, 0.18, 9.8), boardFrameMat);
    frame.position.y = 0.05;
    boardGroup.add(frame);

    // Золотой кант
    const edgeMat = new THREE.MeshStandardMaterial({ color: 0xb8860b, metalness: 0.9, roughness: 0.25 });
    const cantW = 9.9, cantT = 0.13, cantH = 0.07;
    [
      { pos: [0, 0.09, -4.9], size: [cantW, cantH, cantT] },
      { pos: [0, 0.09,  4.9], size: [cantW, cantH, cantT] },
      { pos: [-4.9, 0.09, 0], rot: [0, Math.PI/2, 0], size: [cantW, cantH, cantT] },
      { pos: [ 4.9, 0.09, 0], rot: [0, Math.PI/2, 0], size: [cantW, cantH, cantT] },
    ].forEach(item => {
      const g = new THREE.BoxGeometry(...item.size);
      const m = new THREE.Mesh(g, edgeMat);
      m.position.set(...item.pos);
      if (item.rot) m.rotation.set(...item.rot);
      boardGroup.add(m);
    });

    // Клетки
    const sqGeo = new THREE.BoxGeometry(SQ - 0.02, 0.08, SQ - 0.02);
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const isLight = (r + c) % 2 === 0;
        const mesh = new THREE.Mesh(sqGeo, isLight ? lightSquareMat : darkSquareMat);
        mesh.position.set(OFF + c * SQ, 0.08, OFF + r * SQ);
        mesh.receiveShadow = true;
        mesh.userData = { isSquare: true, row: r, col: c };
        boardGroup.add(mesh);
      }
    }
  }

  function buildLighting() {
    scene.add(new THREE.AmbientLight(0xfff5e0, 0.5));

    const main = new THREE.DirectionalLight(0xfff8e0, 1.4);
    main.position.set(5, 18, 8);
    main.castShadow = true;
    main.shadow.mapSize.set(2048, 2048);
    scene.add(main);

    const fill = new THREE.DirectionalLight(0xaaccff, 0.4);
    fill.position.set(-8, 8, -6);
    scene.add(fill);
  }

  // ===================== ФОНЫ =====================
  function setBackground(idx) {
    currentBg = idx % 3;
    scene.background = new THREE.Color(currentBg === 0 ? 0x100806 : currentBg === 1 ? 0x00010f : 0x080808);
    scene.fog = new THREE.FogExp2(currentBg === 0 ? 0x100806 : currentBg === 1 ? 0x00010f : 0x080808, 0.04);
  }

  function cycleBackground() {
    setBackground(currentBg + 1);
    return currentBg;
  }

  // ===================== ФИГУРЫ =====================
  function squareToWorld(file, rank) {
    return { x: OFF + file * SQ, z: OFF + (7 - rank) * SQ };
  }

  function placePiece(type, color, file, rank) {
    const piece = PieceFactory.createPiece(type, color);
    const pos = squareToWorld(file, rank);
    piece.position.set(pos.x, 0.1, pos.z);
    piece.userData.file = file;
    piece.userData.rank = rank;
    piecesGroup.add(piece);
    return piece;
  }

  function getPieceAt(file, rank) {
    return piecesGroup.children.find(p => p.userData.file === file && p.userData.rank === rank);
  }

  function clearPieces() {
    while (piecesGroup.children.length) {
      const p = piecesGroup.children[0];
      piecesGroup.remove(p);
      if (p.geometry) p.geometry.dispose();
      if (p.material) [].concat(p.material).forEach(m => m.dispose());
    }
  }

  // ===================== ПЕРЕМЕЩЕНИЕ И ЗАХВАТ =====================
  function movePiece(fromFile, fromRank, toFile, toRank, isCapture = false, onComplete) {
    const piece = getPieceAt(fromFile, fromRank);
    if (!piece) return;

    if (isCapture) {
      const captured = getPieceAt(toFile, toRank);
      if (captured) {
        let t = 0;
        pendingAnimations.push((delta) => {
          t += delta * 4;
          captured.position.y += 0.15;
          captured.scale.setScalar(Math.max(0.1, 1 - t));
          if (t >= 1) {
            piecesGroup.remove(captured);
            return true;
          }
          return false;
        });
      }
    }

    const target = squareToWorld(toFile, toRank);
    const startX = piece.position.x;
    const startZ = piece.position.z;
    let t = 0;

    pendingAnimations.push((delta) => {
      t = Math.min(t + delta * 2.5, 1);
      const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

      piece.position.x = startX + (target.x - startX) * ease;
      piece.position.z = startZ + (target.z - startZ) * ease;
      piece.position.y = 0.1 + Math.sin(t * Math.PI) * 1.5;

      if (t >= 1) {
        piece.position.set(target.x, 0.1, target.z);
        piece.userData.file = toFile;
        piece.userData.rank = toRank;
        if (onComplete) onComplete();
        return true;
      }
      return false;
    });
  }

  // ===================== ПОДСВЕТКА =====================
  function clearHighlights() {
    while (highlightGroup.children.length) {
      const c = highlightGroup.children[0];
      highlightGroup.remove(c);
      if (c.geometry) c.geometry.dispose();
      if (c.material) c.material.dispose();
    }
  }

  function highlightSquare(file, rank, type = 'move') {
    const mats = { move: highlightMoveMat, capture: highlightCaptureMat, select: highlightSelectMat };
    const pos = squareToWorld(file, rank);
    const mat = mats[type] || highlightMoveMat;

    const hl = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), mat);
    hl.rotation.x = -Math.PI / 2;
    hl.position.set(pos.x, 0.13, pos.z);
    highlightGroup.add(hl);
  }

  function highlightLegalMoves(moves) {
    clearHighlights();
    moves.forEach(m => {
      highlightSquare(m.toFile, m.toRank, m.capture ? 'capture' : 'move');
    });
  }

  // ===================== РЕНДЕР =====================
  function startRender() {
    let lastT = performance.now();
    const loop = () => {
      requestAnimationFrame(loop);
      const now = performance.now();
      const dt = Math.min((now - lastT) / 1000, 0.05);
      lastT = now;

      controls.update();

      if (cameraAnimation) {
        if (cameraAnimation(dt)) cameraAnimation = null;
      }

      pendingAnimations = pendingAnimations.filter(fn => !fn(dt));

      renderer.render(scene, camera);
    };
    loop();
  }

  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  // ===================== PUBLIC API =====================
  return {
    init,
    placePiece,
    movePiece,
    highlightLegalMoves,
    highlightSquare,
    clearHighlights,
    setupStartingPosition: () => {
      clearPieces();
      const back = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'];
      back.forEach((t, i) => placePiece(t, 'white', i, 0));
      for (let i = 0; i < 8; i++) placePiece('pawn', 'white', i, 1);
      back.forEach((t, i) => placePiece(t, 'black', i, 7));
      for (let i = 0; i < 8; i++) placePiece('pawn', 'black', i, 6);
    },
    clearPieces,
    getPieceAt,
    squareToWorld,
    cycleBackground,
    get scene() { return scene; },
    get camera() { return camera; }
  };
})();
