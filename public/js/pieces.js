// pieces.js — PREMIUM procedural pieces, guaranteed to work

const PieceFactory = (() => {
  const templates = {};
  let ready = false;
  let whiteMat, blackMat, whiteEdgeMat, blackEdgeMat;

  // ── Materials — called after THREE loads ──────────────────────────────
  function _initMats() {
    if (whiteMat) return;
    // Ivory white — warm, slightly metallic
    whiteMat = new THREE.MeshStandardMaterial({
      color: 0xf8f0dc, roughness: 0.18, metalness: 0.06,
      envMapIntensity: 1.5
    });
    // Ebony black — deep, rich
    blackMat = new THREE.MeshStandardMaterial({
      color: 0x1a0e06, roughness: 0.22, metalness: 0.12,
      envMapIntensity: 1.2
    });
  }

  function createMaterials() { _initMats(); return { whiteMat, blackMat }; }

  // ── Init ──────────────────────────────────────────────────────────────
  async function init() {
    _initMats();
    _buildAll();
    ready = true;
    console.log('✅ Pieces ready:', Object.keys(templates).join(', '));
  }

  // ── Lathe helper ──────────────────────────────────────────────────────
  function L(pts, segs = 24) {
    return new THREE.LatheGeometry(pts.map(([x,y]) => new THREE.Vector2(x,y)), segs);
  }

  // ── Build group ───────────────────────────────────────────────────────
  function G(mat, ...geos) {
    const g = new THREE.Group();
    geos.forEach(geo => {
      const m = new THREE.Mesh(geo, mat);
      m.castShadow = true; m.receiveShadow = true;
      g.add(m);
    });
    return g;
  }

  // ── Sphere helper ─────────────────────────────────────────────────────
  function S(r, x=0, y=0, z=0, sw=18, sh=14) {
    const g = new THREE.SphereGeometry(r, sw, sh);
    g.translate(x, y, z); return g;
  }

  // ── Box helper ────────────────────────────────────────────────────────
  function B(w, h, d, x=0, y=0, z=0) {
    const g = new THREE.BoxGeometry(w, h, d);
    g.translate(x, y, z); return g;
  }

  // ── Cylinder helper ───────────────────────────────────────────────────
  function C(rt, rb, h, segs=16, x=0, y=0, z=0) {
    const g = new THREE.CylinderGeometry(rt, rb, h, segs);
    g.translate(x, y, z); return g;
  }

  // ══════════════════════════════════════════════════════════════════════
  // PAWN — elegant, slender
  // ══════════════════════════════════════════════════════════════════════
  function mkPawn(mat) {
    return G(mat,
      L([[0,0],[.36,0],[.40,.03],[.36,.09],[.26,.13],[.20,.17],[.18,.20]], 20),      // base
      L([[.18,.20],[.13,.27],[.10,.38],[.12,.47],[.17,.52],[.18,.54]], 20),           // stem
      L([[.17,.54],[.21,.57],[.21,.60],[.17,.62]], 20),                              // collar
      S(.20, 0,.82, 0, 16,12)                                                       // head
    );
  }

  // ══════════════════════════════════════════════════════════════════════
  // ROOK — fortress tower with battlements
  // ══════════════════════════════════════════════════════════════════════
  function mkRook(mat) {
    const g = G(mat,
      L([[0,0],[.40,0],[.44,.04],[.40,.11],[.30,.17],[.24,.22],[.24,.24]], 20),
      L([[.24,.24],[.18,.32],[.15,.50],[.18,.57],[.24,.62],[.24,.64]], 20),
      C(.28,.30,.04, 16, 0,.66),
      C(.28,.28,.28, 16, 0,.80)   // tower body
    );
    // 4 battlements
    for (let i = 0; i < 4; i++) {
      const a = (i/4)*Math.PI*2 + Math.PI/4;
      const bg = B(.13,.16,.13, Math.cos(a)*.20, .96, Math.sin(a)*.20);
      const bm = new THREE.Mesh(bg, mat);
      bm.castShadow = true; g.add(bm);
    }
    return g;
  }

  // ══════════════════════════════════════════════════════════════════════
  // KNIGHT — stylised horse head
  // ══════════════════════════════════════════════════════════════════════
  function mkKnight(mat) {
    const g = G(mat,
      L([[0,0],[.40,0],[.44,.04],[.40,.12],[.30,.18],[.24,.22],[.22,.24]], 20),
      L([[.22,.24],[.16,.34],[.14,.48],[.16,.56]], 14)
    );
    // Head body
    const pts = [
      [-.09,.58],[.09,.58],[.11,.64],[.13,.76],[.11,.90],[.07,.96],
      [.04,.98],[-.04,.98],[-.08,.94],[-.11,.86],[-.12,.74],[-.10,.62],[-.09,.58]
    ];
    const shape = new THREE.Shape(pts.map(([x,y]) => new THREE.Vector2(x,y)));
    const extGeo = new THREE.ExtrudeGeometry(shape, { depth:.18, bevelEnabled:true, bevelSize:.02, bevelSegments:2 });
    extGeo.translate(0,0,-.09);
    const em = new THREE.Mesh(extGeo, mat); em.castShadow = true; g.add(em);
    // Ear
    const ear = new THREE.Mesh(new THREE.ConeGeometry(.04,.10,8), mat);
    ear.position.set(.02, 1.04, 0); ear.castShadow = true; g.add(ear);
    // Nose
    const nose = new THREE.Mesh(S(.06, .04,.72,.14, 10,8), mat); nose.castShadow = true; g.add(nose);
    return g;
  }

  // ══════════════════════════════════════════════════════════════════════
  // BISHOP — tall with mitre top
  // ══════════════════════════════════════════════════════════════════════
  function mkBishop(mat) {
    return G(mat,
      L([[0,0],[.40,0],[.44,.04],[.40,.11],[.30,.17],[.24,.22],[.22,.24]], 22),
      L([[.22,.24],[.16,.32],[.12,.46],[.14,.56],[.18,.60],[.18,.62]], 22),
      L([[.18,.62],[.22,.66],[.22,.70],[.18,.72]], 22),
      L([[.16,.72],[.12,.82],[.08,.96],[.06,1.08],[.07,1.14]], 22),
      S(.08, 0,1.14, 0, 14,10),
      S(.03, 0,1.26, 0, 10,8)   // tip
    );
  }

  // ══════════════════════════════════════════════════════════════════════
  // QUEEN — crown with 8 points
  // ══════════════════════════════════════════════════════════════════════
  function mkQueen(mat) {
    const g = G(mat,
      L([[0,0],[.44,0],[.48,.04],[.44,.12],[.34,.20],[.28,.26],[.26,.28]], 24),
      L([[.26,.28],[.18,.38],[.14,.54],[.18,.62],[.26,.68],[.26,.70]], 24),
      L([[.26,.70],[.30,.74],[.30,.78],[.26,.80]], 24),
      L([[.24,.80],[.18,.88],[.14,.98],[.18,1.06],[.24,1.10],[.24,1.12]], 24),
      C(.24,.22,.06, 20, 0,1.15)   // crown base
    );
    // 8 crown orbs
    for (let i = 0; i < 8; i++) {
      const a = (i/8)*Math.PI*2;
      const og = S(.065, Math.cos(a)*.20, 1.26, Math.sin(a)*.20, 10,8);
      const om = new THREE.Mesh(og, mat); om.castShadow = true; g.add(om);
    }
    // Central jewel
    const jg = S(.08, 0,1.32, 0, 12,10);
    const jm = new THREE.Mesh(jg, mat); jm.castShadow = true; g.add(jm);
    return g;
  }

  // ══════════════════════════════════════════════════════════════════════
  // KING — cross on top
  // ══════════════════════════════════════════════════════════════════════
  function mkKing(mat) {
    const g = G(mat,
      L([[0,0],[.46,0],[.50,.04],[.46,.13],[.36,.22],[.30,.28],[.28,.30]], 24),
      L([[.28,.30],[.20,.42],[.16,.58],[.20,.68],[.28,.74],[.28,.76]], 24),
      L([[.28,.76],[.32,.80],[.32,.86],[.28,.88]], 24),
      L([[.26,.88],[.20,.96],[.16,1.08],[.20,1.14],[.26,1.18],[.26,1.20]], 24),
      S(.10, 0,1.20, 0, 14,12),   // orb
      B(.07,.38,.07, 0,1.38, 0),  // cross vertical
      B(.26,.07,.07, 0,1.46, 0)   // cross horizontal
    );
    return g;
  }

  // ── Build all templates ───────────────────────────────────────────────
  function _buildAll() {
    const builders = { p:mkPawn, r:mkRook, n:mkKnight, b:mkBishop, q:mkQueen, k:mkKing };
    ['w','b'].forEach(color => {
      const mat = color === 'w' ? whiteMat : blackMat;
      Object.entries(builders).forEach(([type, fn]) => {
        templates[`${type}_${color}`] = fn(mat);
      });
    });
  }

  // ── Create piece ──────────────────────────────────────────────────────
  function createPiece(type, color) {
    if (!ready) { _initMats(); _buildAll(); ready = true; }
    const key = `${type}_${color}`;
    const tmpl = templates[key];
    if (!tmpl) { console.warn('No template:', key); return new THREE.Group(); }
    const clone = tmpl.clone(true);
    clone.scale.setScalar(0.44);
    clone.userData = { type, color, isChessPiece: true };
    return clone;
  }

  return { init, createMaterials, createPiece };
})();
