// game.js — Professional game logic with clocks, eval, move history

const Game = (() => {
  let ws = null, wsId = null;
  let gameId = null, myColor = null;
  let currentFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  let selectedSquare = null, legalMoves = [];
  let isMyTurn = false, gameActive = false;
  let currentMode = null, currentDifficulty = 'medium', timeControl = 'rapid';
  let promotionPending = null;
  let reconnectTimer = null;
  let moveHistory = [];
  let moveCount = 0;
  let capturedByWhite = [], capturedByBlack = [];

  // Clocks
  let clockWhite = 600, clockBlack = 600, clockInterval = null;
  const TIME_CONTROLS = { blitz: 180, rapid: 600, classical: 1800 };

  // ── WebSocket ──────────────────────────────────────────────────────────
  function connect() {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${proto}//${location.host}/ws`);
    ws.onopen = () => {
      clearTimeout(reconnectTimer);
      const user = window.Telegram?.WebApp?.initDataUnsafe?.user;
      if (user) _send({ type:'auth', telegramId:user.id, username:user.username, firstName:user.first_name });
    };
    ws.onmessage = e => { try { _handle(JSON.parse(e.data)); } catch(err) { console.error(err); } };
    ws.onclose   = () => { reconnectTimer = setTimeout(connect, 3000); };
    ws.onerror   = e => console.error('WS', e);
  }

  function _send(msg) {
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  }

  // ── Message Handler ────────────────────────────────────────────────────
  function _handle(msg) {
    switch (msg.type) {
      case 'connected':   wsId = msg.wsId; break;
      case 'auth_ok':     UI.updateProfile(msg.stats); break;
      case 'waiting':     UI.showWaiting(); break;
      case 'game_start':  _onGameStart(msg); break;
      case 'move_made':   _onMoveMade(msg); break;
      case 'legal_moves': _onLegalMoves(msg); break;
      case 'game_over':   _onGameOver(msg); break;
      case 'draw_offer':  UI.showDrawOffer(); break;
      case 'stats':       UI.updateProfile(msg.stats); break;
      case 'leaderboard': UI.displayLeaderboard(msg.data); break;
      case 'opponent_disconnected':
        UI.toast('Соперник отключился', 'Ожидаем переподключения...');
        break;
      case 'search_cancelled':
        UI.closeOverlay('modal-waiting');
        break;
    }
  }

  // ── Game Start ─────────────────────────────────────────────────────────
  function _onGameStart(msg) {
    gameId = msg.gameId;
    myColor = msg.color;
    currentMode = msg.mode;
    gameActive = true;
    moveHistory = [];
    moveCount = 0;
    capturedByWhite = [];
    capturedByBlack = [];
    currentFen = msg.fen;

    UI.hideWaiting();
    UI.showGameScreen();
    UI.clearMoves();
    UI.setOpponent(msg.opponent);

    // Camera orientation
    if (myColor === 'white') Scene3D.rotateCameraToWhite();
    else Scene3D.rotateCameraToBlack();

    // Draw position
    _drawFen(msg.fen);

    // Clocks
    const duration = TIME_CONTROLS[timeControl] || 600;
    clockWhite = clockBlack = duration;
    _startClock();

    // Turn
    isMyTurn = myColor === 'white';
    UI.setTurn(isMyTurn, false);
    UI.setActivePlayer(isMyTurn ? 'self' : 'opp');
  }

  // ── Move Made ──────────────────────────────────────────────────────────
  function _onMoveMade(msg) {
    const { move, fen, isCheck, isCheckmate, isDraw, isGameOver, turn, isAi } = msg;

    selectedSquare = null;
    legalMoves = [];
    Scene3D.clearHighlights();

    const fromFile = _file(move.from), fromRank = _rank(move.from);
    const toFile   = _file(move.to),   toRank   = _rank(move.to);

    // Remove captured piece
    if (move.captured) {
      if (move.flags?.includes('e')) {
        const epRank = move.color === 'w' ? toRank - 1 : toRank + 1;
        Scene3D.removePiece(toFile, epRank);
      } else {
        Scene3D.removePiece(toFile, toRank);
      }
      // Track captures
      if (move.color === 'w') capturedByWhite.push(move.captured);
      else capturedByBlack.push(move.captured);
      UI.updateCaptured('self', move.color === (myColor==='white'?'w':'b') ? capturedByWhite : capturedByBlack);
      UI.updateCaptured('opp',  move.color === (myColor==='white'?'w':'b') ? capturedByBlack : capturedByWhite);
    }

    // Animate move
    const settings = UI.getSettings();
    const anim = settings.anim !== false
      ? Scene3D.animatePiece(fromFile, fromRank, toFile, toRank, () => _afterMove(move, fen))
      : null;
    if (anim) Scene3D.addAnimation(anim);
    else _afterMove(move, fen);

    // Castling rook
    if (move.flags?.includes('k') || move.flags?.includes('q')) {
      const rank = move.color === 'w' ? 0 : 7;
      const isKs = move.flags.includes('k');
      const ra   = Scene3D.animatePiece(isKs?7:0, rank, isKs?5:3, rank, null);
      if (ra) Scene3D.addAnimation(ra);
    }

    // Record move
    moveCount++;
    const halfMove = move.color === 'w' ? Math.ceil(moveCount/2) : Math.ceil(moveCount/2);
    moveHistory.push(move.san);
    if (move.color === 'w') UI.addMove(Math.ceil(moveCount/2), move.san, undefined);
    else UI.addMove(Math.ceil(moveCount/2), undefined, move.san);

    // Check highlight
    if (isCheck) {
      const kPos = _findKing(fen, turn);
      if (kPos) Scene3D.highlightSquare(kPos.file, kPos.rank, 'check');
    }

    currentFen = fen;
    isMyTurn = turn === (myColor === 'white' ? 'w' : 'b');
    UI.setTurn(isMyTurn, isCheck);
    UI.setActivePlayer(isMyTurn ? 'self' : 'opp');
    _updateClock(turn);

    // Mock eval update
    if (settings.eval !== false) {
      const mockEval = (Math.random() - 0.48) * 4;
      UI.updateEval(myColor === 'white' ? mockEval : -mockEval);
    }

    // Haptic
    if (!isAi) window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light');
  }

  function _afterMove(move, fen) {
    // Promotion
    if (move.flags?.includes('p')) {
      Scene3D.removePiece(_file(move.to), _rank(move.to));
      Scene3D.placePiece(move.promotion || 'q', move.color, _file(move.to), _rank(move.to));
    }
  }

  function _onLegalMoves(msg) {
    legalMoves = msg.moves;
    Scene3D.clearHighlights();
    if (selectedSquare) Scene3D.highlightSquare(selectedSquare.file, selectedSquare.rank, 'select');
    legalMoves.forEach(m => {
      const type = m.captured ? 'capture' : 'move';
      Scene3D.highlightSquare(_file(m.to), _rank(m.to), type);
    });
  }

  // ── Game Over ──────────────────────────────────────────────────────────
  function _onGameOver(msg) {
    gameActive = false;
    _stopClock();
    Scene3D.clearHighlights();

    let outcome;
    if (msg.winner === null || msg.winner === undefined) outcome = 'draw';
    else outcome = msg.winner === myColor ? 'win' : 'loss';

    const eloChange = outcome === 'win' ? 15 : outcome === 'loss' ? -10 : 3;

    // Achievements
    if (outcome === 'win') {
      UI.unlockAchievement('first_win');
      if (moveHistory.length < 40) UI.unlockAchievement('fast_win');
    }

    // Save history
    const user = window.Telegram?.WebApp?.initDataUnsafe?.user;
    UI.saveGameToHistory({
      outcome, reason: msg.reason, eloChange,
      moves: moveHistory.length,
      opponent: document.getElementById('opp-name')?.textContent || 'Соперник',
      mode: currentMode
    });

    setTimeout(() => {
      UI.showResult({ outcome, reason: msg.reason, eloChange, moves: moveHistory.length });
    }, 800);
  }

  // ── Click Handler ──────────────────────────────────────────────────────
  function handleSquareClick(file, rank) {
    if (!gameActive || !isMyTurn || promotionPending) return;

    const legal = legalMoves.find(m => _file(m.to)===file && _rank(m.to)===rank);

    if (legal && selectedSquare) {
      // Check promotion
      if (legal.piece === 'p' && (rank === 7 || rank === 0)) {
        promotionPending = { from: selectedSquare, to: { file, rank } };
        UI.showPromotion(myColor === 'white' ? 'w' : 'b', (promo) => {
          _send({ type:'move', move:{ from:_alg(promotionPending.from.file, promotionPending.from.rank), to:_alg(file,rank), promotion:promo }, gameId });
          promotionPending = null;
        });
        return;
      }
      _send({ type:'move', move:{ from:_alg(selectedSquare.file,selectedSquare.rank), to:_alg(file,rank) }, gameId });
      selectedSquare = null; legalMoves = [];
      Scene3D.clearHighlights();
      return;
    }

    const piece = _getPieceAt(currentFen, file, rank);
    if (piece && piece.color === (myColor==='white'?'w':'b')) {
      selectedSquare = { file, rank };
      _send({ type:'get_moves', square:_alg(file,rank), gameId });
      window.Telegram?.WebApp?.HapticFeedback?.selectionChanged();
    } else {
      selectedSquare = null; legalMoves = [];
      Scene3D.clearHighlights();
    }
  }

  // ── Clock ──────────────────────────────────────────────────────────────
  function _startClock() {
    _stopClock();
    clockInterval = setInterval(() => {
      if (!gameActive) return;
      const turn = currentFen.split(' ')[1];
      if (turn === 'w') clockWhite = Math.max(0, clockWhite - 1);
      else clockBlack = Math.max(0, clockBlack - 1);
      _renderClocks();
      if (clockWhite === 0 || clockBlack === 0) _stopClock();
    }, 1000);
  }

  function _stopClock() {
    clearInterval(clockInterval); clockInterval = null;
  }

  function _updateClock(nextTurn) {} // handled by interval

  function _renderClocks() {
    const isSelfWhite = myColor === 'white';
    UI.updateClock('self', isSelfWhite ? clockWhite : clockBlack);
    UI.updateClock('opp',  isSelfWhite ? clockBlack : clockWhite);
  }

  // ── FEN Helpers ────────────────────────────────────────────────────────
  function _drawFen(fen) {
    Scene3D.clearPieces();
    const rows = fen.split(' ')[0].split('/');
    for (let rank = 7; rank >= 0; rank--) {
      const row = rows[7 - rank];
      let file = 0;
      for (const ch of row) {
        if (/\d/.test(ch)) { file += +ch; continue; }
        Scene3D.placePiece(ch.toLowerCase(), ch===ch.toUpperCase()?'w':'b', file, rank);
        file++;
      }
    }
  }

  function _getPieceAt(fen, file, rank) {
    const rows = fen.split(' ')[0].split('/');
    const row = rows[7 - rank]; let f = 0;
    for (const ch of row) {
      if (/\d/.test(ch)) { f += +ch; continue; }
      if (f === file) return { type: ch.toLowerCase(), color: ch===ch.toUpperCase()?'w':'b' };
      f++;
    }
    return null;
  }

  function _findKing(fen, turn) {
    const kingCh = turn === 'w' ? 'K' : 'k';
    const rows = fen.split(' ')[0].split('/');
    for (let rank = 7; rank >= 0; rank--) {
      const row = rows[7-rank]; let file = 0;
      for (const ch of row) {
        if (/\d/.test(ch)) { file += +ch; continue; }
        if (ch === kingCh) return { file, rank };
        file++;
      }
    }
    return null;
  }

  function _file(sq) { return sq.charCodeAt(0) - 97; }
  function _rank(sq) { return parseInt(sq[1]) - 1; }
  function _alg(f,r) { return String.fromCharCode(97+f) + (r+1); }

  // ── Public actions ─────────────────────────────────────────────────────
  function findGame(mode, difficulty, tc) {
    currentMode = mode;
    currentDifficulty = difficulty || 'medium';
    if (tc) timeControl = tc;
    _send({ type:'find_game', mode, difficulty });
    if (mode === 'ai') {} // game starts immediately
  }

  function cancelSearch() { _send({ type:'cancel_search' }); }
  function offerDraw()    { if (gameActive) _send({ type:'offer_draw', gameId }); }
  function acceptDraw()   { _send({ type:'accept_draw', gameId }); UI.closeOverlay('modal-draw'); }

  function resign() {
    if (!gameActive) return;
    _send({ type:'resign', gameId });
    gameActive = false;
  }

  function requestStats()       { _send({ type:'get_stats' }); }
  function requestLeaderboard() { _send({ type:'leaderboard' }); }

  function init() {
    connect();
    const canvas = document.getElementById('chess-canvas');

    // Touch handling — tap only, no drag
    let tx=0, ty=0, tt=0, moved=false;
    canvas.addEventListener('touchstart', e => {
      tx=e.touches[0].clientX; ty=e.touches[0].clientY;
      tt=Date.now(); moved=false;
    }, { passive:true });
    canvas.addEventListener('touchmove', e => {
      if (Math.abs(e.touches[0].clientX-tx)>10||Math.abs(e.touches[0].clientY-ty)>10) moved=true;
    }, { passive:true });
    canvas.addEventListener('touchend', e => {
      if (moved || Date.now()-tt>500) return;
      const t = e.changedTouches[0];
      const sq = Scene3D.getClickedSquare(t.clientX, t.clientY);
      if (sq) handleSquareClick(sq.file, sq.rank);
    }, { passive:true });

    canvas.addEventListener('click', e => {
      if (e.pointerType==='touch') return;
      const sq = Scene3D.getClickedSquare(e.clientX, e.clientY);
      if (sq) handleSquareClick(sq.file, sq.rank);
    });
  }

  return {
    init, findGame, cancelSearch,
    offerDraw, acceptDraw, resign,
    handleSquareClick,
    requestStats, requestLeaderboard
  };
})();
