// public/js/pieces.js — materials created lazily inside init()

const PieceFactory = (() => {
  const templates = {};
  let loadPromise = null;
  let whiteMat, blackMat;

  function _initMaterials() {
    if (whiteMat) return;
    whiteMat = new THREE.MeshStandardMaterial({ color: 0xf2e8d0, roughness: 0.22, metalness: 0.06 });
    blackMat = new THREE.MeshStandardMaterial({ color: 0x1c1008, roughness: 0.28, metalness: 0.14 });
  }

  function createMaterials() {
    _initMaterials();
    return { whiteMat, blackMat };
  }

  function init() {
    if (loadPromise) return loadPromise;
    _initMaterials();
    loadPromise = _load();
    return loadPromise;
  }

  async function _load() {
    try {
      if (!THREE.GLTFLoader) throw new Error('No GLTFLoader');
      const gltf = await new Promise((res, rej) =>
        new THREE.GLTFLoader().load('/assets/chess-set.glb', res, undefined, rej)
      );
      _extract(gltf.scene);
      if (Object.keys(templates).length < 4) throw new Error('Too few: ' + Object.keys(templates).length);
      _fillMissing();
      console.log('✅ GLB OK:', Object.keys(templates).join(', '));
    } catch (e) {
      console.warn('GLB failed, procedural:', e.message);
      _procedural();
    }
  }

  function _extract(root) {
    const nodes = [];
    root.traverse(n => { if (n.isMesh || (n.isGroup && n.children.length)) nodes.push(n); });
    console.log('Nodes:', nodes.map(n=>n.name));
    nodes.forEach(node => {
      const name = (node.name||'').toLowerCase();
      const type = _type(name); if (!type) return;
      const color = _color(node, name);
      const key = `${type}_${color}`;
      if (!templates[key]) { templates[key] = _normalize(node); console.log('  +', key, node.name); }
    });
  }

  function _type(n) {
    if (/king/i.test(n) && !/knight/i.test(n)) return 'k';
    if (/queen/i.test(n)) return 'q';
    if (/bishop/i.test(n)) return 'b';
    if (/knight|horse/i.test(n)) return 'n';
    if (/rook|tower|castle/i.test(n)) return 'r';
    if (/pawn/i.test(n)) return 'p';
    return null;
  }

  function _color(node, name) {
    if (/black|dark|_b\b|2$/.test(name)) return 'b';
    if (/white|light|_w\b|1$/.test(name)) return 'w';
    let bright = 0.5;
    node.traverse(c => {
      if (c.isMesh && c.material) {
        const m = Array.isArray(c.material) ? c.material[0] : c.material;
        if (m.color) bright = m.color.r*0.299 + m.color.g*0.587 + m.color.b*0.114;
      }
    });
    return bright > 0.4 ? 'w' : 'b';
  }

  function _normalize(node) {
    const clone = node.clone(true);
    const box = new THREE.Box3().setFromObject(clone);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    clone.position.set(clone.position.x - center.x, clone.position.y - box.min.y, clone.position.z - center.z);
    const s = 0.85 / Math.max(size.x, size.y, size.z, 0.001);
    clone.scale.multiplyScalar(s);
    clone.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
    return clone;
  }

  function _fillMissing() {
    ['k','q','b','n','r','p'].forEach(type => {
      ['w','b'].forEach(color => {
        const key = `${type}_${color}`;
        if (templates[key]) return;
        const src = templates[`${type}_${color==='w'?'b':'w'}`] || templates[Object.keys(templates)[0]];
        if (!src) return;
        const clone = src.clone(true);
        const mat = color === 'w' ? whiteMat : blackMat;
        clone.traverse(c => { if (c.isMesh) c.material = mat; });
        templates[key] = clone;
        console.log('  filled:', key);
      });
    });
  }

  function _procedural() {
    function lathe(pts, s=22) { return new THREE.LatheGeometry(pts.map(([x,y])=>new THREE.Vector2(x,y)),s); }
    function make(fn, mat) { const g=new THREE.Group(); fn(geo=>{const m=new THREE.Mesh(geo,mat);m.castShadow=m.receiveShadow=true;g.add(m);}); return g; }
    const B = {
      p: a=>{a(lathe([[.38,0],[.42,.04],[.38,.10],[.28,.14],[.22,.18],[.22,.20]]));a(lathe([[.22,.20],[.15,.28],[.12,.40],[.15,.50],[.20,.54],[.20,.56]]));a(lathe([[.19,.56],[.24,.60],[.24,.64],[.19,.66]]));const s=new THREE.SphereGeometry(.22,18,14);s.translate(0,.78,0);a(s);},
      r: a=>{a(lathe([[.44,0],[.48,.04],[.44,.12],[.34,.18],[.28,.24],[.28,.26]]));a(lathe([[.28,.26],[.22,.32],[.18,.50],[.22,.58],[.28,.62],[.28,.64]]));const c=new THREE.CylinderGeometry(.28,.30,.30,16);c.translate(0,.79,0);a(c);[0,1,2,3].forEach(i=>{const b=new THREE.BoxGeometry(.12,.14,.12),ang=(i/4)*Math.PI*2+Math.PI/4;b.translate(Math.cos(ang)*.22,.97,Math.sin(ang)*.22);a(b);});},
      n: a=>{a(lathe([[.42,0],[.46,.04],[.42,.12],[.32,.18],[.26,.24],[.24,.26]]));a(lathe([[.24,.26],[.18,.36],[.16,.50],[.18,.58]]));const b1=new THREE.BoxGeometry(.20,.32,.38);b1.translate(.04,.78,.02);a(b1);const b2=new THREE.BoxGeometry(.16,.18,.22);b2.translate(.04,.68,.22);a(b2);const h=new THREE.SphereGeometry(.16,12,10);h.translate(.04,.94,0);a(h);const e=new THREE.ConeGeometry(.05,.12,8);e.translate(.04,1.06,-.08);a(e);},
      b: a=>{a(lathe([[.42,0],[.46,.04],[.42,.12],[.32,.18],[.26,.22],[.24,.24]]));a(lathe([[.24,.24],[.18,.32],[.14,.44],[.16,.54],[.20,.58],[.20,.60]]));a(lathe([[.20,.60],[.26,.64],[.26,.68],[.20,.70]]));a(lathe([[.18,.70],[.14,.78],[.10,.90],[.08,1.02],[.10,1.06]]));const b=new THREE.SphereGeometry(.10,16,12);b.translate(0,1.08,0);a(b);const t=new THREE.SphereGeometry(.04,10,8);t.translate(0,1.22,0);a(t);},
      q: a=>{a(lathe([[.48,0],[.52,.04],[.48,.12],[.36,.20],[.30,.26],[.28,.28]]));a(lathe([[.28,.28],[.20,.38],[.16,.52],[.20,.60],[.28,.66],[.28,.68]]));a(lathe([[.28,.68],[.34,.72],[.34,.76],[.28,.78]]));a(lathe([[.26,.78],[.20,.86],[.16,.96],[.20,1.04],[.26,1.10]]));const cb=new THREE.CylinderGeometry(.26,.24,.08,20);cb.translate(0,1.14,0);a(cb);for(let i=0;i<8;i++){const s=new THREE.SphereGeometry(.06,10,8),ang=(i/8)*Math.PI*2;s.translate(Math.cos(ang)*.22,1.24,Math.sin(ang)*.22);a(s);}const j=new THREE.SphereGeometry(.08,12,10);j.translate(0,1.32,0);a(j);},
      k: a=>{a(lathe([[.50,0],[.54,.04],[.50,.14],[.38,.22],[.32,.28],[.30,.30]]));a(lathe([[.30,.30],[.22,.42],[.18,.58],[.22,.68],[.30,.74],[.30,.76]]));a(lathe([[.30,.76],[.36,.80],[.36,.86],[.30,.90]]));a(lathe([[.28,.90],[.22,.98],[.18,1.08],[.22,1.14],[.28,1.20]]));const o=new THREE.SphereGeometry(.10,14,12);o.translate(0,1.22,0);a(o);const cv=new THREE.BoxGeometry(.08,.36,.08);cv.translate(0,1.38,0);a(cv);const ch=new THREE.BoxGeometry(.28,.08,.08);ch.translate(0,1.46,0);a(ch);}
    };
    ['w','b'].forEach(color => {
      const mat = color==='w'?whiteMat:blackMat;
      Object.keys(B).forEach(type => { templates[`${type}_${color}`] = make(B[type], mat); });
    });
    console.log('✅ Procedural pieces built');
  }

  function createPiece(type, color) {
    const key = `${type}_${color}`;
    if (!templates[key]) _procedural();
    const tmpl = templates[key];
    if (!tmpl) return new THREE.Group();
    const clone = tmpl.clone(true);
    clone.scale.setScalar(0.42);
    clone.userData = { type, color, isChessPiece: true };
    return clone;
  }

  return { init, createMaterials, createPiece };
})();
