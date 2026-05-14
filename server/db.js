// server/db.js
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false
});

async function initDB() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS games (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        white_player BIGINT,
        black_player BIGINT,
        fen TEXT DEFAULT 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        pgn TEXT DEFAULT '',
        status VARCHAR(20) DEFAULT 'waiting',
        mode VARCHAR(20) DEFAULT 'multiplayer',
        winner BIGINT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS players (
        telegram_id BIGINT PRIMARY KEY,
        username VARCHAR(100),
        first_name VARCHAR(100),
        elo INTEGER DEFAULT 1200,
        wins INTEGER DEFAULT 0,
        losses INTEGER DEFAULT 0,
        draws INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS game_moves (
        id SERIAL PRIMARY KEY,
        game_id UUID REFERENCES games(id) ON DELETE CASCADE,
        move_number INTEGER,
        move VARCHAR(10),
        fen_after TEXT,
        timestamp TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('✅ Database initialized');
  } finally {
    client.release();
  }
}

async function getOrCreatePlayer(telegramId, username, firstName) {
  const res = await pool.query(
    `INSERT INTO players (telegram_id, username, first_name)
     VALUES ($1, $2, $3)
     ON CONFLICT (telegram_id) DO UPDATE
       SET username = EXCLUDED.username, first_name = EXCLUDED.first_name
     RETURNING *`,
    [telegramId, username, firstName]
  );
  return res.rows[0];
}

async function createGame(whiteId, mode = 'multiplayer') {
  const res = await pool.query(
    `INSERT INTO games (white_player, mode) VALUES ($1, $2) RETURNING *`,
    [whiteId, mode]
  );
  return res.rows[0];
}

async function joinGame(gameId, blackId) {
  const res = await pool.query(
    `UPDATE games SET black_player = $1, status = 'active', updated_at = NOW()
     WHERE id = $2 AND black_player IS NULL RETURNING *`,
    [blackId, gameId]
  );
  return res.rows[0];
}

async function updateGameState(gameId, fen, pgn, status, winner = null) {
  const res = await pool.query(
    `UPDATE games SET fen = $1, pgn = $2, status = $3, winner = $4, updated_at = NOW()
     WHERE id = $5 RETURNING *`,
    [fen, pgn, status, winner, gameId]
  );
  return res.rows[0];
}

async function addMove(gameId, moveNumber, move, fenAfter) {
  await pool.query(
    `INSERT INTO game_moves (game_id, move_number, move, fen_after) VALUES ($1, $2, $3, $4)`,
    [gameId, moveNumber, move, fenAfter]
  );
}

async function getGame(gameId) {
  const res = await pool.query(`SELECT * FROM games WHERE id = $1`, [gameId]);
  return res.rows[0];
}

async function getPlayerStats(telegramId) {
  const res = await pool.query(`SELECT * FROM players WHERE telegram_id = $1`, [telegramId]);
  return res.rows[0];
}

async function getLeaderboard() {
  const res = await pool.query(
    `SELECT telegram_id, username, first_name, elo, wins, losses, draws
     FROM players ORDER BY elo DESC LIMIT 10`
  );
  return res.rows;
}

async function updatePlayerStats(telegramId, result) {
  const eloChange = result === 'win' ? 15 : result === 'loss' ? -10 : 3;
  await pool.query(
    `UPDATE players SET
       wins = wins + $1,
       losses = losses + $2,
       draws = draws + $3,
       elo = GREATEST(800, elo + $4)
     WHERE telegram_id = $5`,
    [
      result === 'win' ? 1 : 0,
      result === 'loss' ? 1 : 0,
      result === 'draw' ? 1 : 0,
      eloChange,
      telegramId
    ]
  );
}

module.exports = {
  pool,
  initDB,
  getOrCreatePlayer,
  createGame,
  joinGame,
  updateGameState,
  addMove,
  getGame,
  getPlayerStats,
  getLeaderboard,
  updatePlayerStats
};
