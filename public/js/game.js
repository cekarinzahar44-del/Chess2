// public/js/game.js
\
const Game = (() => {
  let ws = null;
  let wsId = null;
  let gameId = null;
  let myColor = null;
  let currentFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  let selectedSquare = null;
  let legalMoves = [];
  let isMyTurn = false;
  let currentMode = null;
  let currentDifficulty = 'medium';
  let gameActive = false;
  let promotionPending = null;
  let reconnectTimer = null;
  let pingInterval = null;
  let clockWhite = 600, clockBlack = 600;
  let clockInterval = null;
  let capturedPieces = { w: [], b: [] };

  const PIECE_SYMBOLS = {
    wk:'♔',wq:'♕',wr:'♖',wb:'♗',wn:'♘',wp:'♙',
    bk:'♚',bq:'♛',br:'♜',bb:'♝',bn:'♞',bp:'♟'
  };

  // ── WebSocket ────────────────────────────────────────────────────────
  function connect() {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${proto}//${location.host}/ws`;

    ws = new WebSocket(url);

    ws.onopen = () => {
      console.log('WS connected');
      if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
      // Auth with Telegram data
      const user = window.Telegram?.WebApp?.initDataUnsafe?.user;
      if (user) {
        send({ type: 'auth', telegramId: user.id, username: user.username, firstName: user.first_name });
      }
    };

    ws.onmessage = (e) => {
      try { handleMessage(JSON.parse(e.data)); }
      catch(err) { console.error('WS parse error', err); }
    };

    ws.onclose = () => {
      console.log('WS closed, reconnecting...');
      reconnectTimer = setTimeout(connect, 3000);
    };

    ws.onerror = (e) => console.error('WS error', e);
  }

  function send(msg) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }

  // ── Message Handler ───────────────────────────────────────────────────
  function handleMessage(msg) {
    switch (msg.type) {
      case 'connected':
        wsId = msg.wsId;
        break;

      case 'auth_ok':
        UI.updatePlayerStats(msg.stats);
        break;

      case 'waiting':
        UI.showWaitingModal();
        break;

      case 'game_start':
        onGameStart(msg);
        break;

      case 'move_made':
        onMoveMade(msg);
        break;

      case 'legal_moves':
        onLegalMoves(msg);
        break;

      case 'game_over':
        onGameOver(msg);
        break;

      case 'draw_offer':
        UI.showDrawOffer();
        break;

      case 'opponent_disconnected':
        UI.showStatus('Соперник отключился', 'warning');
        break;

      case 'error':
      case 'move_error':
        console.warn('Server error:', msg.message);
        UI.showStatus(msg.message, 'error');
        break;

      case 'stats':
        UI.updatePlayerStats(msg.stats);
        break;

      case 'leaderboard':
        UI.displayLeaderboard(msg.data);
        break;

      case 'search_cancelled':
        UI.closeModal('waiting-modal');
        break;
    }
  }

  // ── Game Start ────────────────────────────────────────────────────────
  function onGameStart(msg) {
    gameId = msg.gameId;
    myColor = msg.color;
    currentMode = msg.mode;
    currentDifficulty = msg.difficulty;
    gameActive = true;
    capturedPieces = { w: [], b: [] };
    currentFen = msg.fen;

    UI.closeModal('waiting-modal');
    UI.showGameScreen();

    // Set up board orientation
    if (myColor === 'white') {
      Scene3D.rotateCameraToWhite();
    } else {
      Scene3D.rotateCameraToBlack();
    }

    // Draw initial position
    drawPositionFromFen(msg.fen);

    // Update HUD
    UI.setOpponent(msg.opponent);
    UI.setMyColor(myColor);

    // Turn
    isMyTurn = (myColor === 'white');
    updateTurnUI();

    // Start clock
    startClock();
  }

  // ── Move Made ─────────────────────────────────────────────────────────
  function onMoveMade(msg) {
    const { move, fen, isCheck, isCheckmate, turn, isAi } = msg;

    // Clear selection
    selectedSquare = null;
    legalMoves = [];
    Scene3D.clearHighlights();

    // Animate piece move
    const fromFile = fileFromAlg(move.from);
    const fromRank = rankFromAlg(move.from);
    const toFile   = fileFromAlg(move.to);
    const toRank   = rankFromAlg(move.to);

    // Handle capture
    if (move.captured) {
      Scene3D.removePiece(toFile, toRank);
      trackCapture(move.captured, move.color === 'w' ? 'w' : 'b');
    }

    // Animate
    const animFn = Scene3D.animatePiece(fromFile, fromRank, toFile, toRank, () => {
      // Handle special moves after animation
      if (move.flags) {
        // En passant
        if (move.flags.includes('e')) {
          const epRank = move.color === 'w' ? toRank - 1 : toRank + 1;
          Scene3D.removePiece(toFile, epRank);
        }
        // Castling
        if (move.flags.includes('k') || move.flags.includes('q')) {
          handleCastlingAnimation(move);
        }
        // Promotion
        if (move.flags.includes('p')) {
          Scene3D.removePiece(toFile, toRank);
          Scene3D.placePiece(move.promotion || 'q', move.color, toFile, toRank);
        }
      }
      currentFen = fen;
    });

    if (animFn) Scene3D.addAnimation(animFn);

    // Check highlight
    if (isCheck) {
      const kingPos = findKing(fen, turn);
      if (kingPos) Scene3D.highlightSquare(kingPos.file, kingPos.rank, 'check');
    }

    // Update clock
    updateClock(turn);

    // Update turn
    isMyTurn = (turn === 'w') ? myColor === 'white' : myColor === 'black';
    updateTurnUI();

    // Update captured display
    UI.updateCaptured(capturedPieces);
  }

  function handleCastlingAnimation(move) {
    const isKingside = move.flags.includes('k');
    const rank = move.color === 'w' ? 0 : 7;
    const rookFromFile = isKingside ? 7 : 0;
    const rookToFile   = isKingside ? 5 : 3;
    const animFn = Scene3D.animatePiece(rookFromFile, rank, rookToFile, rank, null);
    if (animFn) Scene3D.addAnimation(animFn);
  }

  function onLegalMoves(msg) {
    legalMoves = msg.moves;
    Scene3D.clearHighlights();
    if (selectedSquare) {
      Scene3D.highlightSquare(selectedSquare.file, selectedSquare.rank, 'select');
    }
    legalMoves.forEach(m => {
      const f = fileFromAlg(m.to);
      const r = rankFromAlg(m.to);
      const type = m.captured ? 'capture' : 'move';
      Scene3D.highlightSquare(f, r, type);
    });
  }

  // ── Game Over ─────────────────────────────────────────────────────────
  function onGameOver(msg) {
    gameActive = false;
    stopClock();
    Scene3D.clearHighlights();

    let title, icon, desc;
    if (msg.winner === myColor) {
      title = 'Победа!'; icon = '👑'; desc = getReasonText(msg.reason);
    } else if (msg.winner === null || msg.winner === undefined) {
      title = 'Ничья'; icon = '🤝'; desc = getReasonText(msg.reason);
    } else {
      title = 'Поражение'; icon = '💀'; desc = getReasonText(msg.reason);
    }

    setTimeout(() => UI.showGameOver(title, icon, desc, msg.winner), 1000);
  }

  function getReasonText(reason) {
    const reasons = {
      checkmate: 'Мат',
      resignation: 'Соперник сдался',
      draw_agreement: 'Ничья по соглашению',
      stalemate: 'Пат',
      insufficient_material: 'Недостаточно материала',
      fifty_moves: 'Правило 50 ходов',
      repetition: 'Троекратное повторение'
    };
    return reasons[reason] || reason || '';
  }

  // ── Click Handler ─────────────────────────────────────────────────────
  function handleSquareClick(file, rank) {
    if (!gameActive || !isMyTurn) return;

    // Promotion pending
    if (promotionPending) return;

    const clickedSquare = { file, rank };

    // If square with legal move — make the move
    const legalMove = legalMoves.find(m =>
      fileFromAlg(m.to) === file && rankFromAlg(m.to) === rank
    );

    if (legalMove && selectedSquare) {
      // Check for promotion
      if (legalMove.piece === 'p' && (rank === 7 || rank === 0)) {
        showPromotion(selectedSquare, clickedSquare);
        return;
      }
      makeMove(selectedSquare, clickedSquare);
      selectedSquare = null;
      legalMoves = [];
      Scene3D.clearHighlights();
      return;
    }

    // Select piece
    const fenPiece = getPieceOnSquare(currentFen, file, rank);
    if (fenPiece && fenPiece.color === (myColor === 'white' ? 'w' : 'b')) {
      selectedSquare = clickedSquare;
      send({ type: 'get_moves', square: algFromCoords(file, rank), gameId });
    } else {
      selectedSquare = null;
      legalMoves = [];
      Scene3D.clearHighlights();
    }
  }

  function makeMove(from, to, promotion = null) {
    const moveData = {
      from: algFromCoords(from.file, from.rank),
      to: algFromCoords(to.file, to.rank)
    };
    if (promotion) moveData.promotion = promotion;
    send({ type: 'move', move: moveData, gameId });
  }

  function showPromotion(from, to) {
    promotionPending = { from, to };
    const color = myColor === 'white' ? '♕♖♗♘' : '♛♜♝♞';
    const pieces = ['q', 'r', 'b', 'n'];
    const symbols = myColor === 'white'
      ? ['♕', '♖', '♗', '♘']
      : ['♛', '♜', '♝', '♞'];

    const container = document.getElementById('promotion-pieces');
    container.innerHTML = '';
    pieces.forEach((p, i) => {
      const btn = document.createElement('button');
      btn.className = 'promo-btn';
      btn.textContent = symbols[i];
      btn.onclick = () => {
        makeMove(promotionPending.from, promotionPending.to, p);
        promotionPending = null;
        UI.closeModal('promotion-modal');
      };
      container.appendChild(btn);
    });
    document.getElementById('promotion-modal').classList.remove('hidden');
  }

  // ── FEN Helpers ───────────────────────────────────────────────────────
  function drawPositionFromFen(fen) {
    Scene3D.clearPieces();
    const rows = fen.split(' ')[0].split('/');
    for (let rank = 7; rank >= 0; rank--) {
      const row = rows[7 - rank];
      let file = 0;
      for (const ch of row) {
        if (/\d/.test(ch)) {
          file += parseInt(ch);
        } else {
          const color = ch === ch.toUpperCase() ? 'w' : 'b';
          const type = ch.toLowerCase();
          Scene3D.placePiece(type, color, file, rank);
          file++;
        }
      }
    }
  }

  function getPieceOnSquare(fen, file, rank) {
    const rows = fen.split(' ')[0].split('/');
    const row = rows[7 - rank];
    let f = 0;
    for (const ch of row) {
      if (/\d/.test(ch)) {
        f += parseInt(ch);
      } else {
        if (f === file) {
          return { type: ch.toLowerCase(), color: ch === ch.toUpperCase() ? 'w' : 'b' };
        }
        f++;
      }
    }
    return null;
  }

  function findKing(fen, turn) {
    const kingChar = turn === 'w' ? 'K' : 'k';
    const rows = fen.split(' ')[0].split('/');
    for (let rank = 7; rank >= 0; rank--) {
      const row = rows[7 - rank];
      let file = 0;
      for (const ch of row) {
        if (/\d/.test(ch)) file += parseInt(ch);
        else {
          if (ch === kingChar) return { file, rank };
          file++;
        }
      }
    }
    return null;
  }

  function fileFromAlg(sq) { return sq.charCodeAt(0) - 97; }
  function rankFromAlg(sq) { return parseInt(sq[1]) - 1; }
  function algFromCoords(file, rank) { return String.fromCharCode(97 + file) + (rank + 1); }

  function trackCapture(piece, capturedBy) {
    const side = capturedBy === 'w' ? 'w' : 'b';
    capturedPieces[side].push(piece);
  }

  // ── Clock ─────────────────────────────────────────────────────────────
  function startClock() {
    clockWhite = 600; clockBlack = 600;
    stopClock();
    clockInterval = setInterval(() => {
      if (!gameActive) return;
      const isTurnW = currentFen.split(' ')[1] === 'w';
      if (isTurnW) clockWhite = Math.max(0, clockWhite - 1);
      else clockBlack = Math.max(0, clockBlack - 1);
      updateClockDisplay();
    }, 1000);
  }

  function stopClock() {
    if (clockInterval) { clearInterval(clockInterval); clockInterval = null; }
  }

  function updateClock(nextTurn) {
    // handled by interval
  }

  function updateClockDisplay() {
    const fmt = t => `${Math.floor(t/60).toString().padStart(2,'0')}:${(t%60).toString().padStart(2,'0')}`;
    const wEl = document.getElementById('clock-white');
    const bEl = document.getElementById('clock-black');
    if (wEl) { wEl.textContent = fmt(clockWhite); wEl.classList.toggle('urgent', clockWhite < 30); }
    if (bEl) { bEl.textContent = fmt(clockBlack); bEl.classList.toggle('urgent', clockBlack < 30); }
  }

  // ── UI Helpers ────────────────────────────────────────────────────────
  function updateTurnUI() {
    const turn = currentFen.split(' ')[1];
    const isWhiteTurn = turn === 'w';

    document.getElementById('hud-self').classList.toggle('active',
      (myColor === 'white' && isWhiteTurn) || (myColor === 'black' && !isWhiteTurn));
    document.getElementById('hud-opponent').classList.toggle('active',
      (myColor === 'white' && !isWhiteTurn) || (myColor === 'black' && isWhiteTurn));

    const statusEl = document.getElementById('status-text');
    if (statusEl) {
      if (isMyTurn) {
        statusEl.textContent = 'Ваш ход';
        statusEl.className = '';
      } else {
        statusEl.textContent = 'Ход соперника';
        statusEl.className = '';
      }
    }
  }

  // ── Public Actions ────────────────────────────────────────────────────
  function findGame(mode, difficulty) {
    currentMode = mode;
    currentDifficulty = difficulty;
    send({ type: 'find_game', mode, difficulty });
  }

  function cancelSearch() {
    send({ type: 'cancel_search' });
    UI.closeModal('waiting-modal');
  }

  function offerDraw() {
    if (!gameActive) return;
    send({ type: 'offer_draw', gameId });
  }

  function acceptDraw() {
    send({ type: 'accept_draw', gameId });
    UI.closeModal('draw-modal');
  }

  function resign() {
    if (!gameActive) return;
    send({ type: 'resign', gameId });
    gameActive = false;
  }

  function rotateCamera() {
    Scene3D.flipCamera();
  }

  function requestStats() { send({ type: 'get_stats' }); }
  function requestLeaderboard() { send({ type: 'leaderboard' }); }

  // ── Init ──────────────────────────────────────────────────────────────
  function init() {
    connect();

    // Canvas click handler
    const canvas = document.getElementById('chess-canvas');
    let touchStartTime = 0;
    let touchMoved = false;
    let touchStartX = 0, touchStartY = 0;

    canvas.addEventListener('touchstart', (e) => {
      touchStartTime = Date.now();
      touchMoved = false;
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }, { passive: true });

    canvas.addEventListener('touchmove', (e) => {
      const dx = e.touches[0].clientX - touchStartX;
      const dy = e.touches[0].clientY - touchStartY;
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) touchMoved = true;
    }, { passive: true });

    canvas.addEventListener('touchend', (e) => {
      if (touchMoved) return;
      if (Date.now() - touchStartTime > 500) return; // long press = camera

      e.preventDefault();
      const sq = Scene3D.getClickedSquare(e.changedTouches[0]);
      if (sq) handleSquareClick(sq.file, sq.rank);
    });

    canvas.addEventListener('click', (e) => {
      const sq = Scene3D.getClickedSquare(e);
      if (sq) handleSquareClick(sq.file, sq.rank);
    });
  }

  return {
    init,
    findGame,
    cancelSearch,
    offerDraw,
    acceptDraw,
    resign,
    rotateCamera,
    requestStats,
    requestLeaderboard,
    handleSquareClick
  };
})();
window.Game = Game;
