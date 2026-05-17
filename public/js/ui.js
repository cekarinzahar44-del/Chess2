// ui.js — Professional UI controller

const UI = (() => {
  // State
  let selectedDifficulty = 1;
  let selectedColor = 'random';
  let selectedTimeControl = 'rapid';
  let playerStats = null;
  let searchTimer = null;
  let searchSeconds = 0;
  let moveListOpen = false;
  let currentTheme = 'classic';
  let currentBg = 0;
  let settings = { hints: true, eval: true, anim: true };

  // Board themes
  const BOARD_THEMES = {
    classic:  { light: 0xe8c99a, dark: 0x4a1e08 },
    midnight: { light: 0x2a4a7a, dark: 0x0f1e3a },
    forest:   { light: 0x8aaa6a, dark: 0x2a4a1a },
    ice:      { light: 0xd0e8f0, dark: 0x4a7a9a }
  };

  // ELO → Rank
  function getRank(elo) {
    if (elo < 800)  return 'Новичок';
    if (elo < 1000) return 'Любитель';
    if (elo < 1200) return 'Игрок';
    if (elo < 1400) return 'Клубный';
    if (elo < 1600) return 'Опытный';
    if (elo < 1800) return 'Кандидат';
    if (elo < 2000) return 'Мастер';
    if (elo < 2200) return 'Гроссмейстер';
    return 'Легенда';
  }

  // ── Navigation ─────────────────────────────────────────────────────────
  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    const el = document.getElementById(id);
    if (el) el.classList.remove('hidden');
  }

  function showMenu() {
    showScreen('screen-menu');
    Game.requestStats();
    _animateMenuBg();
  }

  function showModeSelect() {
    showScreen('screen-mode');
  }

  function showGameScreen() {
    showScreen('screen-game');
    const mi = document.getElementById('move-indicator');
    if (mi) mi.classList.remove('hidden');
    // Trigger resize so renderer updates to correct canvas dimensions
    setTimeout(() => { window.dispatchEvent(new Event('resize')); }, 50);
  }

  // ── Menu bg animation ──────────────────────────────────────────────────
  function _animateMenuBg() {
    const bg = document.getElementById('menu-bg-anim');
    if (!bg) return;
    // Floating chess pieces
    const pieces = ['♙','♗','♘','♖','♕','♛','♜','♞','♝','♟'];
    bg.innerHTML = '';
    for (let i = 0; i < 8; i++) {
      const span = document.createElement('span');
      span.className = 'float-piece';
      span.textContent = pieces[Math.floor(Math.random() * pieces.length)];
      span.style.cssText = `
        position:absolute;font-size:${20+Math.random()*24}px;
        color:rgba(201,168,76,${0.03+Math.random()*0.06});
        left:${Math.random()*100}%;
        top:${Math.random()*100}%;
        animation:float-piece ${8+Math.random()*8}s ease-in-out infinite;
        animation-delay:-${Math.random()*8}s;
        pointer-events:none;user-select:none;z-index:0;
      `;
      bg.appendChild(span);
    }
    if (!document.getElementById('float-style')) {
      const style = document.createElement('style');
      style.id = 'float-style';
      style.textContent = `
        @keyframes float-piece {
          0%,100%{transform:translateY(0) rotate(0deg);opacity:0.5}
          50%{transform:translateY(-30px) rotate(10deg);opacity:1}
        }
      `;
      document.head.appendChild(style);
    }
  }

  // ── Profile ────────────────────────────────────────────────────────────
  function updateProfile(stats) {
    if (!stats) return;
    playerStats = stats;

    const name  = stats.first_name || stats.username || 'Игрок';
    const elo   = stats.elo || 1200;
    const rank  = getRank(elo);
    const init  = name[0].toUpperCase();
    const total = (stats.wins||0) + (stats.losses||0) + (stats.draws||0);

    _setText('profile-name', name);
    _setText('profile-elo', `${elo} ELO`);
    _setText('profile-rank', rank);
    _setText('profile-initials', init);
    _setText('self-name', name);
    _setText('self-elo', `${elo}`);
    _setText('self-av', init);

    // Badge color by rank
    const badge = document.getElementById('profile-badge');
    if (badge) {
      badge.style.color = elo >= 1800 ? '#FFD700' : elo >= 1400 ? '#C0C0C0' : 'var(--gold)';
    }

    // Online count (mock)
    _setText('online-count', `${Math.floor(Math.random()*200+50)} онлайн`);
  }

  function setOpponent(opp) {
    if (!opp) return;
    const name = opp.name || 'Соперник';
    const elo  = opp.elo || '—';
    _setText('opp-name', name);
    _setText('opp-elo', `${elo} ELO`);
    _setText('opp-av', name[0].toUpperCase());
  }

  // ── Mode Select ────────────────────────────────────────────────────────
  function setDifficulty(btn) {
    event.stopPropagation();
    document.querySelectorAll('.diff-chip').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedDifficulty = parseInt(btn.dataset.diff);
    const elo = btn.dataset.elo;
    _setText('ai-elo-badge', `ELO ${elo}`);
  }

  function setColor(btn) {
    document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedColor = btn.dataset.color;
  }

  function startAiGame() {
    const diffMap = { 1:'easy', 2:'medium', 3:'hard', 4:'expert' };
    Game.findGame('ai', diffMap[selectedDifficulty] || 'medium');
  }

  function startMultiplayer(tc) {
    selectedTimeControl = tc;
    Game.findGame('multiplayer', null, tc);
    showWaiting();
  }

  // ── Game UI ────────────────────────────────────────────────────────────
  function showWaiting() {
    openOverlay('modal-waiting');
    searchSeconds = 0;
    clearInterval(searchTimer);
    searchTimer = setInterval(() => {
      searchSeconds++;
      const m = Math.floor(searchSeconds/60);
      const s = searchSeconds % 60;
      _setText('search-time', `${m}:${s.toString().padStart(2,'0')}`);
      // Expand search radius over time
      if (searchSeconds === 15) _setText('search-info', 'Расширяем поиск ± 200 ELO...');
      if (searchSeconds === 30) _setText('search-info', 'Ищем любого соперника...');
    }, 1000);
  }

  function hideWaiting() {
    clearInterval(searchTimer);
    closeOverlay('modal-waiting');
  }

  function setTurn(isMyTurn, inCheck) {
    const ind = document.getElementById('move-indicator');
    const dot = document.getElementById('mi-dot');
    const txt = document.getElementById('mi-text');
    if (!ind) return;

    if (inCheck) {
      txt.textContent = 'Шах!';
      dot.style.background = '#e03333';
      dot.style.boxShadow  = '0 0 8px #e03333';
      ind.style.borderColor = 'rgba(224,51,51,0.4)';
    } else if (isMyTurn) {
      txt.textContent = 'Ваш ход';
      dot.style.background = 'var(--green)';
      dot.style.boxShadow  = '0 0 8px var(--green)';
      ind.style.borderColor = 'rgba(255,255,255,0.1)';
    } else {
      txt.textContent = 'Ход соперника';
      dot.style.background = 'var(--dim)';
      dot.style.boxShadow  = 'none';
      ind.style.borderColor = 'rgba(255,255,255,0.1)';
    }
  }

  function updateClock(side, seconds) {
    const id   = side === 'self' ? 'clock-self' : 'clock-opp';
    const el   = document.getElementById(id);
    if (!el) return;
    const m   = Math.floor(seconds/60);
    const s   = seconds % 60;
    el.textContent = `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
    el.classList.toggle('urgent', seconds < 30);
  }

  function setActivePlayer(side) {
    document.getElementById('clock-self')?.classList.toggle('phud-clock--act', side==='self');
    document.getElementById('clock-opp')?.classList.toggle('phud-clock--act',  side==='opp');
  }

  function updateEval(score) {
    const fill = document.getElementById('eval-fill');
    if (!fill) return;
    // score: negative = black winning, positive = white winning
    const clipped = Math.max(-5, Math.min(5, score));
    const pct = 50 + (clipped / 5) * 40;
    fill.style.height = pct + '%';
  }

  function updateCaptured(side, pieces) {
    const id = side === 'self' ? 'self-cap' : 'opp-cap';
    const el = document.getElementById(id);
    if (!el) return;
    const SYMBOLS = { p:'♟',r:'♜',n:'♞',b:'♝',q:'♛', P:'♙',R:'♖',N:'♘',B:'♗',Q:'♕' };
    el.textContent = pieces.map(p => SYMBOLS[p] || p).join('');
  }

  // ── Move list ──────────────────────────────────────────────────────────
  function addMove(moveNum, white, black, currentIdx) {
    const list = document.getElementById('move-list');
    if (!list) return;

    // Check if row exists
    let row = document.getElementById(`move-row-${moveNum}`);
    if (!row) {
      row = document.createElement('div');
      row.className = 'move-row';
      row.id = `move-row-${moveNum}`;
      const numEl = document.createElement('span');
      numEl.className = 'move-num';
      numEl.textContent = moveNum + '.';
      row.appendChild(numEl);
      list.appendChild(row);
    }

    if (white !== undefined) {
      let wEl = row.querySelector('.w-move');
      if (!wEl) { wEl = document.createElement('span'); wEl.className = 'move-cell w-move'; row.appendChild(wEl); }
      wEl.textContent = white;
    }
    if (black !== undefined) {
      let bEl = row.querySelector('.b-move');
      if (!bEl) { bEl = document.createElement('span'); bEl.className = 'move-cell b-move'; row.appendChild(bEl); }
      bEl.textContent = black;
    }

    // Scroll to bottom
    list.scrollTop = list.scrollHeight;
  }

  function clearMoves() {
    const list = document.getElementById('move-list');
    if (list) list.innerHTML = '';
  }

  function toggleMoveList() {
    moveListOpen = !moveListOpen;
    const panel = document.getElementById('move-panel');
    if (panel) panel.classList.toggle('open', moveListOpen);
  }

  // ── Game Over ──────────────────────────────────────────────────────────
  function showResult(result) {
    const { outcome, reason, eloChange, accuracy, moves } = result;

    const icons   = { win:'♛', loss:'♟', draw:'♜' };
    const titles  = { win:'Победа!', loss:'Поражение', draw:'Ничья' };
    const classes = { win:'win', loss:'loss', draw:'draw' };

    const rcTop = document.getElementById('rc-top');
    if (rcTop) rcTop.className = `rc-top ${classes[outcome]}`;

    _setText('rc-icon',  icons[outcome]  || '♟');
    _setText('rc-title', titles[outcome] || 'Конец');
    _setText('rc-reason', _getReasonText(reason));
    _setText('rc-moves',  moves || '—');
    _setText('rc-acc',    accuracy ? accuracy + '%' : '—');

    const eloEl = document.getElementById('rc-elo');
    if (eloEl) {
      const sign = eloChange > 0 ? '+' : '';
      eloEl.textContent = `${sign}${eloChange || 0}`;
      eloEl.style.color = eloChange > 0 ? 'var(--green)' : eloChange < 0 ? 'var(--red)' : 'var(--dim2)';
    }

    openOverlay('modal-result');
    window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred(
      outcome === 'win' ? 'success' : outcome === 'loss' ? 'error' : 'warning'
    );
  }

  function _getReasonText(r) {
    const m = { checkmate:'Мат',resignation:'Соперник сдался',draw_agreement:'Ничья по соглашению',
      stalemate:'Пат',timeout:'Время вышло',insufficient_material:'Недостаточно материала',
      threefold:'Троекратное повторение',fifty_moves:'Правило 50 ходов' };
    return m[r] || r || '';
  }

  // ── Leaderboard ────────────────────────────────────────────────────────
  function showLeaderboard() {
    openOverlay('modal-leaderboard');
    Game.requestLeaderboard();
  }

  function displayLeaderboard(data) {
    const body = document.getElementById('lb-body');
    if (!body || !data) return;
    const medals = ['gold','silver','bronze'];
    body.innerHTML = data.map((p, i) => `
      <div class="lb-item">
        <span class="lb-pos ${medals[i]||''}">${i+1}</span>
        <div class="lb-av">${(p.first_name||p.username||'?')[0].toUpperCase()}</div>
        <div class="lb-info">
          <div class="lb-name">${p.first_name||p.username||'Аноним'}</div>
          <div class="lb-rec">${p.wins||0}П · ${p.losses||0}П · ${p.draws||0}Н</div>
        </div>
        <span class="lb-elo">${p.elo||1200}</span>
      </div>
    `).join('');
  }

  // ── Achievements ───────────────────────────────────────────────────────
  const ACHIEVEMENTS = [
    { id:'first_win',   icon:'♛', name:'Первая победа',      desc:'Выиграйте первую партию',         xp:50  },
    { id:'win10',       icon:'♕', name:'Десять побед',        desc:'Выиграйте 10 партий',              xp:100 },
    { id:'win50',       icon:'👑', name:'Ветеран',             desc:'Выиграйте 50 партий',             xp:300 },
    { id:'elo1400',     icon:'⭐', name:'Клубный игрок',       desc:'Достигните 1400 ELO',             xp:200 },
    { id:'elo1800',     icon:'🌟', name:'Кандидат в мастера', desc:'Достигните 1800 ELO',              xp:500 },
    { id:'streak5',     icon:'🔥', name:'Серия побед',         desc:'5 побед подряд',                  xp:150 },
    { id:'fast_win',    icon:'⚡', name:'Молния',              desc:'Победите за менее 20 ходов',      xp:100 },
    { id:'comeback',    icon:'💪', name:'Камбэк',              desc:'Победите, уступая материал',      xp:200 },
    { id:'marathon',    icon:'🏃', name:'Марафонец',           desc:'Сыграйте 100 партий',             xp:400 },
    { id:'daily',       icon:'📅', name:'Ежедневная практика', desc:'Играйте 7 дней подряд',          xp:150 },
  ];

  function showAchievements() {
    openOverlay('modal-achievements');
    const body = document.getElementById('ach-body');
    if (!body) return;
    const unlocked = JSON.parse(localStorage.getItem('chess_achievements') || '[]');
    body.innerHTML = ACHIEVEMENTS.map(a => {
      const isUnlocked = unlocked.includes(a.id);
      return `<div class="ach-item">
        <div class="ach-icon ${isUnlocked?'unlocked':'locked'}">${a.icon}</div>
        <div class="ach-info">
          <div class="ach-name">${a.name}</div>
          <div class="ach-desc">${a.desc}</div>
        </div>
        <span class="ach-xp">${isUnlocked?'+'+a.xp+' XP':'🔒'}</span>
      </div>`;
    }).join('');
  }

  function unlockAchievement(id) {
    const unlocked = JSON.parse(localStorage.getItem('chess_achievements') || '[]');
    if (unlocked.includes(id)) return;
    unlocked.push(id);
    localStorage.setItem('chess_achievements', JSON.stringify(unlocked));
    const ach = ACHIEVEMENTS.find(a => a.id === id);
    if (ach) _showToast(`🏆 ${ach.name}`, `+${ach.xp} XP`);
  }

  // ── History ────────────────────────────────────────────────────────────
  function showHistory() {
    openOverlay('modal-history');
    const body = document.getElementById('hist-body');
    if (!body) return;
    const history = JSON.parse(localStorage.getItem('chess_history') || '[]');
    if (!history.length) {
      body.innerHTML = '<p style="color:var(--dim);text-align:center;padding:30px 0;">История пуста</p>';
      return;
    }
    body.innerHTML = history.slice().reverse().map(g => `
      <div class="hist-item">
        <div class="hist-result ${g.outcome==='win'?'w':g.outcome==='loss'?'l':'d'}"></div>
        <div class="hist-info">
          <div class="hist-opp">${g.opponent||'Соперник'}</div>
          <div class="hist-meta">${g.mode||'—'} · ${g.moves||0} ходов · ${_formatDate(g.date)}</div>
        </div>
        <span class="hist-elo ${g.eloChange>0?'pos':g.eloChange<0?'neg':'neu'}">${g.eloChange>0?'+':''}${g.eloChange||0}</span>
      </div>
    `).join('');
  }

  function saveGameToHistory(data) {
    const history = JSON.parse(localStorage.getItem('chess_history') || '[]');
    history.push({ ...data, date: Date.now() });
    if (history.length > 50) history.shift();
    localStorage.setItem('chess_history', JSON.stringify(history));
  }

  function _formatDate(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    return d.toLocaleDateString('ru', { day:'numeric', month:'short' });
  }

  // ── Settings ───────────────────────────────────────────────────────────
  function showSettings() {
    openOverlay('modal-settings');
    _loadSettings();
  }

  function _loadSettings() {
    const saved = JSON.parse(localStorage.getItem('chess_settings') || '{}');
    settings = { hints:true, eval:true, anim:true, ...saved };
    Object.entries(settings).forEach(([k,v]) => {
      const btn = document.getElementById('tog-'+k);
      if (btn) btn.classList.toggle('active', v);
    });
  }

  function toggleSetting(btn, key) {
    btn.classList.toggle('active');
    settings[key] = btn.classList.contains('active');
    localStorage.setItem('chess_settings', JSON.stringify(settings));
    const evalBar = document.getElementById('eval-bar');
    if (key === 'eval' && evalBar) evalBar.style.display = settings.eval ? '' : 'none';
  }

  function setBoardTheme(el) {
    document.querySelectorAll('.bt').forEach(b => b.classList.remove('active'));
    el.classList.add('active');
    currentTheme = el.dataset.theme;
    const theme = BOARD_THEMES[currentTheme];
    if (theme && Scene3D) Scene3D.setBoardColors(theme.light, theme.dark);
    localStorage.setItem('chess_board_theme', currentTheme);
  }

  function setBgTheme(el) {
    document.querySelectorAll('.bgt').forEach(b => b.classList.remove('active'));
    el.classList.add('active');
    currentBg = parseInt(el.dataset.bg);
    Scene3D.setBackground(currentBg);
  }

  function cycleTheme() {
    currentBg = (currentBg + 1) % 3;
    Scene3D.setBackground(currentBg);
    const names = ['Замок','Космос','Минимализм'];
    _showToast(names[currentBg], '');
  }

  // ── Game menu ──────────────────────────────────────────────────────────
  function showGameMenu() { openOverlay('modal-game-menu'); }

  function confirmResign() {
    closeOverlay('modal-game-menu');
    const tg = window.Telegram?.WebApp;
    if (tg?.showConfirm) {
      tg.showConfirm('Вы уверены, что хотите сдаться?', ok => { if (ok) Game.resign(); });
    } else if (confirm('Сдаться?')) {
      Game.resign();
    }
  }

  function showDrawOffer() {
    openOverlay('modal-draw');
    window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('medium');
  }

  // ── Promotion ──────────────────────────────────────────────────────────
  function showPromotion(color, callback) {
    const pieces = color === 'w'
      ? [['q','♕'],['r','♖'],['b','♗'],['n','♘']]
      : [['q','♛'],['r','♜'],['b','♝'],['n','♞']];
    const grid = document.getElementById('promo-grid');
    if (grid) {
      grid.innerHTML = pieces.map(([t,s]) =>
        `<button class="promo-btn" onclick="(${callback.toString()})('${t}');UI.closeOverlay('modal-promotion')">${s}</button>`
      ).join('');
    }
    openOverlay('modal-promotion');
  }

  // ── Toast ──────────────────────────────────────────────────────────────
  function _showToast(title, sub) {
    let toast = document.getElementById('toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'toast';
      toast.style.cssText = `position:fixed;top:80px;left:50%;transform:translateX(-50%);
        background:rgba(14,14,14,0.95);border:1px solid rgba(255,255,255,0.1);
        border-radius:14px;padding:10px 18px;z-index:500;display:flex;flex-direction:column;
        align-items:center;gap:2px;backdrop-filter:blur(12px);transition:opacity 0.3s;`;
      document.body.appendChild(toast);
    }
    toast.innerHTML = `<span style="font-weight:700;font-size:14px;color:#fff">${title}</span>
      ${sub?`<span style="font-size:11px;color:var(--dim)">${sub}</span>`:''}`;
    toast.style.opacity = '1';
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { toast.style.opacity = '0'; }, 2000);
  }

  // ── Overlays ───────────────────────────────────────────────────────────
  function openOverlay(id) {
    const el = document.getElementById(id);
    if (el) { el.classList.remove('hidden'); el.style.display = 'flex'; }
  }

  function closeOverlay(id) {
    const el = document.getElementById(id);
    if (el) { el.classList.add('hidden'); el.style.display = ''; }
  }

  // ── Stats ──────────────────────────────────────────────────────────────
  function showStats() { showLeaderboard(); }

  // ── Rematch ────────────────────────────────────────────────────────────
  function rematch() {
    closeOverlay('modal-result');
    showModeSelect();
  }

  // ── Helper ─────────────────────────────────────────────────────────────
  function _setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function getSettings() { return settings; }

  return {
    showMenu, showModeSelect, showGameScreen,
    showWaiting, hideWaiting,
    updateProfile, setOpponent,
    setDifficulty, setColor, startAiGame, startMultiplayer,
    setTurn, updateClock, setActivePlayer, updateEval, updateCaptured,
    addMove, clearMoves, toggleMoveList,
    showResult, showDrawOffer, showPromotion,
    showLeaderboard, displayLeaderboard,
    showAchievements, unlockAchievement,
    showHistory, saveGameToHistory,
    showSettings, toggleSetting, setBoardTheme, setBgTheme, cycleTheme,
    showGameMenu, confirmResign,
    openOverlay, closeOverlay,
    rematch, showStats, getSettings,
    toast: _showToast
  };
})();
