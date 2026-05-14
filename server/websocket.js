// server/websocket.js
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const chessEngine = require('../engine/chess-engine');
const db = require('./db');

const clients = new Map();      // wsId -> { ws, telegramId, gameId, color }
const waitingQueue = [];         // players waiting for opponent
const gameRooms = new Map();     // gameId -> { white, black, spectators[] }

function setupWebSocket(server) {
  const wss = new WebSocket.Server({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    const wsId = uuidv4();
    clients.set(wsId, { ws, telegramId: null, gameId: null, color: null });

    ws.send(JSON.stringify({ type: 'connected', wsId }));

    ws.on('message', async (data) => {
      try {
        const msg = JSON.parse(data.toString());
        await handleMessage(wsId, ws, msg);
      } catch (e) {
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
      }
    });

    ws.on('close', () => handleDisconnect(wsId));
    ws.on('error', (err) => console.error('WS error:', err));
  });

  // Ping/pong keepalive
  setInterval(() => {
    wss.clients.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) ws.ping();
    });
  }, 30000);

  console.log('✅ WebSocket server initialized');
  return wss;
}

async function handleMessage(wsId, ws, msg) {
  const client = clients.get(wsId);

  switch (msg.type) {

    case 'auth': {
      const { telegramId, username, firstName } = msg;
      client.telegramId = telegramId;
      await db.getOrCreatePlayer(telegramId, username, firstName);
      const stats = await db.getPlayerStats(telegramId);
      ws.send(JSON.stringify({ type: 'auth_ok', stats }));
      break;
    }

    case 'find_game': {
      const { mode = 'multiplayer', difficulty = 'medium' } = msg;

      if (mode === 'ai') {
        await startAiGame(wsId, ws, client, difficulty);
        break;
      }

      // Multiplayer matchmaking
      const opponent = waitingQueue.find(id => id !== wsId);
      if (opponent) {
        waitingQueue.splice(waitingQueue.indexOf(opponent), 1);
        await startMultiplayerGame(wsId, opponent);
      } else {
        if (!waitingQueue.includes(wsId)) waitingQueue.push(wsId);
        ws.send(JSON.stringify({ type: 'waiting', message: 'Ищем соперника...' }));
      }
      break;
    }

    case 'move': {
      const { move, gameId } = msg;
      if (!gameId || client.gameId !== gameId) break;
      await handleMove(wsId, gameId, move);
      break;
    }

    case 'get_moves': {
      const { square, gameId } = msg;
      const moves = chessEngine.getLegalMoves(gameId, square);
      ws.send(JSON.stringify({ type: 'legal_moves', square, moves }));
      break;
    }

    case 'resign': {
      if (client.gameId) await handleResign(wsId, client.gameId);
      break;
    }

    case 'offer_draw': {
      if (client.gameId) broadcastToGame(client.gameId, wsId, { type: 'draw_offer' });
      break;
    }

    case 'accept_draw': {
      if (client.gameId) await endGame(client.gameId, null, 'draw_agreement');
      break;
    }

    case 'get_stats': {
      if (client.telegramId) {
        const stats = await db.getPlayerStats(client.telegramId);
        ws.send(JSON.stringify({ type: 'stats', stats }));
      }
      break;
    }

    case 'leaderboard': {
      const board = await db.getLeaderboard();
      ws.send(JSON.stringify({ type: 'leaderboard', data: board }));
      break;
    }

    case 'cancel_search': {
      const idx = waitingQueue.indexOf(wsId);
      if (idx !== -1) waitingQueue.splice(idx, 1);
      ws.send(JSON.stringify({ type: 'search_cancelled' }));
      break;
    }
  }
}

