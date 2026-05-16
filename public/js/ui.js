// public/js/ui.js
const UI = (() => {
  let selectedDifficulty = 'medium';
  let playerStats = null;
  let currentBgIndex = 0;

  // ── Screens ────────────────────────────────────────────────────────────
  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    const el = document.getElementById(id);
    if (el) el.classList.remove('hidden');
  }

  function showMenu() {
    showScreen('main-menu');
    Game.requestStats();
    setupMainButton(false);
  }

  function showModeSelect() {
    showScreen('mode-select');
    setupDifficultyButtons();
    setupMainButton(false);
  }

  function showGameScreen() {
    showScreen('game-screen');
    setupMainButton(false);
  }

  function showWaitingModal() {
    document.getElementById('waiting-modal').classList.remove('hidden');
  }

  // ── Mode Select ────────────────────────────────────────────────────────
  function setupDifficultyButtons() {
    const btns = document.querySelectorAll('.diff-btn');
    btns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        btns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedDifficulty = btn.dataset.diff;
      });
    });
  }

  function selectMode(mode) {
    if (mode === 'ai') {
      Game.findGame('ai', selectedDifficulty);
    } else {
      Game.findGame('multiplayer', null);
      showWaitingModal();
    }
  }

  // ── Player HUD ─────────────────────────────────────────────────────────
  function setMyColor(color) {
    const selfName = document.getElementById('self-name');
    const selfElo  = document.getElementById('self-elo');
    const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;

    if (selfName && tgUser) selfName.textContent = tgUser.first_name || tgUser.username || 'Вы';
    if (selfElo && playerStats) selfElo.textContent = `ELO ${playerStats.elo}`;

    // Color indicator
    const avatar = document.querySelector('#hud-self .hud-avatar');
    if (avatar) avatar.textContent = color === 'white' ? '♚' : '♔';
  }

  function setOpponent(opponent) {
    const nameEl = document.getElementById('opponent-name');
    const eloEl  = document.getElementById('opponent-elo');
    if (nameEl) nameEl.textContent = opponent?.name || 'Соперник';
    if (eloEl)  eloEl.textContent  = `ELO ${opponent?.elo || '—'}`;
  }

  function updatePlayerStats(stats) {
    if (!stats) return;
    playerStats = stats;
    const nameEl = document.getElementById('player-name');
    const eloEl  = document.getElementById('player-elo');
    const avatarEl = document.getElementById('player-avatar');

    if (nameEl) nameEl.textContent = stats.first_name || stats.username || 'Игрок';
    if (eloEl)  eloEl.textContent  = `ELO: ${stats.elo || 1200}`;
    if (avatarEl) {
      const name = stats.first_name || stats.username || '?';
      avatarEl.textContent = name[0].toUpperCase();
    }

    // Update in-game HUD too
    const selfElo = document.getElementById('self-elo');
    if (selfElo) selfElo.textContent = `ELO ${stats.elo}`;
  }

  function updateCaptured(captured) { return; // hidden in premium UI
    const pieceMap = {
      p:'♟',r:'♜',n:'♞',b:'♝',q:'♛',k:'♚',
      P:'♙',R:'♖',N:'♘',B:'♗',Q:'♕',K:'♔'
    };
    const whiteCaptures = document.getElementById('captured-white');
    const blackCaptures = document.getElementById('captured-black');

    if (whiteCaptures) {
      whiteCaptures.innerHTML = (captured.w || []).map(p =>
        `<span class="captured-piece">${pieceMap[p] || p}</span>`
      ).join('');
    }
    if (blackCaptures) {
      blackCaptures.innerHTML = (captured.b || []).map(p =>
        `<span class="captured-piece">${pieceMap[p.toUpperCase()] || p}</span>`
      ).join('');
    }
  }

  // ── Status ─────────────────────────────────────────────────────────────
  function showStatus(text, type = 'info') {
    const statusEl = document.getElementById('status-text');
    if (!statusEl) return;
    statusEl.textContent = text;
    statusEl.className = type === 'check' ? 'check' : '';
    clearTimeout(statusEl._hideTimer);
    if (type !== 'check') {
      statusEl._hideTimer = setTimeout(() => {
        statusEl.className = 'hidden-status';
      }, 3000);
    }
  }

  // ── Game Over ──────────────────────────────────────────────────────────
  function showGameOver(title, icon, desc, winner) {
    document.getElementById('result-icon').textContent = icon;
    document.getElementById('result-title').textContent = title;
    document.getElementById('result-desc').textContent = desc;

    const eloEl = document.getElementById('elo-change');
    if (winner === null) {
      eloEl.textContent = '+3 ELO';
      eloEl.className = 'elo-change';
    } else if (title === 'Победа!') {
      eloEl.textContent = '+15 ELO';
      eloEl.className = 'elo-change';
    } else {
      eloEl.textContent = '-10 ELO';
      eloEl.className = 'elo-change negative';
    }

    document.getElementById('game-over-modal').classList.remove('hidden');

    // Telegram haptic
    window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred(
      title === 'Победа!' ? 'success' : title === 'Ничья' ? 'warning' : 'error'
    );
  }

  function playAgain() {
    closeModal('game-over-modal');
    showModeSelect();
  }

  // ── Leaderboard ────────────────────────────────────────────────────────
  function showLeaderboard() {
    document.getElementById('leaderboard-modal').classList.remove('hidden');
    Game.requestLeaderboard();
  }

  function displayLeaderboard(data) {
    const list = document.getElementById('leaderboard-list');
    if (!list) return;
    const medals = ['🥇','🥈','🥉','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟'];
    if (!data || !data.length) {
      list.innerHTML = '<p style="color:var(--text-dim);text-align:center;padding:20px;">Таблица пуста</p>';
      return;
    }
    list.innerHTML = data.map((p, i) => `
      <div class="leaderboard-item">
        <span class="lb-rank">${medals[i] || (i+1)}</span>
        <div class="lb-info">
          <div class="lb-name">${p.first_name || p.username || 'Аноним'}</div>
          <div class="lb-record">${p.wins}W / ${p.losses}L / ${p.draws}D</div>
        </div>
        <span class="lb-elo">${p.elo}</span>
      </div>
    `).join('');
  }

  // ── Stats Modal ────────────────────────────────────────────────────────
  function showStats() {
    if (!playerStats) { Game.requestStats(); return; }
    const total = playerStats.wins + playerStats.losses + playerStats.draws;
    const wr = total ? Math.round(playerStats.wins / total * 100) : 0;
    alert(`📊 Статистика\n\nELO: ${playerStats.elo}\nПобеды: ${playerStats.wins}\nПоражения: ${playerStats.losses}\nНичьи: ${playerStats.draws}\nПроцент побед: ${wr}%`);
  }

  // ── Draw Offer ─────────────────────────────────────────────────────────
  function showDrawOffer() {
    document.getElementById('draw-modal').classList.remove('hidden');
    window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('medium');
  }

  // ── Resign Confirm ─────────────────────────────────────────────────────
  function confirmResign() {
    if (window.Telegram?.WebApp?.showConfirm) {
      window.Telegram.WebApp.showConfirm('Вы уверены, что хотите сдаться?', (confirmed) => {
        if (confirmed) Game.resign();
      });
    } else if (confirm('Сдаться?')) {
      Game.resign();
    }
  }

  // ── Background Cycle ───────────────────────────────────────────────────
  const BG_NAMES = ['🏰 Замок', '🌌 Космос', '⬛ Минимализм'];
  function cycleBackground() {
    currentBgIndex = (currentBgIndex + 1) % 3; Scene3D.cycleBackground();
    const statusEl = document.getElementById('status-text');
    if (statusEl) {
      statusEl.textContent = BG_NAMES[currentBgIndex];
      statusEl.className = '';
      setTimeout(() => { statusEl.className = 'hidden-status'; }, 2000);
    }
    window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light');
  }

  // ── Modals ─────────────────────────────────────────────────────────────
  function closeModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  }

  // ── Telegram MainButton ────────────────────────────────────────────────
  function setupMainButton(show, text, callback) {
    const tg = window.Telegram?.WebApp;
    if (!tg) return;
    if (show) {
      tg.MainButton.setText(text);
      tg.MainButton.onClick(callback);
      tg.MainButton.show();
    } else {
      tg.MainButton.hide();
    }
  }

  // ── Public ─────────────────────────────────────────────────────────────
  return {
    showMenu, showModeSelect, showGameScreen,
    showWaitingModal, showDrawOffer, showGameOver,
    showLeaderboard, showStats, confirmResign,
    displayLeaderboard, updatePlayerStats,
    setMyColor, setOpponent, updateCaptured,
    showStatus, closeModal, playAgain,
    cycleBackground, setupMainButton, selectMode
  };
})();
