// GLTFLoader for Three.js r128 — embedded, no CDN dependency
// Source: https://github.com/mrdoob/three.js/blob/r128/examples/js/loaders/GLTFLoader.js
// Minified & embedded for reliable offline/bothost use

( function () {

	class GLTFLoader extends THREE.Loader {
		constructor( manager ) {
			super( manager );
			this.dracoLoader = null;
			this.ktx2Loader = null;
			this.meshoptDecoder = null;
			this.pluginCallbacks = [];
			this.register( function ( parser ) { return new GLTFMaterialsClearcoatExtension( parser ); } );
			this.register( function ( parser ) { return new GLTFTextureBasisUExtension( parser ); } );
			this.register( function ( parser ) { return new GLTFTextureWebPExtension( parser ); } );
			this.register( function ( parser ) { return new GLTFMaterialsTransmissionExtension( parser ); } );
			this.register( function ( parser ) { return new GLTFMaterialsVolumeExtension( parser ); } );
			this.register( function ( parser ) { return new GLTFMaterialsIorExtension( parser ); } );
			this.register( function ( parser ) { return new GLTFMaterialsSpecularExtension( parser ); } );
			this.register( function ( parser ) { return new GLTFLightsExtension( parser ); } );
			this.register( function ( parser ) { return new GLTFMeshoptCompression( parser ); } );
		}
		load( url, onLoad, onProgress, onError ) {
			const scope = this;
			let resourcePath;
			if ( this.resourcePath !== '' ) resourcePath = this.resourcePath;
			else if ( this.path !== '' ) resourcePath = this.path;
			else resourcePath = THREE.LoaderUtils.extractUrlBase( url );
			this.manager.itemStart( url );
			const _onError = function ( e ) {
				if ( onError ) onError( e );
				else console.error( e );
				scope.manager.itemError( url );
				scope.manager.itemEnd( url );
			};
			const loader = new THREE.FileLoader( this.manager );
			loader.setPath( this.path );
			loader.setResponseType( 'arraybuffer' );
			loader.setRequestHeader( this.requestHeader );
			loader.setWithCredentials( this.withCredentials );
			loader.load( url, function ( data ) {
				try {
					scope.parse( data, resourcePath, function ( gltf ) {
						onLoad( gltf );
						scope.manager.itemEnd( url );
					}, _onError );
				} catch ( e ) {
					_onError( e );
				}
			}, onProgress, _onError );
		}
		setDRACOLoader( dracoLoader ) { this.dracoLoader = dracoLoader; return this; }
		setDDSLoader() { throw new Error( 'THREE.GLTFLoader: "MSFT_texture_dds" no longer supported. Please update.' ); }
		setKTX2Loader( ktx2Loader ) { this.ktx2Loader = ktx2Loader; return this; }
		setMeshoptDecoder( meshoptDecoder ) { this.meshoptDecoder = meshoptDecoder; return this; }
		register( callback ) { if ( this.pluginCallbacks.indexOf( callback ) === - 1 ) this.pluginCallbacks.push( callback ); return this; }
		unregister( callback ) { if ( this.pluginCallbacks.indexOf( callback ) !== - 1 ) this.pluginCallbacks.splice( this.pluginCallbacks.indexOf( callback ), 1 ); return this; }
		parse( data, path, onLoad, onError ) {
			let json = {}; let extensions = {}; let plugins = {};
			const textDecoder = new TextDecoder();
			if ( typeof data === 'string' ) {
				json = JSON.parse( data );
			} else if ( data instanceof ArrayBuffer ) {
				const magic = textDecoder.decode( new Uint8Array( data, 0, 4 ) );
				if ( magic === BINARY_EXTENSION_HEADER_MAGIC ) {
					try {
						extensions[ EXTENSIONS.KHR_BINARY_GLTF ] = new GLTFBinaryExtension( data );
					} catch ( error ) { if ( onError ) onError( error ); return; }
					json = extensions[ EXTENSIONS.KHR_BINARY_GLTF ].content;
				} else {
					json = JSON.parse( textDecoder.decode( data ) );
				}
			} else {
				json = data;
			}
			if ( json.asset === undefined || json.asset.version[ 0 ] < 2 ) {
				if ( onError ) onError( new Error( 'THREE.GLTFLoader: Unsupported asset. glTF versions >=2.0 are supported.' ) );
				return;
			}
			const parser = new GLTFParser( json, { path: path || this.resourcePath || '', crossOrigin: this.crossOrigin, requestHeader: this.requestHeader, manager: this.manager, ktx2Loader: this.ktx2Loader, meshoptDecoder: this.meshoptDecoder } );
			parser.fileLoader.setRequestHeader( this.requestHeader );
			for ( let i = 0; i < this.pluginCallbacks.length; i ++ ) {
				const plugin = this.pluginCallbacks[ i ]( parser );
				plugins[ plugin.name ] = plugin;
				extensions[ plugin.name ] = true;
			}
			if ( extensions[ EXTENSIONS.KHR_DRACO_MESH_COMPRESSION ] ) {
				if ( ! this.dracoLoader ) throw new Error( 'THREE.GLTFLoader: No DRACOLoader instance provided.' );
				parser.setDRACOLoader( this.dracoLoader );
			}
			if ( extensions[ EXTENSIONS.KHR_MESH_QUANTIZATION ] ) extensions[ EXTENSIONS.KHR_MESH_QUANTIZATION ] = new GLTFMeshQuantizationExtension();
			parser.setExtensions( extensions );
			parser.setPlugins( plugins );
			parser.parse( onLoad, onError );
		}
		parseAsync( data, path ) {
			const scope = this;
			return new Promise( function ( resolve, reject ) { scope.parse( data, path, resolve, reject ); } );
		}
	}

	/* CONSTANTS */
	const WEBGL_CONSTANTS = { FLOAT: 5126, FLOAT_MAT3: 35675, FLOAT_MAT4: 35676, FLOAT_VEC2: 35664, FLOAT_VEC3: 35665, FLOAT_VEC4: 35666, LINEAR: 9729, REPEAT: 10497, SAMPLER_2D: 35678, POINTS: 0, LINES: 1, LINE_LOOP: 2, LINE_STRIP: 3, TRIANGLES: 4, TRIANGLE_STRIP: 5, TRIANGLE_FAN: 6, UNSIGNED_BYTE: 5121, UNSIGNED_SHORT: 5123 };
	const WEBGL_COMPONENT_TYPES = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };
	const WEBGL_FILTERS = { 9728: THREE.NearestFilter, 9729: THREE.LinearFilter, 9984: THREE.NearestMipmapNearestFilter, 9985: THREE.LinearMipmapNearestFilter, 9986: THREE.NearestMipmapLinearFilter, 9987: THREE.LinearMipmapLinearFilter };
	const WEBGL_WRAPPINGS = { 33071: THREE.ClampToEdgeWrapping, 33648: THREE.MirroredRepeatWrapping, 10497: THREE.RepeatWrapping };
	const WEBGL_TYPE_SIZES = { 'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT2': 4, 'MAT3': 9, 'MAT4': 16 };
	const ATTRIBUTES = { POSITION: 'position', NORMAL: 'normal', TANGENT: 'tangent', TEXCOORD_0: 'uv', TEXCOORD_1: 'uv2', COLOR_0: 'color', WEIGHTS_0: 'skinWeight', JOINTS_0: 'skinIndex' };
	const PATH_PROPERTIES = { scale: 'scale', translation: 'position', rotation: 'quaternion', weights: 'morphTargetInfluences' };
	const INTERPOLATION = { CUBICSPLINE: undefined, LINEAR: THREE.InterpolateLinear, STEP: THREE.InterpolateDiscrete };
	const ALPHA_MODES = { OPAQUE: 'OPAQUE', MASK: 'MASK', BLEND: 'BLEND' };
	const EXTENSIONS = { KHR_BINARY_GLTF: 'KHR_binary_glTF', KHR_DRACO_MESH_COMPRESSION: 'KHR_draco_mesh_compression', KHR_LIGHTS_PUNCTUAL: 'KHR_lights_punctual', KHR_MATERIALS_CLEARCOAT: 'KHR_materials_clearcoat', KHR_MATERIALS_IOR: 'KHR_materials_ior', KHR_MATERIALS_PBR_SPECULAR_GLOSSINESS: 'KHR_materials_pbrSpecularGlossiness', KHR_MATERIALS_SPECULAR: 'KHR_materials_specular', KHR_MATERIALS_TRANSMISSION: 'KHR_materials_transmission', KHR_MATERIALS_UNLIT: 'KHR_materials_unlit', KHR_MATERIALS_VOLUME: 'KHR_materials_volume', KHR_MESH_QUANTIZATION: 'KHR_mesh_quantization', KHR_TEXTURE_BASISU: 'KHR_texture_basisu', KHR_TEXTURE_TRANSFORM: 'KHR_texture_transform', KHR_MESH_QUANTIZATION: 'KHR_mesh_quantization', EXT_TEXTURE_WEBP: 'EXT_texture_webp', EXT_MESHOPT_COMPRESSION: 'EXT_meshopt_compression' };

	/* Binary Extension */
	const BINARY_EXTENSION_HEADER_MAGIC = 'glTF';
	const BINARY_EXTENSION_HEADER_LENGTH = 12;
	const BINARY_EXTENSION_CHUNK_TYPES = { JSON: 0x4E4F534A, BIN: 0x004E4942 };

	class GLTFBinaryExtension {
		constructor( data ) {
			this.name = EXTENSIONS.KHR_BINARY_GLTF;
			this.content = null; this.body = null;
			const headerView = new DataView( data, 0, BINARY_EXTENSION_HEADER_LENGTH );
			this.header = { magic: THREE.LoaderUtils.decodeText( new Uint8Array( data.slice( 0, 4 ) ) ), version: headerView.getUint32( 4, true ), length: headerView.getUint32( 8, true ) };
			if ( this.header.magic !== BINARY_EXTENSION_HEADER_MAGIC ) throw new Error( 'THREE.GLTFLoader: Unsupported glTF-Binary header.' );
			else if ( this.header.version < 2.0 ) throw new Error( 'THREE.GLTFLoader: Legacy binary file detected.' );
			const chunkContentsLength = this.header.length - BINARY_EXTENSION_HEADER_LENGTH;
			const chunkView = new DataView( data, BINARY_EXTENSION_HEADER_LENGTH );
			let chunkIndex = 0;
			while ( chunkIndex < chunkContentsLength ) {
				const chunkLength = chunkView.getUint32( chunkIndex, true ); chunkIndex += 4;
				const chunkType = chunkView.getUint32( chunkIndex, true ); chunkIndex += 4;
				if ( chunkType === BINARY_EXTENSION_CHUNK_TYPES.JSON ) {
					const contentArray = new Uint8Array( data, BINARY_EXTENSION_HEADER_LENGTH + chunkIndex, chunkLength );
					this.content = THREE.LoaderUtils.decodeText( contentArray );
				} else if ( chunkType === BINARY_EXTENSION_CHUNK_TYPES.BIN ) {
					const byteOffset = BINARY_EXTENSION_HEADER_LENGTH + chunkIndex;
					this.body = data.slice( byteOffset, byteOffset + chunkLength );
				}
				chunkIndex += chunkLength;
			}
			if ( this.content === null ) throw new Error( 'THREE.GLTFLoader: JSON content not found.' );
		}
	}

	/* Texture Transform */
	class GLTFTextureBasisUExtension { constructor(p){this.parser=p;this.name=EXTENSIONS.KHR_TEXTURE_BASISU;} loadTexture(ti){const p=this.parser,j=p.json;const ext=j.textures[ti].extensions;if(!ext||!ext[this.name])return null;const ei=ext[this.name];const sl=p.options.ktx2Loader;if(!sl){console.warn('THREE.GLTFLoader: KTX2Loader not provided. Falling back to default texture.');return null;}const s=j.images[ei.source];const l=p.textureLoader;p.assignTexture(p.associations.get(l),ti,l);return sl.load(p.resolveURI(s.uri||''));} }
	class GLTFTextureWebPExtension { constructor(p){this.parser=p;this.name=EXTENSIONS.EXT_TEXTURE_WEBP;this.isSupported=null;} loadTexture(ti){const n=this.name,p=this.parser,j=p.json;const ext=j.textures[ti].extensions;if(!ext||!ext[n])return null;const ei=ext[n];return this.detectSupport().then(s=>{if(s)return p.loadTextureImage(ti,ei.source,p.textureLoader);if(j.textures[ti].source!==undefined)return p.loadTexture(ti);return null;});} detectSupport(){if(!this.isSupported){this.isSupported=new Promise(r=>{const i=new Image;i.src='data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA';i.onload=i.onerror=()=>r(i.height===1);});}return this.isSupported;} }
	class GLTFMaterialsClearcoatExtension { constructor(p){this.parser=p;this.name=EXTENSIONS.KHR_MATERIALS_CLEARCOAT;} getMaterialType(mi){const p=this.parser,me=p.json.materials[mi];if(!me.extensions||!me.extensions[this.name])return null;return THREE.MeshPhysicalMaterial;} extendMaterialParams(mi,mp){const p=this.parser,me=p.json.materials[mi];const ext=me.extensions&&me.extensions[this.name];if(!ext)return Promise.resolve();const pe=[];if(ext.clearcoatFactor!==undefined)mp.clearcoat=ext.clearcoatFactor;if(ext.clearcoatRoughnessTexture!==undefined)pe.push(p.assignTexture(mp,'clearcoatRoughnessMap',ext.clearcoatRoughnessTexture));if(ext.clearcoatNormalTexture!==undefined){pe.push(p.assignTexture(mp,'clearcoatNormalMap',ext.clearcoatNormalTexture));if(ext.clearcoatNormalTexture.scale!==undefined){const s=ext.clearcoatNormalTexture.scale;mp.clearcoatNormalScale=new THREE.Vector2(s,s);}}return Promise.all(pe);} }
	class GLTFMaterialsTransmissionExtension { constructor(p){this.parser=p;this.name=EXTENSIONS.KHR_MATERIALS_TRANSMISSION;} getMaterialType(mi){const p=this.parser,me=p.json.materials[mi];if(!me.extensions||!me.extensions[this.name])return null;return THREE.MeshPhysicalMaterial;} extendMaterialParams(mi,mp){const p=this.parser,me=p.json.materials[mi];const ext=me.extensions&&me.extensions[this.name];if(!ext)return Promise.resolve();const pe=[];if(ext.transmissionFactor!==undefined)mp.transmission=ext.transmissionFactor;if(ext.transmissionTexture!==undefined)pe.push(p.assignTexture(mp,'transmissionMap',ext.transmissionTexture));return Promise.all(pe);} }
	class GLTFMaterialsVolumeExtension { constructor(p){this.parser=p;this.name=EXTENSIONS.KHR_MATERIALS_VOLUME;} getMaterialType(mi){const p=this.parser,me=p.json.materials[mi];if(!me.extensions||!me.extensions[this.name])return null;return THREE.MeshPhysicalMaterial;} extendMaterialParams(mi,mp){const p=this.parser,me=p.json.materials[mi];const ext=me.extensions&&me.extensions[this.name];if(!ext)return Promise.resolve();const pe=[];mp.thickness=ext.thicknessFactor!==undefined?ext.thicknessFactor:0;if(ext.thicknessTexture!==undefined)pe.push(p.assignTexture(mp,'thicknessMap',ext.thicknessTexture));if(ext.attenuationDistance!==undefined)mp.attenuationDistance=ext.attenuationDistance;const ac=ext.attenuationColor;if(ac!==undefined)mp.attenuationColor=new THREE.Color(ac[0],ac[1],ac[2]);return Promise.all(pe);} }
	class GLTFMaterialsIorExtension { constructor(p){this.parser=p;this.name=EXTENSIONS.KHR_MATERIALS_IOR;} getMaterialType(mi){const p=this.parser,me=p.json.materials[mi];if(!me.extensions||!me.extensions[this.name])return null;return THREE.MeshPhysicalMaterial;} extendMaterialParams(mi,mp){const p=this.parser,me=p.json.materials[mi];const ext=me.extensions&&me.extensions[this.name];if(!ext)return Promise.resolve();mp.ior=ext.ior!==undefined?ext.ior:1.5;return Promise.resolve();} }
	class GLTFMaterialsSpecularExtension { constructor(p){this.parser=p;this.name=EXTENSIONS.KHR_MATERIALS_SPECULAR;} getMaterialType(mi){const p=this.parser,me=p.json.materials[mi];if(!me.extensions||!me.extensions[this.name])return null;return THREE.MeshPhysicalMaterial;} extendMaterialParams(mi,mp){const p=this.parser,me=p.json.materials[mi];const ext=me.extensions&&me.extensions[this.name];if(!ext)return Promise.resolve();const pe=[];mp.specularIntensity=ext.specularFactor!==undefined?ext.specularFactor:1.0;if(ext.specularTexture!==undefined)pe.push(p.assignTexture(mp,'specularIntensityMap',ext.specularTexture));const sc=ext.specularColorFactor;mp.specularColor=sc!==undefined?new THREE.Color(sc[0],sc[1],sc[2]):new THREE.Color(1,1,1);if(ext.specularColorTexture!==undefined)pe.push(p.assignTexture(mp,'specularColorMap',ext.specularColorTexture));return Promise.all(pe);} }
	class GLTFLightsExtension { constructor(p){this.parser=p;this.name=EXTENSIONS.KHR_LIGHTS_PUNCTUAL;this.cache={refs:{},uses:{}};} _markDefs(){const p=this.parser,nl=p.json.nodes||[];for(let ni=0,nl2=nl.length;ni<nl2;ni++){const ne=nl[ni];if(ne.extensions&&ne.extensions[this.name]&&ne.extensions[this.name].light!==undefined)p._addNodeRef(this.cache,ne.extensions[this.name].light);}} _loadLight(li){const p=this.parser,c=this.cache;let ld=c[li];if(ld!==undefined)return ld;const ls=(p.json.extensions[this.name]||{}).lights||[];const ld2=ls[li];let ltype;if(!ld2.type)throw new Error('THREE.GLTFLoader: Missing KHR_lights_punctual light type.');if(ld2.type==='directional')ltype=THREE.DirectionalLight;else if(ld2.type==='point')ltype=THREE.PointLight;else if(ld2.type==='spot')ltype=THREE.SpotLight;else throw new Error('THREE.GLTFLoader: Invalid KHR_lights_punctual light type: '+ld2.type);const lc=ld2.color||[1,1,1];const li2=new ltype(new THREE.Color(lc[0],lc[1],lc[2]));li2.name=p.createUniqueName(ld2.name||('light_'+li));li2.intensity=ld2.intensity!==undefined?ld2.intensity:1;if(li2.isDirectionalLight)li2.target.position.set(0,0,-1),li2.add(li2.target);else if(li2.isPointLight)li2.distance=ld2.range||0;else if(li2.isSpotLight){li2.distance=ld2.range||0;ld2.spot=ld2.spot||{};li2.angle=ld2.spot.outerConeAngle!==undefined?ld2.spot.outerConeAngle:Math.PI/4;li2.penumbra=ld2.spot.innerConeAngle!==undefined?1.0-ld2.spot.innerConeAngle/li2.angle:0;}c[li]=ld2=Promise.resolve(li2);return ld2;} createNodeAttachment(ni){const s=this;const p=this.parser,j=p.json,ne=(j.nodes||[])[ni];if(!ne||!ne.extensions||!ne.extensions[this.name])return null;const le=ne.extensions[this.name];if(le.light===undefined)return null;return this._loadLight(le.light).then(l=>p._getNodeRef(s.cache,le.light,l));} }
	class GLTFMeshoptCompression { constructor(p){this.name=EXTENSIONS.EXT_MESHOPT_COMPRESSION;this.parser=p;} loadBufferView(i){const j=this.parser.json;const bv=j.bufferViews[i];if(bv.extensions&&bv.extensions[this.name]){const e=bv.extensions[this.name];return this.parser.getDependency('buffer',e.buffer).then(b=>{const d=this.parser.options.meshoptDecoder;if(!d)throw new Error('THREE.GLTFLoader: No MeshoptDecoder instance provided.');const r=new Uint8Array(b,e.byteOffset||0,e.byteLength);const t=new ArrayBuffer(e.count*e.byteStride);const ta=new Uint8Array(t);return Promise.resolve(d.ready).then(()=>{d.decodeGltfBuffer(ta,e.count,e.byteStride,r,e.mode,e.filter);return t;});});}else return null;} }
	class GLTFMeshQuantizationExtension { constructor(){this.name=EXTENSIONS.KHR_MESH_QUANTIZATION;} }

	/* GLTF Parser */
	class GLTFParser {
		constructor( json = {}, options = {} ) {
			this.json = json; this.extensions = {}; this.plugins = {}; this.options = options;
			this.cache = new GLTFRegistry(); this.associations = new Map();
			this.primitiveCache = {}; this.meshCache = { refs: {}, uses: {} };
			this.cameraCache = { refs: {}, uses: {} }; this.lightCache = { refs: {}, uses: {} };
			this.textureCache = {}; this.nodeNamesUsed = {};
			this.textureLoader = new THREE.TextureLoader( this.options.manager );
			this.textureLoader.setCrossOrigin( this.options.crossOrigin );
			this.textureLoader.setRequestHeader( this.options.requestHeader );
			this.fileLoader = new THREE.FileLoader( this.options.manager );
			this.fileLoader.setResponseType( 'arraybuffer' );
			if ( this.options.crossOrigin === 'use-credentials' ) this.fileLoader.setWithCredentials( true );
		}
		setExtensions( e ) { this.extensions = e; }
		setPlugins( p ) { this.plugins = p; }
		parse( onLoad, onError ) {
			const p = this; const j = this.json; const e = this.extensions;
			this.markDefs();
			Promise.all( [ this.getDependencies( 'scene' ), this.getDependencies( 'animation' ), this.getDependencies( 'camera' ) ] ).then( function ( d ) {
				const r = { scene: d[0][j.scene||0], scenes: d[0], animations: d[1], cameras: d[2], asset: j.asset, parser: p, userData: {} };
				THREE.PropertyBinding.sanitizeNodeName = function(n) { return n.replace( /[^\w-_.]/g, '_' ); };
				addUnknownExtensionsToUserData( e, r, j );
				assignExtrasToUserData( r, j );
				onLoad( r );
			} ).catch( onError );
		}
		markDefs() {
			const nRefs = this.meshCache.refs; const nUses = this.meshCache.uses;
			const nDefs = this.json.nodes || [];
			for ( let i = 0, il = nDefs.length; i < il; i++ ) {
				const nd = nDefs[ i ];
				if ( nd.mesh !== undefined ) { this._addNodeRef( this.meshCache, nd.mesh ); }
				if ( nd.camera !== undefined ) { this._addNodeRef( this.cameraCache, nd.camera ); }
			}
			for ( const n in this.plugins ) { const pl = this.plugins[n]; if ( pl._markDefs ) pl._markDefs(); }
		}
		_addNodeRef( c, i ) { if ( i === undefined ) return; if ( c.refs[i] === undefined ) { c.refs[i] = 0; c.uses[i] = 0; } c.refs[i]++; }
		_getNodeRef( c, i, o ) { if ( c.refs[i] <= 1 ) return o; const r = o.clone(); const as = this.associations.get(o); if (as) this.associations.set(r, as); r.name += '_instance_' + (c.uses[i]++); return r; }
		_invokeOne( f ) { const pl = Object.values( this.plugins ); for ( let i = 0; i < pl.length; i++ ) { const r = f( pl[i] ); if ( r ) return r; } return null; }
		_invokeAll( f ) { const pl = Object.values( this.plugins ); const r = []; for ( let i = 0; i < pl.length; i++ ) { const ri = f( pl[i] ); if ( ri ) r.push( ri ); } return r; }
		getDependency( t, i ) {
			const k = t + ':' + i; let d = this.cache.get( k );
			if ( !d ) {
				switch(t) {
					case 'scene': d = this.loadScene(i); break;
					case 'node': d = this.loadNode(i); break;
					case 'mesh': d = this._invokeOne(p=>p.loadMesh&&p.loadMesh(i)) || this.loadMesh(i); break;
					case 'accessor': d = this.loadAccessor(i); break;
					case 'bufferView': d = this._invokeOne(p=>p.loadBufferView&&p.loadBufferView(i)) || this.loadBufferView(i); break;
					case 'buffer': d = this.loadBuffer(i); break;
					case 'material': d = this._invokeOne(p=>p.loadMaterial&&p.loadMaterial(i)) || this.loadMaterial(i); break;
					case 'texture': d = this._invokeOne(p=>p.loadTexture&&p.loadTexture(i)) || this.loadTexture(i); break;
					case 'skin': d = this.loadSkin(i); break;
					case 'animation': d = this.loadAnimation(i); break;
					case 'camera': d = this.loadCamera(i); break;
					default: throw new Error('Unknown type: '+t);
				}
				this.cache.add(k, d);
			}
			return d;
		}
		getDependencies( t ) { let d = this.cache.get(t); if (!d) { const j = this.json; const ds = j[t+'s']||j[t]||[]; d = Promise.all(ds.map((_,i)=>this.getDependency(t,i))); this.cache.add(t,d); } return d; }
		loadBuffer( i ) {
			const bDef = this.json.buffers[i]; const opts = this.options;
			if ( bDef.type && bDef.type !== 'arraybuffer' ) throw new Error('THREE.GLTFLoader: '+bDef.type+' buffer type is not supported.');
			if ( bDef.uri === undefined && i === 0 ) {
				return Promise.resolve( this.extensions[EXTENSIONS.KHR_BINARY_GLTF].body );
			}
			const l = this.fileLoader;
			return new Promise((res,rej)=>l.load(this.resolveURI(bDef.uri),res,undefined,()=>rej(new Error('THREE.GLTFLoader: Failed to load buffer "'+bDef.uri+'".'))));
		}
		loadBufferView( i ) {
			const bvDef = this.json.bufferViews[i];
			return this.getDependency('buffer', bvDef.buffer).then(b=>{
				const bLen = bvDef.byteLength||0; const bOff = bvDef.byteOffset||0;
				return b.slice(bOff, bOff+bLen);
			});
		}
		loadAccessor( i ) {
			const j = this.json; const p = this;
			const aDef = j.accessors[i];
			if ( aDef.bufferView === undefined && aDef.sparse === undefined ) {
				return Promise.resolve( new THREE.BufferAttribute( new WEBGL_COMPONENT_TYPES[aDef.componentType](WEBGL_TYPE_SIZES[aDef.type]*aDef.count), WEBGL_TYPE_SIZES[aDef.type] ) );
			}
			const pend = [];
			if ( aDef.bufferView !== undefined ) pend.push( this.getDependency('bufferView', aDef.bufferView) ); else pend.push(null);
			if ( aDef.sparse !== undefined ) { pend.push(this.getDependency('bufferView', aDef.sparse.indices.bufferView)); pend.push(this.getDependency('bufferView', aDef.sparse.values.bufferView)); }
			return Promise.all(pend).then(d=>{
				const bv = d[0]; const aDef2 = j.accessors[i];
				const itemSize = WEBGL_TYPE_SIZES[aDef2.type]; const TypedArray = WEBGL_COMPONENT_TYPES[aDef2.componentType];
				const eS = aDef2.componentType===5125?4:TypedArray.BYTES_PER_ELEMENT; const bS = aDef2.byteStride&&aDef2.byteStride!==itemSize*eS?aDef2.byteStride:0;
				let array; const bO = aDef2.byteOffset||0;
				if (bS) { const cS = bS/eS; const bA = new TypedArray(bv,0,cS*(aDef2.count-1)+itemSize); array = new TypedArray(aDef2.count*itemSize); for(let i2=0;i2<aDef2.count;i2++) for(let j2=0;j2<itemSize;j2++) array[i2*itemSize+j2]=bA[i2*cS+j2]; }
				else array = new TypedArray(bv, bO, aDef2.count*itemSize);
				if (aDef2.sparse!==undefined) { const iS=WEBGL_COMPONENT_TYPES[aDef2.sparse.indices.componentType]; const iO=aDef2.sparse.indices.byteOffset||0; const vO=aDef2.sparse.values.byteOffset||0; const si=new iS(d[1],iO,aDef2.sparse.count); const sv=new TypedArray(d[2],vO,itemSize*aDef2.sparse.count); for(let i2=0;i2<aDef2.sparse.count;i2++) for(let j2=0;j2<itemSize;j2++) array[si[i2]*itemSize+j2]=sv[i2*itemSize+j2]; }
				const ba = bS ? new THREE.InterleavedBufferAttribute(new THREE.InterleavedBuffer(array, bS/eS), itemSize, bO/eS, aDef2.normalized) : new THREE.BufferAttribute(array, itemSize, aDef2.normalized);
				return ba;
			});
		}
		loadTexture( i ) {
			const j = this.json; const opts = this.options; const tDef = j.textures[i];
			const src = j.images[tDef.source]; const l = this.textureLoader;
			let sU; if(src.uri) sU = this.resolveURI(src.uri); else if(src.bufferView!==undefined) { sU = this.getDependency('bufferView',src.bufferView).then(bv=>{ const blob=new Blob([bv],{type:src.mimeType}); sU=URL.createObjectURL(blob); return sU; }); }
			const tex = this.textureLoader.load(typeof sU==='string'?sU:'');
			if(tDef.sampler!==undefined) { const s=j.samplers[tDef.sampler]; tex.magFilter=WEBGL_FILTERS[s.magFilter]||THREE.LinearFilter; tex.minFilter=WEBGL_FILTERS[s.minFilter]||THREE.LinearMipmapLinearFilter; tex.wrapS=WEBGL_WRAPPINGS[s.wrapS]||THREE.RepeatWrapping; tex.wrapT=WEBGL_WRAPPINGS[s.wrapT]||THREE.RepeatWrapping; }
			this.associations.set(tex, {type:'textures',index:i}); return Promise.resolve(tex);
		}
		assignTexture( mp, n, tI ) { return this.getDependency('texture', tI.index).then(t=>{ if(tI.texCoord!==undefined&&tI.texCoord>0) t.channel=tI.texCoord; const e=tI.extensions; if(e&&e[EXTENSIONS.KHR_TEXTURE_TRANSFORM]){ const tt=e[EXTENSIONS.KHR_TEXTURE_TRANSFORM]; if(tt.offset!==undefined)t.offset.fromArray(tt.offset); if(tt.rotation!==undefined)t.rotation=tt.rotation; if(tt.scale!==undefined)t.repeat.fromArray(tt.scale); if(tt.texCoord!==undefined)t.channel=tt.texCoord; t.needsUpdate=true; } mp[n]=t; }); }
		assignFinalMaterial(m) { const g=m.geometry; let mat=m.material; const uT=!!g.attributes.tangent; const uVC=!!g.attributes.color; const uFN=!g.attributes.normal; const uMS=m.isSkinnedMesh; if(uT||uVC||uFN||uMS) { const p={}; if(mat.isMeshStandardMaterial||mat.isMeshPhysicalMaterial) { if(uFN) p.flatShading=true; if(uVC) p.vertexColors=true; if(uT) p.normalScale=mat.normalScale; if(uMS) p.skinning=true; } if(!m.isSkinnedMesh) { const cm=THREE.Cache.get(mat.uuid+JSON.stringify(p)); if(cm) mat=cm; else { mat=mat.clone(); Object.assign(mat,p); if(uMS) mat.skinning=true; THREE.Cache.add(mat.uuid+JSON.stringify(p),mat); } } } m.material=mat; }
		getMaterialType() { return THREE.MeshStandardMaterial; }
		loadMaterial( i ) {
			const p = this; const j = this.json; const e = this.extensions; const mDef = j.materials[i];
			let mT; const eN = []; const pend = [];
			if ( mDef.extensions ) for ( const n in mDef.extensions ) { const ep = e[n]&&e[n].getMaterialType&&e[n].getMaterialType(i); if (ep) { eN.push(n); mT = ep; } }
			if (!mT) mT = this.getMaterialType(i);
			const mp = { name: mDef.name||'' };
			const pbrM = mDef.pbrMetallicRoughness||{};
			if ( pbrM.baseColorFactor ) { const c=pbrM.baseColorFactor; mp.color=new THREE.Color(c[0],c[1],c[2]); mp.opacity=c[3]; }
			if ( pbrM.baseColorTexture ) pend.push(p.assignTexture(mp,'map',pbrM.baseColorTexture));
			mp.metalness = pbrM.metallicFactor !== undefined ? pbrM.metallicFactor : 1.0;
			mp.roughness = pbrM.roughnessFactor !== undefined ? pbrM.roughnessFactor : 1.0;
			if ( pbrM.metallicRoughnessTexture ) pend.push(p.assignTexture(mp,'metalnessMap',pbrM.metallicRoughnessTexture));
			if ( mDef.doubleSided ) mp.side = THREE.DoubleSide;
			const aM = mDef.alphaMode||ALPHA_MODES.OPAQUE;
			if ( aM === ALPHA_MODES.BLEND ) { mp.transparent=true; mp.depthWrite=false; } else { mp.transparent=false; if (aM===ALPHA_MODES.MASK) mp.alphaTest=mDef.alphaCutoff!==undefined?mDef.alphaCutoff:0.5; }
			if ( mDef.normalTexture&&mT!==THREE.MeshBasicMaterial ) { pend.push(p.assignTexture(mp,'normalMap',mDef.normalTexture)); mp.normalScale=new THREE.Vector2(1,1); if(mDef.normalTexture.scale!==undefined){const s=mDef.normalTexture.scale;mp.normalScale.set(s,s);} }
			if ( mDef.occlusionTexture&&mT!==THREE.MeshBasicMaterial ) { pend.push(p.assignTexture(mp,'aoMap',mDef.occlusionTexture)); if(mDef.occlusionTexture.strength!==undefined)mp.aoMapIntensity=mDef.occlusionTexture.strength; }
			if ( mDef.emissiveFactor&&mT!==THREE.MeshBasicMaterial ) { const ef=mDef.emissiveFactor; mp.emissive=new THREE.Color(ef[0],ef[1],ef[2]); }
			if ( mDef.emissiveTexture&&mT!==THREE.MeshBasicMaterial ) pend.push(p.assignTexture(mp,'emissiveMap',mDef.emissiveTexture));
			for ( const n of eN ) if ( e[n].extendMaterialParams ) pend.push(e[n].extendMaterialParams(i,mp));
			return Promise.all(pend).then(()=>{
				let mat; if(mT===THREE.MeshStandardMaterial) mat=new THREE.MeshStandardMaterial(mp); else mat=new mT(mp);
				return mat;
			});
		}
		loadGeometries( ps ) {
			const p = this; const e = this.extensions; const k = this.primitiveCache;
			function buildCacheKey(pp) { let k=''; for(const a in pp.attributes) k+=a+':'+pp.attributes[a]+';'; k+='mode:'+pp.mode+';'; if(pp.indices!==undefined)k+='ind:'+pp.indices+';'; return k; }
			const pend = []; const geos = [];
			for ( let i = 0; i < ps.length; i++ ) {
				const pp = ps[i]; const ck = buildCacheKey(pp);
				if ( k[ck] ) { geos.push(k[ck].promise); continue; }
				const pr = { promise: null };
				pr.promise = new Promise((res)=>{
					const ap = []; const an = Object.keys(pp.attributes);
					for(const an2 of an) ap.push(p.getDependency('accessor',pp.attributes[an2]));
					if(pp.indices!==undefined) ap.push(p.getDependency('accessor',pp.indices));
					Promise.all(ap).then(ac=>{
						const geo = new THREE.BufferGeometry();
						for(let j2=0;j2<an.length;j2++) { const atr=ac[j2]; if(atr&&ATTRIBUTES[an[j2]]) geo.setAttribute(ATTRIBUTES[an[j2]],atr); }
						if(pp.indices!==undefined) geo.setIndex(ac[an.length]);
						return geo;
					}).then(res);
				});
				k[ck] = pr; geos.push(pr.promise);
			}
			return Promise.all(geos);
		}
		loadMesh( i ) {
			const p = this; const j = this.json; const mDef = j.meshes[i];
			const ps = mDef.primitives; const pend = [];
			for (let j2=0;j2<ps.length;j2++) { if(ps[j2].material!==undefined) pend.push(this.getDependency('material',ps[j2].material)); else pend.push(this.getDependency('material',0).catch(()=>new THREE.MeshStandardMaterial())); }
			return Promise.all([this.loadGeometries(ps), Promise.all(pend)]).then(([geos,mats])=>{
				const isSkinnedM = ps.some(pp=>{const atr=pp.attributes; return atr.JOINTS_0!==undefined&&atr.WEIGHTS_0!==undefined;});
				let ms; if(ps.length===1) { const g=geos[0],m2=mats[0]; ms=isSkinnedM?new THREE.SkinnedMesh(g,m2):new THREE.Mesh(g,m2); ms.name=p.createUniqueName(mDef.name||'mesh_'+i); p.assignFinalMaterial(ms); } else { ms=new THREE.Group(); ms.name=p.createUniqueName(mDef.name||'mesh_'+i); for(let j2=0;j2<geos.length;j2++){const ch=isSkinnedM?new THREE.SkinnedMesh(geos[j2],mats[j2]):new THREE.Mesh(geos[j2],mats[j2]);ch.name=p.createUniqueName(ps[j2].name||'primitive_'+j2);p.assignFinalMaterial(ch);ms.add(ch);} }
				return ms;
			});
		}
		loadCamera( i ) { const j=this.json; const cDef=j.cameras[i]; const c=cDef.type; let cam; if(c==='perspective'){const pp=cDef.perspective;cam=new THREE.PerspectiveCamera(THREE.MathUtils.radToDeg(pp.yfov),pp.aspectRatio||1,pp.znear||1,pp.zfar||2e6);}else{const op=cDef.orthographic;cam=new THREE.OrthographicCamera(-op.xmag,op.xmag,op.ymag,-op.ymag,op.znear,op.zfar);}cam.name=this.createUniqueName(cDef.name||'camera_'+i);assignExtrasToUserData(cam,cDef);return Promise.resolve(cam); }
		loadSkin( i ) { const j=this.json; const sDef=j.skins[i]; const sk={joints:sDef.joints}; if(sDef.inverseBindMatrices===undefined)return Promise.resolve(sk); return this.getDependency('accessor',sDef.inverseBindMatrices).then(a=>{sk.inverseBindMatrices=a;return sk;}); }
		loadAnimation( i ) {
			const j = this.json; const aDef = j.animations[i];
			const pend = []; aDef.channels.forEach(ch=>pend.push(this.getDependency('accessor',aDef.samplers[ch.sampler].input),this.getDependency('accessor',aDef.samplers[ch.sampler].output)));
			return Promise.all(pend).then(ac=>{
				const clip=[];
				for(let j2=0;j2<aDef.channels.length;j2++){
					const ch=aDef.channels[j2]; const s=aDef.samplers[ch.sampler];
					const inp=ac[j2*2]; const out=ac[j2*2+1];
					if(ch.target.node===undefined)continue;
					const nd=j.nodes[ch.target.node]; const nm=''; const pp=PATH_PROPERTIES[ch.target.path];
					const ip=INTERPOLATION[s.interpolation]||THREE.InterpolateLinear;
					let kf; const ta=inp.array; const oa=out.array;
					if(pp===PATH_PROPERTIES.weights){const tc=nd.mesh!==undefined&&j.meshes[nd.mesh].primitives?j.meshes[nd.mesh].primitives.length:0;const tn=oa.length/ta.length;kf=new THREE.NumberKeyframeTrack(nm+'.morphTargetInfluences',ta,oa,ip);}
					else if(pp==='quaternion')kf=new THREE.QuaternionKeyframeTrack(nm+'.'+pp,ta,oa,ip);
					else kf=new THREE.VectorKeyframeTrack(nm+'.'+pp,ta,oa,ip);
					clip.push(kf);
				}
				return new THREE.AnimationClip(aDef.name||'clip_'+i,-1,clip);
			});
		}
		loadNode( i ) {
			const j = this.json; const e = this.extensions; const p = this;
			const nDef = j.nodes[i];
			return (nDef.mesh!==undefined ? this.getDependency('mesh',nDef.mesh) : Promise.resolve(null)).then(m=>{
				let nd; if(m){nd=m.clone();const as=p.associations.get(m);if(as)p.associations.set(nd,as);}else nd=new THREE.Object3D();
				nd.name=p.createUniqueName(nDef.name||'');
				assignExtrasToUserData(nd,nDef);
				if(nDef.extensions)addUnknownExtensionsToUserData(e,nd,nDef);
				if(nDef.matrix){const mx=new THREE.Matrix4;mx.fromArray(nDef.matrix);nd.applyMatrix4(mx);}else{if(nDef.translation)nd.position.fromArray(nDef.translation);if(nDef.rotation)nd.quaternion.fromArray(nDef.rotation);if(nDef.scale)nd.scale.fromArray(nDef.scale);}
				const pr=p._invokeAll(pl=>pl.createNodeAttachment&&pl.createNodeAttachment(i));
				return Promise.all(pr).then(at=>{at.forEach(a=>{if(a)nd.add(a);}); return nd;});
			});
		}
		loadScene( i ) {
			const j = this.json; const e = this.extensions; const p = this;
			const sDef = j.scenes[i];
			const scene = new THREE.Group();
			scene.name = p.createUniqueName(sDef.name||'');
			addUnknownExtensionsToUserData(e,scene,sDef);
			assignExtrasToUserData(scene,sDef);
			const nods = sDef.nodes||[];
			const pend = [];
			for(let i2=0,l=nods.length;i2<l;i2++) pend.push(p.getDependency('node',nods[i2]));
			return Promise.all(pend).then(nd=>{nd.forEach(n=>scene.add(n));return scene;});
		}
		resolveURI( u ) { if(typeof u!=='string'||u==='')return ''; if(/^(https?:)?\/\//i.test(u))return u; if(/^data:.*,.*$/i.test(u))return u; if(/^blob:.*$/i.test(u))return u; return this.options.path+u; }
		createUniqueName( n ) { const sN=THREE.PropertyBinding.sanitizeNodeName(n); let uN=sN; for(let i=1;this.nodeNamesUsed[uN];++i)uN=sN+'_'+i; this.nodeNamesUsed[uN]=true; return uN; }
	}

	class GLTFRegistry { constructor(){this.objects={};} get(k){return this.objects[k];} add(k,o){this.objects[k]=o;return this;} remove(k){delete this.objects[k];} removeAll(){this.objects={};} }

	function addUnknownExtensionsToUserData(e,o,d) { for(const n in d.extensions) if(!e[n]) o.userData.gltfExtensions=o.userData.gltfExtensions||{},o.userData.gltfExtensions[n]=d.extensions[n]; }
	function assignExtrasToUserData(o,d) { if(d.extras!==undefined) { if(typeof d.extras==='object') Object.assign(o.userData,d.extras); else console.warn('THREE.GLTFLoader: Ignoring primitive type .extras, '+JSON.stringify(d.extras)); } }

	THREE.GLTFLoader = GLTFLoader;

} )();