async function startAiGame(wsId, ws, client, difficulty) {
  const gameId = uuidv4();
  const color = Math.random() > 0.5 ? 'white' : 'black';

  client.gameId = gameId;
  client.color = color;

  const game = await db.createGame(client.telegramId, 'ai');
  chessEngine.createGame(gameId);

  gameRooms.set(gameId, {
    white: color === 'white' ? wsId : 'AI',
    black: color === 'black' ? wsId : 'AI',
    mode: 'ai',
    difficulty,
    spectators: []
  });

  ws.send(JSON.stringify({
    type: 'game_start',
    gameId,
    color,
    mode: 'ai',
    difficulty,
    fen: chessEngine.getFen(gameId),
    opponent: { name: `Stockfish (${difficulty})`, elo: difficulty === 'easy' ? 800 : difficulty === 'medium' ? 1200 : 2000 }
  }));

  // If player is black, AI makes first move
  if (color === 'black') {
    setTimeout(() => makeAiMove(gameId, difficulty), 1000);
  }
}

async function startMultiplayerGame(wsId1, wsId2) {
  const gameId = uuidv4();
  const client1 = clients.get(wsId1);
  const client2 = clients.get(wsId2);

  // Random color assignment
  const [whiteId, blackId] = Math.random() > 0.5 ? [wsId1, wsId2] : [wsId2, wsId1];
  const whiteClient = clients.get(whiteId);
  const blackClient = clients.get(blackId);

  whiteClient.gameId = blackClient.gameId = gameId;
  whiteClient.color = 'white';
  blackClient.color = 'black';

  const game = await db.createGame(whiteClient.telegramId, 'multiplayer');
  await db.joinGame(game.id, blackClient.telegramId);
  chessEngine.createGame(gameId);

  gameRooms.set(gameId, {
    white: whiteId,
    black: blackId,
    dbGameId: game.id,
    mode: 'multiplayer',
    spectators: []
  });

  const [whiteStats, blackStats] = await Promise.all([
    db.getPlayerStats(whiteClient.telegramId),
    db.getPlayerStats(blackClient.telegramId)
  ]);

  const startMsg = (color, opponent) => JSON.stringify({
    type: 'game_start',
    gameId,
    color,
    mode: 'multiplayer',
    fen: chessEngine.getFen(gameId),
    opponent: { name: opponent.first_name || opponent.username, elo: opponent.elo }
  });

  whiteClient.ws.send(startMsg('white', blackStats));
  blackClient.ws.send(startMsg('black', whiteStats));
}

async function handleMove(wsId, gameId, move) {
  const client = clients.get(wsId);
  const room = gameRooms.get(gameId);
  if (!room) return;

  const chess = chessEngine.getGame(gameId);
  if (!chess) return;

  // Validate it's the player's turn
  const turn = chess.turn();
  if ((turn === 'w' && client.color !== 'white') ||
      (turn === 'b' && client.color !== 'black')) {
    client.ws.send(JSON.stringify({ type: 'error', message: 'Not your turn' }));
    return;
  }

  const result = chessEngine.makeMove(gameId, move);
  if (result.error) {
    client.ws.send(JSON.stringify({ type: 'move_error', message: result.error }));
    return;
  }

  // Save move to DB
  if (room.dbGameId) {
    await db.addMove(room.dbGameId, chess.moveNumber(), result.move.san, result.fen);
    await db.updateGameState(room.dbGameId, result.fen, result.pgn, result.isGameOver ? 'finished' : 'active');
  }

  // Broadcast move to all in room
  const moveMsg = {
    type: 'move_made',
    move: result.move,
    fen: result.fen,
    isCheck: result.isCheck,
    isCheckmate: result.isCheckmate,
    isDraw: result.isDraw,
    isGameOver: result.isGameOver,
    turn: result.turn
  };

  broadcastToRoom(gameId, moveMsg);

  if (result.isGameOver) {
    let winner = null;
    if (result.isCheckmate) {
      winner = turn === 'w' ? room.white : room.black;
    }
    await endGame(gameId, winner, result.isCheckmate ? 'checkmate' : 'draw');
    return;
  }

  // AI response
  if (room.mode === 'ai') {
    setTimeout(() => makeAiMove(gameId, room.difficulty), 800 + Math.random() * 700);
  }
}

