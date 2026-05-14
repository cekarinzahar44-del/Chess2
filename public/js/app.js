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
    setLoading('Проверка движка...', 10);
    await sleep(80);

    // ── Шаг 1: убеждаемся что THREE загружен ──────────────────────────────
    if (typeof THREE === 'undefined') {
      throw new Error('Three.js не загружен — проверьте интернет-соединение');
    }

    // ── Шаг 2: инициализируем все аддоны ЗДЕСЬ, когда THREE уже есть ─────
    if (typeof window.__initOrbitControls === 'function') {
      window.__initOrbitControls();   // регистрирует THREE.OrbitControls
    } else {
      throw new Error('OrbitControls factory not found');
    }

    if (typeof window.__initGLTFLoader === 'function') {
      window.__initGLTFLoader();      // регистрирует THREE.GLTFLoader
    }

    setLoading('Создание сцены...', 28);
    await sleep(60);

    // ── Шаг 3: сцена ──────────────────────────────────────────────────────
    const canvas = document.getElementById('chess-canvas');
    if (!canvas) throw new Error('Canvas #chess-canvas не найден');
    Scene3D.init(canvas);
    setLoading('Сцена готова', 48);

    // ── Шаг 4: фигуры ─────────────────────────────────────────────────────
    setLoading('Загрузка фигур...', 62);
    await PieceFactory.init();
    setLoading('Фигуры загружены', 78);

    // ── Шаг 5: WebSocket ─────────────────────────────────────────────────
    setLoading('Подключение...', 90);
    await sleep(100);
    Game.init();

    setLoading('Готово!', 100);
    await sleep(350);

    // ── Скрыть loading ────────────────────────────────────────────────────
    const ls = document.getElementById('loading-screen');
    ls.style.transition = 'opacity 0.5s ease';
    ls.style.opacity = '0';
    await sleep(520);
    ls.style.display = 'none';

    UI.showMenu();

  } catch (err) {
    console.error('Init error:', err);
    setLoading('Ошибка: ' + err.message);
    if (loadingFill) {
      loadingFill.style.background = '#e05555';
      loadingFill.style.width = '100%';
    }
  }

  // ── Back button ───────────────────────────────────────────────────────
  if (tg) {
    tg.BackButton.onClick(() => {
      const gameScreen = document.getElementById('game-screen');
      const modeSelect = document.getElementById('mode-select');
      if (!gameScreen.classList.contains('hidden')) {
        tg.showConfirm('Покинуть партию?', ok => {
          if (ok) { Game.resign(); UI.showMenu(); }
        });
      } else if (!modeSelect.classList.contains('hidden')) {
        UI.showMenu();
      }
    });
    const observer = new MutationObserver(() => {
      const onMenu = !document.getElementById('main-menu').classList.contains('hidden');
      if (onMenu) tg.BackButton.hide(); else tg.BackButton.show();
    });
    observer.observe(document.getElementById('main-menu'), {
      attributes: true, attributeFilter: ['class']
    });
  }
})();
