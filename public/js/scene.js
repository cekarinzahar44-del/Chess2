// /js/scene.js
window.Scene3D = (() => {
  let renderer, scene, camera, controls;
  let boardGroup, piecesGroup, highlightGroup;
  let pendingAnimations = [];

  let lightSquareMat, darkSquareMat, boardFrameMat, boardSideMat;

  const SQ = 1.0;
  const OFF = -3.5;

  // ===================== ФАБРИКА ФИГУР =====================
  const PieceFactory = {
    createPiece(type, color) {
      const isWhite = color === 'white';
      const baseColor = isWhite ? 0xf8f8f8 : 0x222222;
      const material = new THREE.MeshStandardMaterial({
        color: baseColor,
        metalness: isWhite ? 0.8 : 0.4,
        roughness: 0.3
      });

      let geometry;
      switch (type) {
        case 'pawn':   geometry = new THREE.CylinderGeometry(0.24, 0.28, 0.58, 16); break;
        case 'rook':   geometry = new THREE.BoxGeometry(0.38, 0.70, 0.38); break;
        case 'knight': geometry = new THREE.CylinderGeometry(0.26, 0.30, 0.68, 16); break;
        case 'bishop': geometry = new THREE.ConeGeometry(0.26, 0.80, 16); break;
        case 'queen':  geometry = new THREE.CylinderGeometry(0.27, 0.32, 0.90, 16); break;
        case 'king':   geometry = new THREE.CylinderGeometry(0.29, 0.33, 0.98, 16); break;
        default:       geometry = new THREE.SphereGeometry(0.30, 16, 16);
      }

      const mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData = { isChessPiece: true, type, color, file: -1, rank: -1 };

      // Подставка
      const base = new THREE.Mesh(
        new THREE.CylinderGeometry(0.36, 0.39, 0.14, 16),
        new THREE.MeshStandardMaterial({ color: baseColor, metalness: 0.6 })
      );
      base.position.y = -0.08;
      mesh.add(base);

      // Декор для короля и ферзя
      if (type === 'king') {
        const cross = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.35, 0.1), material);
        cross.position.y = 0.62;
        mesh.add(cross);
      }
      if (type === 'queen') {
        const crown = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 12), material);
        crown.position.y = 0.58;
        mesh.add(crown);
      }

      return mesh;
    }
  };

  function init(canvas) {
    lightSquareMat = new THREE.MeshStandardMaterial({ color: 0xe8c9a0, roughness: 0.6 });
    darkSquareMat  = new THREE.MeshStandardMaterial({ color: 0x6b3d1e, roughness: 0.75 });
    boardFrameMat  = new THREE.MeshStandardMaterial({ color: 0x3b1a08, roughness: 0.45 });
    boardSideMat   = new THREE.MeshStandardMaterial({ color: 0x2a1205, roughness: 0.55 });

    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a0f08);

    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 11, 13);
    camera.lookAt(0, 0, 0);

    controls = new THREE.OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.12;
    controls.enablePan = false;
    controls.minDistance = 9;
    controls.maxDistance = 25;

    boardGroup = new THREE.Group();
    piecesGroup = new THREE.Group();
    highlightGroup = new THREE.Group();
    scene.add(boardGroup, piecesGroup, highlightGroup);

    buildBoard();
    buildLighting();
    startRender();

    console.log("✅ Scene3D + Фигуры загружены");
  }

  function buildBoard() {
    // Основание
    const base = new THREE.Mesh(new THREE.BoxGeometry(10.5, 0.6, 10.5), boardSideMat);
    base.position.y = -0.35;
    boardGroup.add(base);

    // Клетки
    const sqGeo = new THREE.BoxGeometry(SQ - 0.02, 0.13, SQ - 0.02);
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const isLight = (r + c) % 2 === 0;
        const square = new THREE.Mesh(sqGeo, isLight ? lightSquareMat : darkSquareMat);
        square.position.set(OFF + c * SQ, 0.06, OFF + r * SQ);
        square.receiveShadow = true;
        boardGroup.add(square);
      }
    }
  }

  function buildLighting() {
    scene.add(new THREE.AmbientLight(0xffffff, 0.65));
    const dirLight = new THREE.DirectionalLight(0xfff0d0, 1.1);
    dirLight.position.set(6, 18, 10);
    scene.add(dirLight);
  }

  function squareToWorld(file, rank) {
    return { x: OFF + file * SQ, z: OFF + (7 - rank) * SQ };
  }

  function placePiece(type, color, file, rank) {
    const piece = PieceFactory.createPiece(type, color);
    const pos = squareToWorld(file, rank);
    piece.position.set(pos.x, 0.18, pos.z);
    piece.userData.file = file;
    piece.userData.rank = rank;
    piecesGroup.add(piece);
    return piece;
  }

  function setupStartingPosition() {
    // Очищаем старые фигуры
    while (piecesGroup.children.length > 0) {
      piecesGroup.remove(piecesGroup.children[0]);
    }

    const backRank = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'];

    // Белые
    backRank.forEach((type, file) => placePiece(type, 'white', file, 0));
    for (let file = 0; file < 8; file++) placePiece('pawn', 'white', file, 1);

    // Чёрные
    backRank.forEach((type, file) => placePiece(type, 'black', file, 7));
    for (let file = 0; file < 8; file++) placePiece('pawn', 'black', file, 6);

    console.log("♟️ Фигуры расставлены");
  }

  function startRender() {
    let last = performance.now();
    const loop = () => {
      requestAnimationFrame(loop);
      controls.update();
      renderer.render(scene, camera);
    };
    loop();
  }

  return {
    init,
    setupStartingPosition,
    placePiece
  };
})();
