// engine/chess-engine.js
const { Chess } = require('chess.js');

class ChessEngine {
  constructor() {
    this.games = new Map(); // gameId -> Chess instance
  }

  createGame(gameId, fen = null) {
    const chess = new Chess(fen || undefined);
    this.games.set(gameId, chess);
    return chess;
  }

  getGame(gameId) {
    return this.games.get(gameId);
  }

  removeGame(gameId) {
    this.games.delete(gameId);
  }

  makeMove(gameId, move) {
    const chess = this.games.get(gameId);
    if (!chess) return { error: 'Game not found' };

    try {
      const result = chess.move(move);
      if (!result) return { error: 'Invalid move' };

      return {
        success: true,
        move: result,
        fen: chess.fen(),
        pgn: chess.pgn(),
        isCheck: chess.isCheck(),
        isCheckmate: chess.isCheckmate(),
        isDraw: chess.isDraw(),
        isStalemate: chess.isStalemate(),
        isGameOver: chess.isGameOver(),
        turn: chess.turn(),
        moves: chess.moves({ verbose: true })
      };
    } catch (e) {
      return { error: 'Invalid move: ' + e.message };
    }
  }

  getLegalMoves(gameId, square) {
    const chess = this.games.get(gameId);
    if (!chess) return [];
    return chess.moves({ square, verbose: true });
  }

  getFen(gameId) {
    const chess = this.games.get(gameId);
    return chess ? chess.fen() : null;
  }

  loadFen(gameId, fen) {
    const chess = this.games.get(gameId);
    if (!chess) return false;
    try {
      chess.load(fen);
      return true;
    } catch {
      return false;
    }
  }

  getGameStatus(gameId) {
    const chess = this.games.get(gameId);
    if (!chess) return null;
    return {
      fen: chess.fen(),
      turn: chess.turn(),
      isCheck: chess.isCheck(),
      isCheckmate: chess.isCheckmate(),
      isDraw: chess.isDraw(),
      isStalemate: chess.isStalemate(),
      isGameOver: chess.isGameOver(),
      moveNumber: chess.moveNumber(),
      history: chess.history({ verbose: true })
    };
  }

  // Simple AI move (random from legal moves - fallback when no Stockfish)
  getAiMove(gameId, difficulty = 'medium') {
    const chess = this.games.get(gameId);
    if (!chess) return null;

    const moves = chess.moves({ verbose: true });
    if (moves.length === 0) return null;

    if (difficulty === 'easy') {
      return moves[Math.floor(Math.random() * moves.length)];
    }

    // Medium: prefer captures and checks
    const captures = moves.filter(m => m.captured);
    const checks = moves.filter(m => m.san.includes('+'));

    if (difficulty === 'hard' && checks.length > 0) {
      return checks[Math.floor(Math.random() * checks.length)];
    }
    if (captures.length > 0 && Math.random() > 0.3) {
      return captures[Math.floor(Math.random() * captures.length)];
    }

    return moves[Math.floor(Math.random() * moves.length)];
  }
}

module.exports = new ChessEngine();
