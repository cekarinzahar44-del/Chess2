// app.js — Professional init
(async () => {
  'use strict';

  const tg = window.Telegram?.WebApp;
  if (tg) {
    tg.ready(); tg.expand();
    tg.enableClosingConfirmation();
    if (tg.disableVerticalSwipes) tg.disableVerticalSwipes();
    if (tg.setHeaderColor) tg.setHeaderColor('#050505');
    if (tg.setBackgroundColor) tg.setBackgroundColor('#050505');
  }

  const fill  = document.getElementById('load-fill');
  const label = document.getElementById('load-label');

  function setProgress(pct, text) {
    if (fill)  fill.style.width = pct + '%';
    if (label) label.textContent = text;
  }

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  try {
    setProgress(10, 'Проверка движка...');
    await sleep(80);

    if (typeof THREE === 'undefined') throw new Error('Three.js не загружен');

    // Init addons AFTER THREE is ready
    if (typeof window.__initOrbitControls === 'function') window.__initOrbitControls();
    if (typeof window.__initGLTFLoader    === 'function') window.__initGLTFLoader();

    setProgress(25, 'Создание сцены...');
    await sleep(60);

    // ВАЖНО: canvas должен быть видим при init чтобы получить правильный размер
    const gameScreen = document.getElementById('screen-game');
    const prevDisplay = gameScreen.style.display;
    gameScreen.style.display = 'block';
    gameScreen.style.visibility = 'hidden'; // видим для layout, но не виден пользователю
    await sleep(50); // даём браузеру рассчитать layout

    Scene3D.init(document.getElementById('chess-canvas'));

    gameScreen.style.display = prevDisplay || '';
    gameScreen.style.visibility = '';

    setProgress(50, 'Загрузка фигур...');
    await PieceFactory.init();

    setProgress(75, 'Подключение...');
    await sleep(100);
    Game.init();

    setProgress(95, 'Почти готово...');
    await sleep(300);
    setProgress(100, 'Готово!');
    await sleep(350);

    // Hide loading
    const ls = document.getElementById('screen-loading');
    ls.style.opacity = '0';
    await sleep(500);
    ls.style.display = 'none';

    UI.showMenu();

    // Load saved settings
    const savedBg = localStorage.getItem('chess_bg');
    if (savedBg !== null) Scene3D.setBackground(parseInt(savedBg));

  } catch (err) {
    console.error('Init error:', err);
    if (label) { label.textContent = 'Ошибка: ' + err.message; label.style.color='#e03333'; }
    if (fill)  { fill.style.background = '#e03333'; fill.style.width = '100%'; }
  }

  // Back button
  if (tg) {
    tg.BackButton.onClick(() => {
      const game = document.getElementById('screen-game');
      const mode = document.getElementById('screen-mode');
      if (game && !game.classList.contains('hidden')) {
        tg.showConfirm('Покинуть партию?', ok => { if (ok) { Game.resign(); UI.showMenu(); } });
      } else if (mode && !mode.classList.contains('hidden')) {
        UI.showMenu();
      }
    });

    const observer = new MutationObserver(() => {
      const onMenu = !document.getElementById('screen-menu').classList.contains('hidden');
      if (onMenu) tg.BackButton.hide(); else tg.BackButton.show();
    });
    observer.observe(document.getElementById('screen-menu'), { attributes:true, attributeFilter:['class'] });
  }
})();
