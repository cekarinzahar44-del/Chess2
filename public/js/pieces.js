// pieces.js — BULLETPROOF: sync init, no async, no GLB

const PieceFactory = (() => {
  const T = {}; // templates
  let _built = false;

  // Materials
  let wMat, bMat;

  function _mats() {
    if (wMat) return;
    wMat = new THREE.MeshStandardMaterial({ color:0xf8f0dc, roughness:0.20, metalness:0.06 });
    bMat = new THREE.MeshStandardMaterial({ color:0x1a0e06, roughness:0.24, metalness:0.10 });
  }

  // Helpers
  function lathe(pts, s=22) {
    return new THREE.LatheGeometry(pts.map(([x,y])=>new THREE.Vector2(x,y)), s);
  }
  function addMesh(group, geo, mat) {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true; m.receiveShadow = true;
    group.add(m); return m;
  }
  function sph(r,x,y,z) { const g=new THREE.SphereGeometry(r,16,12); g.translate(x,y,z); return g; }
  function cyl(rt,rb,h,s=14,x=0,y=0,z=0) { const g=new THREE.CylinderGeometry(rt,rb,h,s); g.translate(x,y,z); return g; }
  function box(w,h,d,x=0,y=0,z=0) { const g=new THREE.BoxGeometry(w,h,d); g.translate(x,y,z); return g; }
  function cone(r,h,s=10,x=0,y=0,z=0) { const g=new THREE.ConeGeometry(r,h,s); g.translate(x,y,z); return g; }

  // ── PAWN ──────────────────────────────────────────────────────────────
  function mkPawn(mat) {
    const g = new THREE.Group();
    addMesh(g, lathe([[0,0],[.36,0],[.40,.03],[.36,.09],[.26,.13],[.20,.17],[.18,.20]],18), mat);
    addMesh(g, lathe([[.18,.20],[.13,.27],[.10,.38],[.12,.47],[.17,.52],[.18,.54]],18), mat);
    addMesh(g, lathe([[.17,.54],[.21,.57],[.21,.61],[.17,.63]],18), mat);
    addMesh(g, sph(.20,0,.83,0), mat);
    return g;
  }

  // ── ROOK ──────────────────────────────────────────────────────────────
  function mkRook(mat) {
    const g = new THREE.Group();
    addMesh(g, lathe([[0,0],[.40,0],[.44,.04],[.40,.11],[.30,.16],[.24,.21],[.24,.23]],18), mat);
    addMesh(g, lathe([[.24,.23],[.18,.31],[.15,.50],[.18,.57],[.24,.62],[.24,.64]],18), mat);
    addMesh(g, cyl(.28,.30,.30,14,0,.79), mat);
    for(let i=0;i<4;i++){
      const a=(i/4)*Math.PI*2+Math.PI/4;
      addMesh(g, box(.12,.15,.12, Math.cos(a)*.20,.97,Math.sin(a)*.20), mat);
    }
    return g;
  }

  // ── KNIGHT ────────────────────────────────────────────────────────────
  function mkKnight(mat) {
    const g = new THREE.Group();
    addMesh(g, lathe([[0,0],[.40,0],[.44,.04],[.40,.11],[.30,.17],[.24,.22],[.22,.24]],18), mat);
    addMesh(g, lathe([[.22,.24],[.16,.33],[.14,.48],[.16,.57]],14), mat);
    // Head — box + sphere for stylised horse
    addMesh(g, box(.20,.34,.22, .03,.78,.04), mat);
    addMesh(g, box(.16,.18,.20, .03,.68,.18), mat);
    addMesh(g, sph(.15,.03,.94,0), mat);
    addMesh(g, cone(.04,.11,8, .03,1.06,-.08), mat);
    return g;
  }

  // ── BISHOP ────────────────────────────────────────────────────────────
  function mkBishop(mat) {
    const g = new THREE.Group();
    addMesh(g, lathe([[0,0],[.40,0],[.44,.04],[.40,.11],[.30,.17],[.24,.22],[.22,.24]],20), mat);
    addMesh(g, lathe([[.22,.24],[.16,.32],[.12,.45],[.14,.55],[.18,.60],[.18,.62]],20), mat);
    addMesh(g, lathe([[.18,.62],[.22,.66],[.22,.70],[.18,.72]],20), mat);
    addMesh(g, lathe([[.16,.72],[.12,.82],[.08,.96],[.06,1.08],[.07,1.14]],20), mat);
    addMesh(g, sph(.08,0,1.14,0), mat);
    addMesh(g, sph(.03,0,1.26,0), mat);
    return g;
  }

  // ── QUEEN ─────────────────────────────────────────────────────────────
  function mkQueen(mat) {
    const g = new THREE.Group();
    addMesh(g, lathe([[0,0],[.44,0],[.48,.04],[.44,.12],[.34,.20],[.28,.26],[.26,.28]],22), mat);
    addMesh(g, lathe([[.26,.28],[.18,.38],[.14,.54],[.18,.62],[.26,.68],[.26,.70]],22), mat);
    addMesh(g, lathe([[.26,.70],[.30,.74],[.30,.78],[.26,.80]],22), mat);
    addMesh(g, lathe([[.24,.80],[.18,.88],[.14,.98],[.18,1.06],[.24,1.10],[.24,1.12]],22), mat);
    addMesh(g, cyl(.24,.22,.06,18,0,1.15), mat);
    for(let i=0;i<8;i++){
      const a=(i/8)*Math.PI*2;
      addMesh(g, sph(.065,Math.cos(a)*.20,1.26,Math.sin(a)*.20), mat);
    }
    addMesh(g, sph(.08,0,1.34,0), mat);
    return g;
  }

  // ── KING ──────────────────────────────────────────────────────────────
  function mkKing(mat) {
    const g = new THREE.Group();
    addMesh(g, lathe([[0,0],[.46,0],[.50,.04],[.46,.13],[.36,.22],[.30,.28],[.28,.30]],22), mat);
    addMesh(g, lathe([[.28,.30],[.20,.42],[.16,.58],[.20,.68],[.28,.74],[.28,.76]],22), mat);
    addMesh(g, lathe([[.28,.76],[.32,.80],[.32,.86],[.28,.88]],22), mat);
    addMesh(g, lathe([[.26,.88],[.20,.96],[.16,1.08],[.20,1.14],[.26,1.18],[.26,1.20]],22), mat);
    addMesh(g, sph(.10,0,1.20,0), mat);
    addMesh(g, box(.07,.38,.07, 0,1.39,0), mat);  // cross vertical
    addMesh(g, box(.26,.07,.07, 0,1.46,0), mat);  // cross horizontal
    return g;
  }

  // ── Build all ─────────────────────────────────────────────────────────
  function _build() {
    if (_built) return;
    _mats();
    const B = { p:mkPawn, r:mkRook, n:mkKnight, b:mkBishop, q:mkQueen, k:mkKing };
    ['w','b'].forEach(color => {
      const mat = color==='w' ? wMat : bMat;
      Object.entries(B).forEach(([type,fn]) => {
        T[`${type}_${color}`] = fn(mat);
      });
    });
    _built = true;
    console.log('✅ PieceFactory built:', Object.keys(T).join(', '));
  }

  // ── Public ────────────────────────────────────────────────────────────
  // init() called from app.js — sync build wrapped in resolved promise
  function init() {
    _build();
    return Promise.resolve();
  }

  function createMaterials() { _mats(); return { whiteMat:wMat, blackMat:bMat }; }

  function createPiece(type, color) {
    if (!_built) _build(); // safety net
    const key = `${type}_${color}`;
    const tmpl = T[key];
    if (!tmpl) {
      console.error('No template for', key, '— available:', Object.keys(T));
      return new THREE.Group();
    }
    const clone = tmpl.clone(true);
    clone.scale.setScalar(0.44);
    clone.userData = { type, color, isChessPiece:true };
    return clone;
  }

  return { init, createMaterials, createPiece };
})();
