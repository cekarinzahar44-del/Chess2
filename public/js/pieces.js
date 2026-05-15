// pieces.js — загружает GLB, извлекает меши по индексу, сбрасывает трансформации

const PieceFactory = (() => {
  const templates = {};
  let loadPromise = null;
  let whiteMat, blackMat;

  // Точная карта: имя нода → тип/цвет + индекс меша в GLB
  // Берём ТОЛЬКО ОДИН экземпляр каждого типа фигуры
  const PIECE_NODES = [
    { name: 'king_1',    type: 'k', color: 'w' },
    { name: 'king2_2',   type: 'k', color: 'b' },
    { name: 'queen_23',  type: 'q', color: 'w' },
    { name: 'queen2_24', type: 'q', color: 'b' },
    { name: 'knight_3',  type: 'n', color: 'w' },
    { name: 'knight2_5', type: 'n', color: 'b' },
    { name: 'rook_25',   type: 'r', color: 'w' },
    { name: 'rook2_27',  type: 'r', color: 'b' },
    { name: 'tower_29',  type: 'b', color: 'w' }, // слон
    { name: 'tower2_31', type: 'b', color: 'b' },
    { name: 'pawn_7',    type: 'p', color: 'w' },
    { name: 'pawn2_15',  type: 'p', color: 'b' },
  ];

  function _initMaterials() {
    if (whiteMat) return;
    whiteMat = new THREE.MeshStandardMaterial({ color: 0xf5f0e0, roughness: 0.20, metalness: 0.08, envMapIntensity: 1.2 });
    blackMat = new THREE.MeshStandardMaterial({ color: 0x1a0f06, roughness: 0.25, metalness: 0.15, envMapIntensity: 1.0 });
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
      if (!THREE.GLTFLoader) throw new Error('GLTFLoader not ready');
      const gltf = await new Promise((res, rej) =>
        new THREE.GLTFLoader().load('/assets/chess-set.glb', res, undefined, rej)
      );
      _extractMeshes(gltf);
      _fillMissing();
      console.log('✅ GLB pieces:', Object.keys(templates).join(', '));
    } catch (e) {
      console.warn('GLB failed:', e.message);
      _procedural();
    }
  }

  function _extractMeshes(gltf) {
    // Строим карту: nodeName → нод из сцены
    const nodeMap = {};
    gltf.scene.traverse(obj => { if (obj.name) nodeMap[obj.name] = obj; });

    PIECE_NODES.forEach(({ name, type, color }) => {
      const key = `${type}_${color}`;
      if (templates[key]) return;

      const node = nodeMap[name];
      if (!node) { console.warn('Node not found:', name); return; }

      // Ищем Mesh внутри нода (может быть прямо в ноде или в дочернем)
      let meshObj = null;
      if (node.isMesh) {
        meshObj = node;
      } else {
        node.traverse(c => { if (c.isMesh && !meshObj) meshObj = c; });
      }

      if (!meshObj) { console.warn('No mesh in node:', name); return; }

      // Берём ТОЛЬКО геометрию — игнорируем все трансформации нода
      const geo = meshObj.geometry.clone();

      // Центрируем геометрию по Y (ставим основание на 0)
      geo.computeBoundingBox();
      const box = geo.boundingBox;
      const cx = (box.min.x + box.max.x) / 2;
      const cy = box.min.y;
      const cz = (box.min.z + box.max.z) / 2;
      geo.translate(-cx, -cy, -cz);

      // Масштабируем: высота = 1.0 unit
      geo.computeBoundingBox();
      const height = geo.boundingBox.max.y - geo.boundingBox.min.y;
      const width  = geo.boundingBox.max.x - geo.boundingBox.min.x;
      const scaleFactor = 0.9 / Math.max(height, width * 0.5, 0.001);
      geo.scale(scaleFactor, scaleFactor, scaleFactor);

      // Нормализуем нормали
      geo.computeVertexNormals();

      // Создаём меш с нашим материалом (игнорируем оригинальный)
      const mat  = color === 'w' ? whiteMat : blackMat;
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow    = true;
      mesh.receiveShadow = true;

      // Оборачиваем в группу
      const group = new THREE.Group();
      group.add(mesh);
      templates[key] = group;
      console.log(`  ✅ ${name} → ${key}, height=${height.toFixed(3)}, scale=${scaleFactor.toFixed(4)}`);
    });
  }

  function _fillMissing() {
    ['k','q','b','n','r','p'].forEach(type => {
      ['w','b'].forEach(color => {
        const key = `${type}_${color}`;
        if (templates[key]) return;

        // Берём другой цвет той же фигуры и перекрашиваем
        const other = `${type}_${color === 'w' ? 'b' : 'w'}`;
        if (templates[other]) {
          const clone = templates[other].clone(true);
          const mat   = color === 'w' ? whiteMat : blackMat;
          clone.traverse(c => { if (c.isMesh) c.material = mat; });
          templates[key] = clone;
          console.log(`  filled ${key} from ${other}`);
        }
      });
    });
  }

  // ── Процедурные фигуры (fallback) ──────────────────────────────────────
  function _procedural() {
    function lathe(pts, s=22) {
      return new THREE.LatheGeometry(pts.map(([x,y]) => new THREE.Vector2(x,y)), s);
    }
    function make(fn, mat) {
      const g = new THREE.Group();
      fn(geo => {
        const m = new THREE.Mesh(geo, mat);
        m.castShadow = m.receiveShadow = true;
        g.add(m);
      });
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
      Object.keys(B).forEach(type => {
        templates[`${type}_${color}`] = make(B[type], mat);
      });
    });
    console.log('✅ Procedural pieces ready');
  }

  function createPiece(type, color) {
    const key = `${type}_${color}`;
    if (!templates[key]) { _procedural(); }
    const tmpl = templates[key];
    if (!tmpl) return new THREE.Group();
    const clone = tmpl.clone(true);
    clone.scale.setScalar(0.58);
    clone.userData = { type, color, isChessPiece: true };
    return clone;
  }

  return { init, createMaterials, createPiece };
})();
