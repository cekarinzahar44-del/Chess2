// scene.js — Полная версия с логикой шахматных правил

const Scene3D = (() => {
  let renderer, scene, camera, controls;
  let boardGroup, piecesGroup, highlightGroup;
  let pendingAnimations = [];

  // Звуки
  let moveSound, captureSound;

  let lightSquareMat, darkSquareMat, boardFrameMat, boardSideMat;
  let highlightMoveMat, highlightSelectMat, highlightCaptureMat, highlightCheckMat;

  const SQ = 1.0;
  const OFF = -3.5;

  // ===================== ШАХМАТНАЯ ЛОГИКА =====================
  let boardState = Array(8).fill().map(() => Array(8).fill(null)); // [rank][file]
  let currentTurn = 'white';
  let selectedPiece = null;

  const ChessLogic = {
    isValidMove(fromFile, fromRank, toFile, toRank) {
      const piece = boardState[fromRank][fromFile];
      if (!piece) return false;
      if (piece.color !== currentTurn) return false;

      // Простая проверка границ
      if (toFile < 0 || toFile > 7 || toRank < 0 || toRank > 7) return false;

      const target = boardState[toRank][toFile];
      const isCapture = target && target.color !== piece.color;

      // Здесь можно расширить на все правила (пока базовые + направление)
      switch(piece.type) {
        case 'pawn': return validatePawn(piece, fromFile, fromRank, toFile, toRank, isCapture);
        case 'rook': return validateRook(fromFile, fromRank, toFile, toRank);
        case 'knight': return validateKnight(fromFile, fromRank, toFile, toRank);
        case 'bishop': return validateBishop(fromFile, fromRank, toFile, toRank);
        case 'queen': return validateQueen(fromFile, fromRank, toFile, toRank);
        case 'king': return validateKing(fromFile, fromRank, toFile, toRank);
        default: return false;
      }
    },

    makeMove(fromFile, fromRank, toFile, toRank) {
      const piece = boardState[fromRank][fromFile];
      const captured = boardState[toRank][toFile];

      // Обновляем состояние
      boardState[toRank][toFile] = piece;
      boardState[fromRank][fromFile] = null;

      piece.file = toFile;
      piece.rank = toRank;

      currentTurn = currentTurn === 'white' ? 'black' : 'white';
      return !!captured;
    }
  };

  // Простые валидаторы (можно сильно улучшить)
  function validatePawn(p, fx, fr, tx, tr, isCapture) {
    const dir = p.color === 'white' ? 1 : -1;
    if (isCapture) {
      return Math.abs(fx - tx) === 1 && (tr - fr) === dir;
    }
    if (fx !== tx) return false;
    if (tr - fr === dir) return true;
    if ((fr === 1 && p.color === 'white') || (fr === 6 && p.color === 'black')) {
      return tr - fr === dir * 2 && !boardState[fr + dir][fx];
    }
    return false;
  }

  function validateRook(fx, fr, tx, tr) { return fx === tx || fr === tr; }
  function validateKnight(fx, fr, tx, tr) {
    const dx = Math.abs(fx - tx);
    const dy = Math.abs(fr - tr);
    return (dx === 1 && dy === 2) || (dx === 2 && dy === 1);
  }
  function validateBishop(fx, fr, tx, tr) {
    return Math.abs(fx - tx) === Math.abs(fr - tr);
  }
  function validateQueen(fx, fr, tx, tr) {
    return validateRook(fx, fr, tx, tr) || validateBishop(fx, fr, tx, tr);
  }
  function validateKing(fx, fr, tx, tr) {
    return Math.abs(fx - tx) <= 1 && Math.abs(fr - tr) <= 1;
  }

  // ===================== ФАБРИКА ФИГУР =====================
  const PieceFactory = { /* ... тот же код что был раньше ... */ 
    createPiece(type, color) {
      // (оставил тот же код, который работал)
      const isWhite = color === 'white';
      const baseColor = isWhite ? 0xf0f0f0 : 0x1f1f1f;
      const material = new THREE.MeshStandardMaterial({ color: baseColor, metalness: isWhite ? 0.75 : 0.4, roughness: 0.35 });

      let geometry;
      switch(type) {
        case 'pawn': geometry = new THREE.CylinderGeometry(0.25, 0.28, 0.6, 16); break;
        case 'rook': geometry = new THREE.BoxGeometry(0.38, 0.72, 0.38); break;
        case 'knight': geometry = new THREE.CylinderGeometry(0.26, 0.3, 0.65, 16); break;
        case 'bishop': geometry = new THREE.ConeGeometry(0.26, 0.78, 16); break;
        case 'queen': geometry = new THREE.CylinderGeometry(0.28, 0.32, 0.88, 16); break;
        case 'king': geometry = new THREE.CylinderGeometry(0.29, 0.33, 0.95, 16); break;
        default: geometry = new THREE.SphereGeometry(0.3, 16, 16);
      }

      const mesh = new THREE.Mesh(geometry, material);
      mesh.userData = { isChessPiece: true, type, color, file: -1, rank: -1 };
      mesh.castShadow = true;

      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.39, 0.13, 16),
        new THREE.MeshStandardMaterial({ color: baseColor, metalness: 0.6 }));
      base.position.y = -0.08;
      mesh.add(base);

      return mesh;
    }
  };

  // ===================== INIT =====================
  function init(canvas) {
    initSounds();

    // Материалы и Three.js настройки (тот же код)
    lightSquareMat = new THREE.MeshStandardMaterial({ color: 0xe8c9a0, roughness: 0.6 });
    darkSquareMat  = new THREE.MeshStandardMaterial({ color: 0x6b3d1e, roughness: 0.7 });
    boardFrameMat  = new THREE.MeshStandardMaterial({ color: 0x3b1a08, roughness: 0.45 });
    boardSideMat   = new THREE.MeshStandardMaterial({ color: 0x2a1205, roughness: 0.55 });

    highlightMoveMat    = new THREE.MeshStandardMaterial({ color: 0x44ff88, transparent: true, opacity: 0.5 });
    highlightSelectMat  = new THREE.MeshStandardMaterial({ color: 0xffdd00, transparent: true, opacity: 0.65 });
    highlightCaptureMat = new THREE.MeshStandardMaterial({ color: 0xff4444, transparent: true, opacity: 0.6 });

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
    controls.dampingFactor = 0.1;

    boardGroup = new THREE.Group();
    piecesGroup = new THREE.Group();
    highlightGroup = new THREE.Group();
    scene.add(boardGroup, piecesGroup, highlightGroup);

    buildBoard();
    buildLighting();
    startRender();

    window.addEventListener('resize', onResize);
  }

  // (buildBoard, buildLighting, sounds, movePiece, highlight и т.д. — оставил как в предыдущей версии)

  function setupStartingPosition() {
    clearPieces();
    boardState = Array(8).fill().map(() => Array(8).fill(null));

    const back = ['rook','knight','bishop','queen','king','bishop','knight','rook'];

    back.forEach((type, file) => {
      const p = placePiece(type, 'white', file, 0);
      boardState[0][file] = p.userData;
    });
    for (let file = 0; file < 8; file++) {
      const p = placePiece('pawn', 'white', file, 1);
      boardState[1][file] = p.userData;
    }

    back.forEach((type, file) => {
      const p = placePiece(type, 'black', file, 7);
      boardState[7][file] = p.userData;
    });
    for (let file = 0; file < 8; file++) {
      const p = placePiece('pawn', 'black', file, 6);
      boardState[6][file] = p.userData;
    }
  }

  // ===================== ОСНОВНАЯ ЛОГИКА КЛИКА =====================
  function handleClick(file, rank) {
    const piece = boardState[rank][file];

    if (selectedPiece) {
      if (selectedPiece.file === file && selectedPiece.rank === rank) {
        // Отмена выбора
        selectedPiece = null;
        clearHighlights();
        return;
      }

      if (ChessLogic.isValidMove(selectedPiece.file, selectedPiece.rank, file, rank)) {
        const isCapture = !!boardState[rank][file];
        Scene3D.movePiece(selectedPiece.file, selectedPiece.rank, file, rank, isCapture);
        ChessLogic.makeMove(selectedPiece.file, selectedPiece.rank, file, rank);
      }

      selectedPiece = null;
      clearHighlights();
    } 
    else if (piece && piece.color === currentTurn) {
      selectedPiece = piece;
      // Подсветка легальных ходов
      const moves = [];
      for (let r = 0; r < 8; r++) {
        for (let f = 0; f < 8; f++) {
          if (ChessLogic.isValidMove(piece.file, piece.rank, f, r)) {
            moves.push({ toFile: f, toRank: r, capture: !!boardState[r][f] });
          }
        }
      }
      highlightLegalMoves(moves);
    }
  }

  // ===================== PUBLIC API =====================
  return {
    init,
    setupStartingPosition,
    movePiece,
    highlightLegalMoves,
    highlightSquare,
    clearHighlights,
    handleClick,           // ← Для обработки тапов/кликов
    get currentTurn() { return currentTurn; }
  };
})();
