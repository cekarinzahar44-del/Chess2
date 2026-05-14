// server/index.js
require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const { setupWebSocket } = require('./websocket');
const db = require('./db');

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// API routes
app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date() }));

app.get('/api/leaderboard', async (req, res) => {
  try {
    const data = await db.getLeaderboard();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/player/:telegramId', async (req, res) => {
  try {
    const stats = await db.getPlayerStats(req.params.telegramId);
    res.json(stats || { error: 'Not found' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Serve index.html for all routes (SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

const PORT = process.env.PORT || 3000;

async function start() {
  await db.initDB();
  setupWebSocket(server);

  server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🌐 WebApp: http://localhost:${PORT}`);
  });
}

start().catch(console.error);
