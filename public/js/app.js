// public/js/app.js
(async function () {
  'use strict';

  // ── Telegram WebApp ──────────────────────────────────────────────────────
  const tg = window.Telegram?.WebApp;
  if (tg) {
    tg.ready();
    tg.expand();
    tg.enableClosingConfirmation();
    if (tg.disableVerticalSwipes) tg.disableVerticalSwipes();
  }

  const loadingText = document.querySelector('.loading-text');
  const loadingFill = document.querySelector('.loading-fill');
  function setLoading(text, pct) {
    if (loadingText) loadingText.textContent = text;
    if (loadingFill && pct !== undefined) loadingFill.style.width = pct + '%';
  }
  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  try {
    // 1. Init Three.js — самый вероятный источник ошибок
    setLoading('Инициализация 3D...', 20);
    await sleep(100);
    const canvas = document.getElementById('chess-canvas');
    if (!canvas) throw new Error('Canvas element not found');
    if (typeof THREE === 'undefined') throw new Error('Three.js not loaded');
    Scene3D.init(canvas);
    setLoading('3D сцена готова', 40);

    // 2. Загрузка фигур (GLB или процедурные — не бросает исключение)
    setLoading('Загрузка фигур...', 55);
    await PieceFactory.init();
    setLoading('Фигуры загружены', 70);

    // 3. WebSocket
    setLoading('Подключение...', 85);
    await sleep(150);
    Game.init();

    setLoading('Готово!', 100);
    await sleep(400);

    // Скрыть loading
    const ls = document.getElementById('loading-screen');
    ls.style.transition = 'opacity 0.5s ease';
    ls.style.opacity = '0';
    await sleep(520);
    ls.style.display = 'none';

    UI.showMenu();

  } catch (err) {
    console.error('Init error:', err);
    // Показать детальную ошибку для отладки
    setLoading('Ошибка: ' + err.message);
    if (loadingFill) loadingFill.style.background = '#e05555';
  }

  // ── Back button ───────────────────────────────────────────────────────────
  if (tg) {
    tg.BackButton.onClick(() => {
      const gameScreen = document.getElementById('game-screen');
      const modeSelect = document.getElementById('mode-select');
      if (!gameScreen.classList.contains('hidden')) {
        tg.showConfirm('Покинуть партию?', ok => { if (ok) { Game.resign(); UI.showMenu(); } });
      } else if (!modeSelect.classList.contains('hidden')) {
        UI.showMenu();
      }
    });
    const observer = new MutationObserver(() => {
      const onMenu = !document.getElementById('main-menu').classList.contains('hidden');
      if (onMenu) tg.BackButton.hide(); else tg.BackButton.show();
    });
    observer.observe(document.getElementById('main-menu'), { attributes: true, attributeFilter: ['class'] });
  }
})();
