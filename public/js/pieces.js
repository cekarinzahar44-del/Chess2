// pieces.js — точный маппинг нод GLB файла

const PieceFactory = (() => {
  const templates = {};
  let loadPromise = null;
  let whiteMat, blackMat;

  // ТОЧНАЯ карта: имя нода → тип и цвет фигуры
  // Основано на реальной структуре chess-set.glb
  const NODE_TO_PIECE = {
    'king_1':       { type: 'k', color: 'w' },
    'king2_2':      { type: 'k', color: 'b' },
    'queen_23':     { type: 'q', color: 'w' },
    'queen2_24':    { type: 'q', color: 'b' },
    'knight_3':     { type: 'n', color: 'w' },
    'knight.001_4': { type: 'n', color: 'w' },
    'knight2_5':    { type: 'n', color: 'b' },
    'rook_25':      { type: 'r', color: 'w' },
    'rook.001_26':  { type: 'r', color: 'w' },
    'rook2_27':     { type: 'r', color: 'b' },
    'tower_29':     { type: 'b', color: 'w' }, // bishop (tower в модели)
    'tower.001_30': { type: 'b', color: 'w' },
    'tower2_31':    { type: 'b', color: 'b' },
    'pawn_7':       { type: 'p', color: 'w' },
    'pawn2_15':     { type: 'p', color: 'b' },
  };

  function _initMaterials() {
    if (whiteMat) return;
    whiteMat = new THREE.MeshStandardMaterial({ color: 0xf2e8d0, roughness: 0.22, metalness: 0.06 });
    blackMat = new THREE.MeshStandardMaterial({ color: 0x1c1008, roughness: 0.28, metalness: 0.14 });
  }

  function createMaterials() { _initMaterials(); return { whiteMat, blackMat }; }

  function init() {
    if (loadPromise) return loadPromise;
    loadPromise = _load();
    return loadPromise;
  }

  async function _load() {
    _initMaterials();
    try {
      if (!THREE.GLTFLoader) throw new Error('No GLTFLoader');
      const gltf = await new Promise((res, rej) =>
        new THREE.GLTFLoader().load('/assets/chess-set.glb', res, undefined, rej)
      );
      _extractExact(gltf.scene);
      _fillMissing();
      console.log('✅ GLB loaded:', Object.keys(templates).join(', '));
    } catch (e) {
      console.warn('GLB failed:', e.message, '— using procedural');
      _procedural();
    }
  }

  function _extractExact(root) {
    // Обходим все ноды, ищем точные имена из карты
    root.traverse(node => {
      const info = NODE_TO_PIECE[node.name];
      if (!info) return;
      const key = `${info.type}_${info.color}`;
      if (templates[key]) return; // уже есть

      // Клонируем этот нод со всеми детьми (включая Object_* с мешем)
      templates[key] = _normalize(node.clone(true));
      console.log(`  ✅ ${node.name} → ${key}`);
    });
  }

  function _normalize(node) {
    // Включаем тени
    node.traverse(c => {
      if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; }
    });

    // Вычисляем bounding box
    const box = new THREE.Box3().setFromObject(node);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    // Сдвигаем к началу координат
    node.position.set(
      node.position.x - center.x,
      node.position.y - box.min.y,
      node.position.z - center.z
    );

    // Нормализуем масштаб: высота ~0.85
    const maxDim = Math.max(size.x, size.y, size.z, 0.001);
    node.scale.multiplyScalar(0.85 / maxDim);

    return node;
  }

  function _fillMissing() {
    const types = ['k','q','b','n','r','p'];
    const colors = ['w','b'];

    types.forEach(type => {
      colors.forEach(color => {
        const key = `${type}_${color}`;
        if (templates[key]) return;

        // Попробуем другой цвет той же фигуры
        const otherColor = color === 'w' ? 'b' : 'w';
        const otherKey = `${type}_${otherColor}`;
        const src = templates[otherKey];

        if (src) {
          const clone = src.clone(true);
          const mat = color === 'w' ? whiteMat : blackMat;
          clone.traverse(c => { if (c.isMesh) c.material = mat; });
          templates[key] = clone;
          console.log(`  filled ${key} from ${otherKey}`);
        }
      });
    });

    // Если bishop совсем нет — используем rook как заглушку
    ['w','b'].forEach(color => {
      if (!templates[`b_${color}`] && templates[`r_${color}`]) {
        templates[`b_${color}`] = templates[`r_${color}`].clone(true);
        console.log(`  bishop_${color} → rook fallback`);
      }
    });
  }

  // ── Процедурные фигуры (fallback) ─────────────────────────────────────
  function _procedural() {
    function lathe(pts, s=22) {
      return new THREE.LatheGeometry(pts.map(([x,y]) => new THREE.Vector2(x,y)), s);
    }
    function make(fn, mat) {
      const g = new THREE.Group();
      fn(geo => { const m = new THREE.Mesh(geo, mat); m.castShadow = m.receiveShadow = true; g.add(m); });
      return g;
    }
    const B = {
      p: a => { a(lathe([[.38,0],[.42,.04],[.38,.10],[.28,.14],[.22,.18],[.22,.20]])); a(lathe([[.22,.20],[.15,.28],[.12,.40],[.15,.50],[.20,.54],[.20,.56]])); a(lathe([[.19,.56],[.24,.60],[.24,.64],[.19,.66]])); const s=new THREE.SphereGeometry(.22,18,14); s.translate(0,.78,0); a(s); },
      r: a => { a(lathe([[.44,0],[.48,.04],[.44,.12],[.34,.18],[.28,.24],[.28,.26]])); a(lathe([[.28,.26],[.22,.32],[.18,.50],[.22,.58],[.28,.62],[.28,.64]])); const c=new THREE.CylinderGeometry(.28,.30,.30,16); c.translate(0,.79,0); a(c); [0,1,2,3].forEach(i=>{const b=new THREE.BoxGeometry(.12,.14,.12),ang=(i/4)*Math.PI*2+Math.PI/4; b.translate(Math.cos(ang)*.22,.97,Math.sin(ang)*.22); a(b);}); },
      n: a => { a(lathe([[.42,0],[.46,.04],[.42,.12],[.32,.18],[.26,.24],[.24,.26]])); a(lathe([[.24,.26],[.18,.36],[.16,.50],[.18,.58]])); const b1=new THREE.BoxGeometry(.20,.32,.38); b1.translate(.04,.78,.02); a(b1); const b2=new THREE.BoxGeometry(.16,.18,.22); b2.translate(.04,.68,.22); a(b2); const h=new THREE.SphereGeometry(.16,12,10); h.translate(.04,.94,0); a(h); const e=new THREE.ConeGeometry(.05,.12,8); e.translate(.04,1.06,-.08); a(e); },
      b: a => { a(lathe([[.42,0],[.46,.04],[.42,.12],[.32,.18],[.26,.22],[.24,.24]])); a(lathe([[.24,.24],[.18,.32],[.14,.44],[.16,.54],[.20,.58],[.20,.60]])); a(lathe([[.20,.60],[.26,.64],[.26,.68],[.20,.70]])); a(lathe([[.18,.70],[.14,.78],[.10,.90],[.08,1.02],[.10,1.06]])); const b=new THREE.SphereGeometry(.10,16,12); b.translate(0,1.08,0); a(b); const t=new THREE.SphereGeometry(.04,10,8); t.translate(0,1.22,0); a(t); },
      q: a => { a(lathe([[.48,0],[.52,.04],[.48,.12],[.36,.20],[.30,.26],[.28,.28]])); a(lathe([[.28,.28],[.20,.38],[.16,.52],[.20,.60],[.28,.66],[.28,.68]])); a(lathe([[.28,.68],[.34,.72],[.34,.76],[.28,.78]])); a(lathe([[.26,.78],[.20,.86],[.16,.96],[.20,1.04],[.26,1.10]])); const cb=new THREE.CylinderGeometry(.26,.24,.08,20); cb.translate(0,1.14,0); a(cb); for(let i=0;i<8;i++){const s=new THREE.SphereGeometry(.06,10,8),ang=(i/8)*Math.PI*2; s.translate(Math.cos(ang)*.22,1.24,Math.sin(ang)*.22); a(s);} const j=new THREE.SphereGeometry(.08,12,10); j.translate(0,1.32,0); a(j); },
      k: a => { a(lathe([[.50,0],[.54,.04],[.50,.14],[.38,.22],[.32,.28],[.30,.30]])); a(lathe([[.30,.30],[.22,.42],[.18,.58],[.22,.68],[.30,.74],[.30,.76]])); a(lathe([[.30,.76],[.36,.80],[.36,.86],[.30,.90]])); a(lathe([[.28,.90],[.22,.98],[.18,1.08],[.22,1.14],[.28,1.20]])); const o=new THREE.SphereGeometry(.10,14,12); o.translate(0,1.22,0); a(o); const cv=new THREE.BoxGeometry(.08,.36,.08); cv.translate(0,1.38,0); a(cv); const ch=new THREE.BoxGeometry(.28,.08,.08); ch.translate(0,1.46,0); a(ch); }
    };
    ['w','b'].forEach(color => {
      const mat = color === 'w' ? whiteMat : blackMat;
      Object.keys(B).forEach(type => { templates[`${type}_${color}`] = make(B[type], mat); });
    });
    console.log('✅ Procedural pieces ready');
  }

  function createPiece(type, color) {
    const key = `${type}_${color}`;
    if (!templates[key]) {
      console.warn('Missing template:', key, '— building procedural');
      _procedural();
    }
    const tmpl = templates[key];
    if (!tmpl) return new THREE.Group();
    const clone = tmpl.clone(true);
    clone.scale.setScalar(0.42);
    clone.userData = { type, color, isChessPiece: true };
    return clone;
  }

  return { init, createMaterials, createPiece };
})();