async function makeAiMove(gameId, difficulty) {
  const room = gameRooms.get(gameId);
  if (!room) return;

  const aiMove = chessEngine.getAiMove(gameId, difficulty);
  if (!aiMove) return;

  const result = chessEngine.makeMove(gameId, { from: aiMove.from, to: aiMove.to, promotion: aiMove.promotion });
  if (result.error) return;

  const moveMsg = {
    type: 'move_made',
    move: result.move,
    fen: result.fen,
    isCheck: result.isCheck,
    isCheckmate: result.isCheckmate,
    isDraw: result.isDraw,
    isGameOver: result.isGameOver,
    turn: result.turn,
    isAi: true
  };

  broadcastToRoom(gameId, moveMsg);

  if (result.isGameOver) {
    const winner = result.isCheckmate ? 'AI' : null;
    await endGame(gameId, winner, result.isCheckmate ? 'checkmate' : 'draw');
  }
}

async function handleResign(wsId, gameId) {
  const room = gameRooms.get(gameId);
  if (!room) return;

  const winner = room.white === wsId ? room.black : room.white;
  await endGame(gameId, winner, 'resignation');
}

async function endGame(gameId, winnerWsId, reason) {
  const room = gameRooms.get(gameId);
  if (!room) return;

  const endMsg = { type: 'game_over', reason, winner: null };

  if (winnerWsId && winnerWsId !== 'AI') {
    const winnerClient = clients.get(winnerWsId);
    if (winnerClient) endMsg.winner = winnerClient.color;
  }
  if (winnerWsId === 'AI') endMsg.winner = 'ai';

  broadcastToRoom(gameId, endMsg);

  // Update player stats
  if (room.mode === 'multiplayer' && room.white !== 'AI' && room.black !== 'AI') {
    const whiteClient = clients.get(room.white);
    const blackClient = clients.get(room.black);

    if (winnerWsId === room.white) {
      if (whiteClient?.telegramId) await db.updatePlayerStats(whiteClient.telegramId, 'win');
      if (blackClient?.telegramId) await db.updatePlayerStats(blackClient.telegramId, 'loss');
    } else if (winnerWsId === room.black) {
      if (whiteClient?.telegramId) await db.updatePlayerStats(whiteClient.telegramId, 'loss');
      if (blackClient?.telegramId) await db.updatePlayerStats(blackClient.telegramId, 'win');
    } else {
      if (whiteClient?.telegramId) await db.updatePlayerStats(whiteClient.telegramId, 'draw');
      if (blackClient?.telegramId) await db.updatePlayerStats(blackClient.telegramId, 'draw');
    }
  }

  // Cleanup
  chessEngine.removeGame(gameId);
  gameRooms.delete(gameId);

  [room.white, room.black].forEach(id => {
    if (id && id !== 'AI') {
      const c = clients.get(id);
      if (c) { c.gameId = null; c.color = null; }
    }
  });
}

function broadcastToRoom(gameId, msg) {
  const room = gameRooms.get(gameId);
  if (!room) return;

  const msgStr = JSON.stringify(msg);
  [room.white, room.black, ...room.spectators].forEach(id => {
    if (!id || id === 'AI') return;
    const c = clients.get(id);
    if (c?.ws.readyState === WebSocket.OPEN) c.ws.send(msgStr);
  });
}

function broadcastToGame(gameId, excludeWsId, msg) {
  const room = gameRooms.get(gameId);
  if (!room) return;

  const msgStr = JSON.stringify(msg);
  [room.white, room.black].forEach(id => {
    if (!id || id === 'AI' || id === excludeWsId) return;
    const c = clients.get(id);
    if (c?.ws.readyState === WebSocket.OPEN) c.ws.send(msgStr);
  });
}

function handleDisconnect(wsId) {
  const client = clients.get(wsId);
  if (client?.gameId) {
    const room = gameRooms.get(client.gameId);
    if (room?.mode === 'multiplayer') {
      broadcastToGame(client.gameId, wsId, {
        type: 'opponent_disconnected',
        message: 'Соперник отключился'
      });
    }
  }

  const qIdx = waitingQueue.indexOf(wsId);
  if (qIdx !== -1) waitingQueue.splice(qIdx, 1);

  clients.delete(wsId);
}

module.exports = { setupWebSocket };
