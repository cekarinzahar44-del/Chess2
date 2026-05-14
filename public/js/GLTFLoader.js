// GLTFLoader — lazy init, THREE.* used only when parse() is called
// Avoids "THREE is not defined" at parse time

(function() {
  // Wrap in a factory that runs AFTER THREE is loaded
  function createGLTFLoader() {

    const FILTERS = () => ({
      9728: THREE.NearestFilter, 9729: THREE.LinearFilter,
      9984: THREE.NearestMipmapNearestFilter, 9985: THREE.LinearMipmapNearestFilter,
      9986: THREE.NearestMipmapLinearFilter,  9987: THREE.LinearMipmapLinearFilter
    });
    const WRAPPINGS = () => ({
      33071: THREE.ClampToEdgeWrapping, 33648: THREE.MirroredRepeatWrapping, 10497: THREE.RepeatWrapping
    });
    const INTERPOLATION = () => ({
      CUBICSPLINE: undefined, LINEAR: THREE.InterpolateLinear, STEP: THREE.InterpolateDiscrete
    });

    const COMPONENT_TYPES = { 5120:Int8Array,5121:Uint8Array,5122:Int16Array,5123:Uint16Array,5125:Uint32Array,5126:Float32Array };
    const TYPE_SIZES = { SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT2:4,MAT3:9,MAT4:16 };
    const ATTRIBUTES  = { POSITION:'position',NORMAL:'normal',TANGENT:'tangent',TEXCOORD_0:'uv',TEXCOORD_1:'uv2',COLOR_0:'color',WEIGHTS_0:'skinWeight',JOINTS_0:'skinIndex' };
    const ALPHA_MODES = { OPAQUE:'OPAQUE',MASK:'MASK',BLEND:'BLEND' };
    const BIN_MAGIC   = 'glTF';
    const CHUNK_JSON  = 0x4E4F534A;
    const CHUNK_BIN   = 0x004E4942;

    // ── Binary GLB parser ────────────────────────────────────────────────
    function parseGLB(buffer) {
      const view = new DataView(buffer);
      const magic = String.fromCharCode(...new Uint8Array(buffer, 0, 4));
      if (magic !== BIN_MAGIC) throw new Error('Not a GLB file');
      // const version = view.getUint32(4, true);
      let json = null, bin = null;
      let offset = 12;
      while (offset < buffer.byteLength) {
        const chunkLen  = view.getUint32(offset,     true);
        const chunkType = view.getUint32(offset + 4, true);
        offset += 8;
        if (chunkType === CHUNK_JSON) {
          const bytes = new Uint8Array(buffer, offset, chunkLen);
          json = JSON.parse(new TextDecoder().decode(bytes));
        } else if (chunkType === CHUNK_BIN) {
          bin = buffer.slice(offset, offset + chunkLen);
        }
        offset += chunkLen;
      }
      if (!json) throw new Error('No JSON chunk in GLB');
      return { json, bin };
    }

    // ── Accessor → BufferAttribute ───────────────────────────────────────
    function buildAccessor(json, bin, idx) {
      const acc = json.accessors[idx];
      const bv  = json.bufferViews[acc.bufferView];
      const TypedArr = COMPONENT_TYPES[acc.componentType];
      const itemSize = TYPE_SIZES[acc.type];
      const byteOffset = (bv.byteOffset || 0) + (acc.byteOffset || 0);
      const arr = new TypedArr(bin, byteOffset, acc.count * itemSize);
      return new THREE.BufferAttribute(arr.slice(), itemSize, !!acc.normalized);
    }

    // ── Build mesh from primitive ─────────────────────────────────────────
    function buildPrimitive(json, bin, prim, materials) {
      const geo  = new THREE.BufferGeometry();
      for (const [name, idx] of Object.entries(prim.attributes)) {
        const attr = ATTRIBUTES[name];
        if (attr) geo.setAttribute(attr, buildAccessor(json, bin, idx));
      }
      if (prim.indices !== undefined) geo.setIndex(buildAccessor(json, bin, prim.indices));
      const mat = prim.material !== undefined ? materials[prim.material] : new THREE.MeshStandardMaterial();
      return new THREE.Mesh(geo, mat);
    }

    // ── Build PBR material ────────────────────────────────────────────────
    function buildMaterial(json, matDef) {
      const params = {};
      const pbr = matDef.pbrMetallicRoughness || {};
      if (pbr.baseColorFactor) {
        const [r,g,b,a] = pbr.baseColorFactor;
        params.color   = new THREE.Color(r, g, b);
        params.opacity = a;
        if (a < 1) params.transparent = true;
      }
      params.metalness = pbr.metallicFactor  !== undefined ? pbr.metallicFactor  : 1.0;
      params.roughness = pbr.roughnessFactor !== undefined ? pbr.roughnessFactor : 1.0;
      if (matDef.alphaMode === 'BLEND') { params.transparent = true; params.depthWrite = false; }
      if (matDef.alphaMode === 'MASK')  { params.alphaTest = matDef.alphaCutoff !== undefined ? matDef.alphaCutoff : 0.5; }
      if (matDef.doubleSided) params.side = THREE.DoubleSide;
      const mat = new THREE.MeshStandardMaterial(params);
      mat.name = matDef.name || '';
      return mat;
    }

    // ── Build scene graph ─────────────────────────────────────────────────
    function buildNode(json, bin, nodeIdx, meshObjects) {
      const nd   = json.nodes[nodeIdx];
      let obj;

      if (nd.mesh !== undefined) {
        const meshDef = json.meshes[nd.mesh];
        if (meshDef.primitives.length === 1) {
          obj = meshObjects[nd.mesh][0];
        } else {
          obj = new THREE.Group();
          meshObjects[nd.mesh].forEach(m => obj.add(m));
        }
      } else {
        obj = new THREE.Group();
      }

      obj.name = nd.name || '';

      if (nd.matrix) {
        obj.applyMatrix4(new THREE.Matrix4().fromArray(nd.matrix));
      } else {
        if (nd.translation) obj.position.fromArray(nd.translation);
        if (nd.rotation)    obj.quaternion.fromArray(nd.rotation);
        if (nd.scale)       obj.scale.fromArray(nd.scale);
      }

      if (nd.children) {
        nd.children.forEach(ci => obj.add(buildNode(json, bin, ci, meshObjects)));
      }
      return obj;
    }

    // ── Main parse ────────────────────────────────────────────────────────
    function parse(buffer) {
      const { json, bin } = parseGLB(buffer);

      // Materials
      const materials = (json.materials || []).map(m => buildMaterial(json, m));

      // Meshes — array of arrays of Mesh
      const meshObjects = (json.meshes || []).map(meshDef =>
        meshDef.primitives.map(prim => buildPrimitive(json, bin, prim, materials))
      );

      // Scene
      const sceneDef = json.scenes[json.scene || 0];
      const root = new THREE.Group();
      root.name = sceneDef.name || 'Scene';
      (sceneDef.nodes || []).forEach(ni => root.add(buildNode(json, bin, ni, meshObjects)));

      return { scene: root, scenes: [root], animations: [], asset: json.asset, json };
    }

    // ── Loader class ──────────────────────────────────────────────────────
    THREE.GLTFLoader = function() {};
    THREE.GLTFLoader.prototype.load = function(url, onLoad, onProgress, onError) {
      fetch(url)
        .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status + ' loading ' + url); return r.arrayBuffer(); })
        .then(buf => { onLoad(parse(buf)); })
        .catch(err => { if (onError) onError(err); else console.error(err); });
    };
  }

  // Register factory — called from app.js AFTER three.min.js loads
  window.__initGLTFLoader = createGLTFLoader;
})();
