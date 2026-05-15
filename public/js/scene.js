// /js/scene.js
window.Scene3D = (() => {
  let renderer, scene, camera, controls;
  let boardGroup, piecesGroup, highlightGroup;
  let pendingAnimations = [];

  let moveSound, captureSound;

  let lightSquareMat, darkSquareMat, boardFrameMat, boardSideMat;
  let highlightMoveMat, highlightSelectMat, highlightCaptureMat;

  const SQ = 1.0;
  const OFF = -3.5;

  // ===================== ФАБРИКА ФИГУР =====================
  const PieceFactory = {
    createPiece(type, color) {
      const isWhite = color === 'white';
      const baseColor = isWhite ? 0xf0f0f0 : 0x1f1f1f;
      const material = new THREE.MeshStandardMaterial({
        color: baseColor,
        metalness: isWhite ? 0.75 : 0.4,
        roughness: 0.35
      });

      let geometry;
      switch (type) {
        case 'pawn': geometry = new THREE.CylinderGeometry(0.25, 0.28, 0.6, 16); break;
        case 'rook': geometry = new THREE.BoxGeometry(0.38, 0.72, 0.38); break;
        case 'knight': geometry = new THREE.CylinderGeometry(0.26, 0.3, 0.65, 16); break;
        case 'bishop': geometry = new THREE.ConeGeometry(0.26, 0.78, 16); break;
        case 'queen': geometry = new THREE.CylinderGeometry(0.28, 0.32, 0.88, 16); break;
        case 'king': geometry = new THREE.CylinderGeometry(0.29, 0.33, 0.95, 16); break;
        default: geometry = new THREE.SphereGeometry(0.3, 16, 16);
      }

      const mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = true;
      mesh.userData = { isChessPiece: true, type, color, file: -1, rank: -1 };

      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.39, 0.13, 16),
        new THREE.MeshStandardMaterial({ color: baseColor, metalness: 0.6 }));
      base.position.y = -0.08;
      mesh.add(base);

      return mesh;
    }
  };

  function init(canvas) {
    initSounds();

    lightSquareMat = new THREE.MeshStandardMaterial({ color: 0xe8c9a0, roughness: 0.6 });
    darkSquareMat = new THREE.MeshStandardMaterial({ color: 0x6b3d1e, roughness: 0.7 });
    boardFrameMat = new THREE.MeshStandardMaterial({ color: 0x3b1a08, roughness: 0.45 });
    boardSideMat = new THREE.MeshStandardMaterial({ color: 0x2a1205, roughness: 0.55 });

    highlightMoveMat = new THREE.MeshStandardMaterial({ color: 0x44ff88, transparent: true, opacity: 0.5 });
    highlightCaptureMat = new THREE.MeshStandardMaterial({ color: 0xff4444, transparent: true, opacity: 0.6 });
    highlightSelectMat = new THREE.MeshStandardMaterial({ color: 0xffdd00, transparent: true, opacity: 0.65 });

    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a0f08);

    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 11, 12);
    camera.lookAt(0, 0, 0);

    controls = new THREE.OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.12;
    controls.enablePan = false;

    boardGroup = new THREE.Group();
    piecesGroup = new THREE.Group();
    highlightGroup = new THREE.Group();
    scene.add(boardGroup, piecesGroup, highlightGroup);

    buildBoard();
    buildLighting();
    startRender();

    console.log("✅ Scene3D успешно инициализирован");
  }

  function initSounds() {
    moveSound = new Audio('https://freesound.org/data/previews/66/66930_931655-lq.mp3');
    captureSound = new Audio('https://freesound.org/data/previews/342/342749_5121236-lq.mp3');
    moveSound.volume = 0.6;
    captureSound.volume = 0.7;
  }

  function buildBoard() {
    const base = new THREE.Mesh(new THREE.BoxGeometry(10.4, 0.6, 10.4), boardSideMat);
    base.position.y = -0.35;
    boardGroup.add(base);

    const sqGeo = new THREE.BoxGeometry(SQ - 0.02, 0.12, SQ - 0.02);
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const isLight = (r + c) % 2 === 0;
        const mesh = new THREE.Mesh(sqGeo, isLight ? lightSquareMat : darkSquareMat);
        mesh.position.set(OFF + c * SQ, 0.06, OFF + r * SQ);
        mesh.receiveShadow = true;
        boardGroup.add(mesh);
      }
    }
  }

  function buildLighting() {
    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const dirLight = new THREE.DirectionalLight(0xfff8e0, 1.2);
    dirLight.position.set(5, 15, 10);
    scene.add(dirLight);
  }

  function squareToWorld(file, rank) {
    return { x: OFF + file * SQ, z: OFF + (7 - rank) * SQ };
  }

  function placePiece(type, color, file, rank) {
    const piece = PieceFactory.createPiece(type, color);
    const pos = squareToWorld(file, rank);
    piece.position.set(pos.x, 0.15, pos.z);
    piece.userData.file = file;
    piece.userData.rank = rank;
    piecesGroup.add(piece);
    return piece;
  }

  function setupStartingPosition() {
    while (piecesGroup.children.length) piecesGroup.remove(piecesGroup.children[0]);

    const back = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'];

    back.forEach((t, i) => placePiece(t, 'white', i, 0));
    for (let i = 0; i < 8; i++) placePiece('pawn', 'white', i, 1);

    back.forEach((t, i) => placePiece(t, 'black', i, 7));
    for (let i = 0; i < 8; i++) placePiece('pawn', 'black', i, 6);
  }

  function movePiece(fromFile, fromRank, toFile, toRank, isCapture = false) {
    console.log(`Ход: \( {fromFile}, \){fromRank} → \( {toFile}, \){toRank}`);
    // Здесь будет анимация позже
  }

  function startRender() {
    let last = performance.now();
    const loop = () => {
      requestAnimationFrame(loop);
      const dt = (performance.now() - last) / 1000;
      last = performance.now();
      controls.update();
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
    init,
    setupStartingPosition,
    movePiece,
    placePiece
  };
})();
