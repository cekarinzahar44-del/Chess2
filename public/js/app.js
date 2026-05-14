// public/js/app.js
(async function () {
  'use strict';

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
    // 1. Проверяем THREE
    setLoading('Инициализация 3D...', 15);
    await sleep(80);
    if (typeof THREE === 'undefined') throw new Error('Three.js не загружен (проверьте интернет)');

    // 2. Инициализируем GLTFLoader ЗДЕСЬ — когда THREE уже доступен
    if (typeof window.__initGLTFLoader === 'function') {
      window.__initGLTFLoader();
    }

    // 3. Инициализируем сцену
    setLoading('Создание сцены...', 30);
    const canvas = document.getElementById('chess-canvas');
    if (!canvas) throw new Error('Canvas не найден');
    Scene3D.init(canvas);
    setLoading('Сцена готова', 45);

    // 4. Загрузка фигур
    setLoading('Загрузка фигур...', 60);
    await PieceFactory.init();
    setLoading('Фигуры загружены', 75);

    // 5. WebSocket
    setLoading('Подключение к серверу...', 88);
    await sleep(120);
    Game.init();

    setLoading('Готово!', 100);
    await sleep(350);

    // Скрыть loading
    const ls = document.getElementById('loading-screen');
    ls.style.transition = 'opacity 0.5s ease';
    ls.style.opacity = '0';
    await sleep(520);
    ls.style.display = 'none';

    UI.showMenu();

  } catch (err) {
    console.error('Init error:', err);
    setLoading('Ошибка: ' + err.message);
    if (loadingFill) { loadingFill.style.background = '#e05555'; loadingFill.style.width = '100%'; }
  }

  // Back button
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
