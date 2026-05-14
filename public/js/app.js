// public/js/app.js
(async function() {
  'use strict';

  // ── Telegram WebApp Init ────────────────────────────────────────────────
  const tg = window.Telegram?.WebApp;
  if (tg) {
    tg.ready();
    tg.expand();
    tg.enableClosingConfirmation();
    // Theme
    if (tg.colorScheme === 'dark' || true) {
      document.documentElement.style.setProperty('--bg', '#0a0a0f');
    }
    // Disable swipe back if supported
    if (tg.disableVerticalSwipes) tg.disableVerticalSwipes();
  }

  // ── Loading Steps ───────────────────────────────────────────────────────
  const loadingText = document.querySelector('.loading-text');
  function setLoadingText(text) {
    if (loadingText) loadingText.textContent = text;
  }

  async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  try {
    // Step 1: Init Three.js Scene
    setLoadingText('Инициализация 3D...');
    await sleep(150);

    const canvas = document.getElementById('chess-canvas');
    Scene3D.init(canvas);

    // Step 2: Load GLB chess model
    setLoadingText('Загрузка 3D фигур...');
    await PieceFactory.init();   // loads GLB or falls back to procedural

    // Step 3: Connect WebSocket
    setLoadingText('Подключение к серверу...');
    await sleep(200);
    Game.init();

    // Step 4: Load assets
    setLoadingText('Почти готово...');
    await sleep(300);

    // Step 4: Done
    setLoadingText('Готово!');
    await sleep(300);

    // Hide loading, show menu
    const loading = document.getElementById('loading-screen');
    loading.style.opacity = '0';
    loading.style.transition = 'opacity 0.5s ease';
    await sleep(500);
    loading.style.display = 'none';

    UI.showMenu();

  } catch (err) {
    console.error('Init error:', err);
    setLoadingText('Ошибка загрузки. Перезапустите.');
  }

  // ── Back button handler ─────────────────────────────────────────────────
  if (tg) {
    tg.BackButton.onClick(() => {
      const gameScreen = document.getElementById('game-screen');
      const modeSelect = document.getElementById('mode-select');
      if (!gameScreen.classList.contains('hidden')) {
        tg.showConfirm('Покинуть партию?', (ok) => {
          if (ok) { Game.resign(); UI.showMenu(); }
        });
      } else if (!modeSelect.classList.contains('hidden')) {
        UI.showMenu();
        tg.BackButton.hide();
      }
    });

    // Show back button when not on main menu
    const observer = new MutationObserver(() => {
      const onMenu = !document.getElementById('main-menu').classList.contains('hidden');
      if (onMenu) tg.BackButton.hide();
      else tg.BackButton.show();
    });
    observer.observe(document.getElementById('main-menu'), {
      attributes: true, attributeFilter: ['class']
    });
  }

})();
