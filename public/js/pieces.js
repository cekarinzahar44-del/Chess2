// pieces.js — FINAL: sharp, large, no shadows

const PieceFactory = (() => {
  const T = {};
  let _built = false;
  let wMat, bMat;

  function _mats() {
    if (wMat) return;
    // Белые — чистый слоновый цвет, чёткий
    wMat = new THREE.MeshStandardMaterial({
      color: 0xf5ead0,
      roughness: 0.15,
      metalness: 0.05,
    });
    // Чёрные — насыщенный тёмно-коричневый
    bMat = new THREE.MeshStandardMaterial({
      color: 0x180a02,
      roughness: 0.18,
      metalness: 0.08,
    });
  }

  function L(pts, s=26) {
    return new THREE.LatheGeometry(pts.map(([x,y])=>new THREE.Vector2(x,y)), s);
  }
  function add(g, geo, mat) {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = false; // ТЕНИ ОТКЛЮЧЕНЫ
    m.receiveShadow = false;
    g.add(m);
  }
  function sph(r,x=0,y=0,z=0,sw=20,sh=16) {
    const g=new THREE.SphereGeometry(r,sw,sh); g.translate(x,y,z); return g;
  }
  function cyl(rt,rb,h,s=18,x=0,y=0,z=0) {
    const g=new THREE.CylinderGeometry(rt,rb,h,s); g.translate(x,y,z); return g;
  }
  function box(w,h,d,x=0,y=0,z=0) {
    const g=new THREE.BoxGeometry(w,h,d); g.translate(x,y,z); return g;
  }

  // ── PAWN ─────────────────────────────────────────────────────────────
  function mkPawn(mat) {
    const g = new THREE.Group();
    add(g, L([[0,0],[.38,0],[.43,.04],[.38,.10],[.28,.15],[.22,.19],[.20,.22]],22), mat);
    add(g, L([[.20,.22],[.14,.30],[.11,.42],[.13,.52],[.18,.57],[.19,.59]],22), mat);
    add(g, L([[.18,.59],[.23,.63],[.23,.67],[.18,.69]],22), mat);
    add(g, sph(.22, 0,.91,0, 18,14), mat);
    return g;
  }

  // ── ROOK ─────────────────────────────────────────────────────────────
  function mkRook(mat) {
    const g = new THREE.Group();
    add(g, L([[0,0],[.42,0],[.46,.04],[.42,.12],[.32,.18],[.26,.23],[.25,.25]],22), mat);
    add(g, L([[.25,.25],[.19,.33],[.16,.52],[.19,.60],[.26,.65],[.26,.67]],22), mat);
    add(g, cyl(.30,.32,.32,16, 0,.83), mat);
    // 4 battlement blocks
    for(let i=0;i<4;i++){
      const a=(i/4)*Math.PI*2+Math.PI/4;
      const bg=new THREE.BoxGeometry(.14,.17,.14);
      bg.translate(Math.cos(a)*.22,.99+.085,Math.sin(a)*.22);
      add(g, bg, mat);
    }
    return g;
  }

  // ── KNIGHT ───────────────────────────────────────────────────────────
  function mkKnight(mat) {
    const g = new THREE.Group();
    add(g, L([[0,0],[.42,0],[.46,.04],[.42,.12],[.32,.18],[.26,.23],[.24,.25]],20), mat);
    add(g, L([[.24,.25],[.18,.35],[.15,.50],[.17,.59]],16), mat);
    // Stylised head — angled box + details
    const headGeo = new THREE.BoxGeometry(.22,.36,.26);
    headGeo.translate(.02,.80,.02);
    add(g, headGeo, mat);
    const snoutGeo = new THREE.BoxGeometry(.18,.20,.22);
    snoutGeo.translate(.02,.70,.19);
    add(g, snoutGeo, mat);
    add(g, sph(.16, .02,.97,0, 14,10), mat);
    // Ear
    const earGeo = new THREE.ConeGeometry(.05,.12,8);
    earGeo.translate(.02,1.09,-.09);
    add(g, earGeo, mat);
    // Nostril dots
    add(g, sph(.04, .08,.67,.28, 8,6), mat);
    add(g, sph(.04,-.04,.67,.28, 8,6), mat);
    return g;
  }

  // ── BISHOP ───────────────────────────────────────────────────────────
  function mkBishop(mat) {
    const g = new THREE.Group();
    add(g, L([[0,0],[.42,0],[.46,.04],[.42,.12],[.32,.18],[.26,.23],[.24,.25]],22), mat);
    add(g, L([[.24,.25],[.17,.34],[.13,.48],[.15,.58],[.20,.63],[.20,.65]],22), mat);
    add(g, L([[.20,.65],[.24,.69],[.24,.73],[.20,.75]],22), mat);
    add(g, L([[.18,.75],[.13,.86],[.09,.99],[.07,1.12],[.08,1.18]],22), mat);
    add(g, sph(.09, 0,1.18,0, 14,10), mat);
    add(g, sph(.035, 0,1.31,0, 10,8), mat);
    return g;
  }

  // ── QUEEN ────────────────────────────────────────────────────────────
  function mkQueen(mat) {
    const g = new THREE.Group();
    add(g, L([[0,0],[.46,0],[.50,.04],[.46,.13],[.36,.21],[.30,.27],[.28,.29]],24), mat);
    add(g, L([[.28,.29],[.20,.40],[.15,.56],[.19,.65],[.28,.71],[.28,.73]],24), mat);
    add(g, L([[.28,.73],[.32,.77],[.32,.81],[.28,.83]],24), mat);
    add(g, L([[.26,.83],[.20,.91],[.15,1.02],[.19,1.10],[.26,1.15],[.26,1.17]],24), mat);
    add(g, cyl(.26,.24,.07,20, 0,1.20), mat);
    // 8 crown balls
    for(let i=0;i<8;i++){
      const a=(i/8)*Math.PI*2;
      add(g, sph(.07, Math.cos(a)*.21,1.31,Math.sin(a)*.21, 10,8), mat);
    }
    add(g, sph(.09, 0,1.39,0, 12,10), mat);
    return g;
  }

  // ── KING ─────────────────────────────────────────────────────────────
  function mkKing(mat) {
    const g = new THREE.Group();
    add(g, L([[0,0],[.48,0],[.52,.04],[.48,.14],[.38,.23],[.32,.29],[.30,.31]],24), mat);
    add(g, L([[.30,.31],[.22,.44],[.17,.60],[.21,.70],[.30,.76],[.30,.78]],24), mat);
    add(g, L([[.30,.78],[.34,.82],[.34,.88],[.30,.91]],24), mat);
    add(g, L([[.28,.91],[.21,.99],[.17,1.10],[.21,1.16],[.28,1.21],[.28,1.23]],24), mat);
    add(g, sph(.11, 0,1.23,0, 14,12), mat);
    // Cross
    const cv=new THREE.BoxGeometry(.08,.40,.08); cv.translate(0,1.43,0); add(g,cv,mat);
    const ch=new THREE.BoxGeometry(.28,.08,.08); ch.translate(0,1.51,0); add(g,ch,mat);
    return g;
  }

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
    console.log('✅ Pieces built:', Object.keys(T).length);
  }

  function init() { _build(); return Promise.resolve(); }
  function createMaterials() { _mats(); return { whiteMat:wMat, blackMat:bMat }; }

  function createPiece(type, color) {
    if (!_built) _build();
    const tmpl = T[`${type}_${color}`];
    if (!tmpl) return new THREE.Group();
    const clone = tmpl.clone(true);
    clone.scale.setScalar(0.50); // крупнее
    clone.userData = { type, color, isChessPiece:true };
    return clone;
  }

  return { init, createMaterials, createPiece };
})();
