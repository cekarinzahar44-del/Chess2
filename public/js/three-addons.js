// three-addons.js — OrbitControls, безопасная регистрация после загрузки THREE

window.__initOrbitControls = function() {
  THREE.OrbitControls = function(object, domElement) {
    this.object = object;
    this.domElement = domElement;
    this.enabled = true;
    this.target = new THREE.Vector3();
    this.minDistance = 0; this.maxDistance = Infinity;
    this.minPolarAngle = 0; this.maxPolarAngle = Math.PI;
    this.minAzimuthAngle = -Infinity; this.maxAzimuthAngle = Infinity;
    this.enableDamping = false; this.dampingFactor = 0.05;
    this.enableZoom = true; this.zoomSpeed = 1.0;
    this.enableRotate = true; this.rotateSpeed = 1.0;
    this.enablePan = false;
    this.autoRotate = false; this.autoRotateSpeed = 2.0;

    const scope = this;
    const STATE = { NONE:-1, ROTATE:0, DOLLY:1, PAN:2, TOUCH_ROTATE:3, TOUCH_DOLLY_PAN:5 };
    let state = STATE.NONE;
    const EPS = 0.000001;
    const spherical = new THREE.Spherical();
    const sphericalDelta = new THREE.Spherical();
    let scale = 1;
    const panOffset = new THREE.Vector3();
    let zoomChanged = false;
    const rotateStart = new THREE.Vector2(), rotateEnd = new THREE.Vector2(), rotateDelta = new THREE.Vector2();
    const dollyStart = new THREE.Vector2(), dollyEnd = new THREE.Vector2(), dollyDelta = new THREE.Vector2();

    this.getPolarAngle    = function() { return spherical.phi; };
    this.getAzimuthalAngle = function() { return spherical.theta; };

    this.update = (function() {
      const offset = new THREE.Vector3();
      const quat = new THREE.Quaternion().setFromUnitVectors(object.up, new THREE.Vector3(0,1,0));
      const quatInverse = quat.clone().invert();
      const lastPosition = new THREE.Vector3();
      const lastQuaternion = new THREE.Quaternion();
      return function update() {
        const position = scope.object.position;
        offset.copy(position).sub(scope.target);
        offset.applyQuaternion(quat);
        spherical.setFromVector3(offset);
        if (scope.autoRotate && state === STATE.NONE) {
          sphericalDelta.theta -= 2 * Math.PI / 60 / 60 * scope.autoRotateSpeed;
        }
        if (scope.enableDamping) {
          spherical.theta += sphericalDelta.theta * scope.dampingFactor;
          spherical.phi   += sphericalDelta.phi   * scope.dampingFactor;
        } else {
          spherical.theta += sphericalDelta.theta;
          spherical.phi   += sphericalDelta.phi;
        }
        spherical.theta = Math.max(scope.minAzimuthAngle, Math.min(scope.maxAzimuthAngle, spherical.theta));
        spherical.phi   = Math.max(scope.minPolarAngle,   Math.min(scope.maxPolarAngle,   spherical.phi));
        spherical.makeSafe();
        spherical.radius *= scale;
        spherical.radius = Math.max(scope.minDistance, Math.min(scope.maxDistance, spherical.radius));
        scope.target.addScaledVector(panOffset, scope.enableDamping ? scope.dampingFactor : 1);
        offset.setFromSpherical(spherical);
        offset.applyQuaternion(quatInverse);
        position.copy(scope.target).add(offset);
        scope.object.lookAt(scope.target);
        if (scope.enableDamping) {
          sphericalDelta.theta *= (1 - scope.dampingFactor);
          sphericalDelta.phi   *= (1 - scope.dampingFactor);
          panOffset.multiplyScalar(1 - scope.dampingFactor);
        } else {
          sphericalDelta.set(0,0,0);
          panOffset.set(0,0,0);
        }
        scale = 1;
        if (zoomChanged || lastPosition.distanceToSquared(scope.object.position) > EPS || 8*(1-lastQuaternion.dot(scope.object.quaternion)) > EPS) {
          scope.dispatchEvent({ type:'change' });
          lastPosition.copy(scope.object.position);
          lastQuaternion.copy(scope.object.quaternion);
          zoomChanged = false;
          return true;
        }
        return false;
      };
    }());

    this.dispose = function() {
      scope.domElement.removeEventListener('contextmenu', onContextMenu);
      scope.domElement.removeEventListener('pointerdown', onPointerDown);
      scope.domElement.removeEventListener('wheel', onMouseWheel);
      scope.domElement.removeEventListener('touchstart', onTouchStart);
      scope.domElement.removeEventListener('touchend', onTouchEnd);
      scope.domElement.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    function getZoomScale() { return Math.pow(0.95, scope.zoomSpeed); }
    function rotateLeft(a)  { sphericalDelta.theta -= a; }
    function rotateUp(a)    { sphericalDelta.phi   -= a; }
    function dollyIn(s)     { scale /= s; zoomChanged = true; }
    function dollyOut(s)    { scale *= s; zoomChanged = true; }

    function handleMouseDownRotate(e) { rotateStart.set(e.clientX, e.clientY); }
    function handleMouseMoveRotate(e) {
      rotateEnd.set(e.clientX, e.clientY);
      rotateDelta.subVectors(rotateEnd, rotateStart).multiplyScalar(scope.rotateSpeed);
      const el = scope.domElement;
      rotateLeft(2 * Math.PI * rotateDelta.x / el.clientHeight);
      rotateUp  (2 * Math.PI * rotateDelta.y / el.clientHeight);
      rotateStart.copy(rotateEnd);
      scope.update();
    }
    function handleMouseWheel(e) {
      if (e.deltaY < 0) dollyOut(getZoomScale());
      else if (e.deltaY > 0) dollyIn(getZoomScale());
      scope.update();
    }

    let touchStartX = 0, touchStartY = 0;
    function onPointerDown(e) {
      if (!scope.enabled) return;
      if (e.button === 0) { state = STATE.ROTATE; handleMouseDownRotate(e); }
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup',   onMouseUp);
    }
    function onMouseMove(e) { if (!scope.enabled) return; if (state === STATE.ROTATE) handleMouseMoveRotate(e); }
    function onMouseUp()    { document.removeEventListener('mousemove', onMouseMove); document.removeEventListener('mouseup', onMouseUp); state = STATE.NONE; }
    function onMouseWheel(e) { if (!scope.enabled || !scope.enableZoom) return; e.preventDefault(); handleMouseWheel(e); }

    function onTouchStart(e) {
      if (!scope.enabled) return;
      e.preventDefault();
      if (e.touches.length === 1) {
        state = STATE.TOUCH_ROTATE;
        rotateStart.set(e.touches[0].pageX, e.touches[0].pageY);
      } else if (e.touches.length === 2) {
        state = STATE.TOUCH_DOLLY_PAN;
        const dx = e.touches[0].pageX - e.touches[1].pageX;
        const dy = e.touches[0].pageY - e.touches[1].pageY;
        dollyStart.set(0, Math.sqrt(dx*dx+dy*dy));
      }
    }
    function onTouchMove(e) {
      if (!scope.enabled) return;
      e.preventDefault();
      if (e.touches.length === 1 && state === STATE.TOUCH_ROTATE) {
        rotateEnd.set(e.touches[0].pageX, e.touches[0].pageY);
        rotateDelta.subVectors(rotateEnd, rotateStart).multiplyScalar(scope.rotateSpeed);
        rotateLeft(2 * Math.PI * rotateDelta.x / scope.domElement.clientHeight);
        rotateUp  (2 * Math.PI * rotateDelta.y / scope.domElement.clientHeight);
        rotateStart.copy(rotateEnd);
        scope.update();
      } else if (e.touches.length === 2 && state === STATE.TOUCH_DOLLY_PAN) {
        const dx = e.touches[0].pageX - e.touches[1].pageX;
        const dy = e.touches[0].pageY - e.touches[1].pageY;
        dollyEnd.set(0, Math.sqrt(dx*dx+dy*dy));
        dollyDelta.set(0, Math.pow(dollyEnd.y / dollyStart.y, scope.zoomSpeed));
        dollyIn(dollyDelta.y);
        dollyStart.copy(dollyEnd);
        scope.update();
      }
    }
    function onTouchEnd()    { state = STATE.NONE; }
    function onContextMenu(e){ if (!scope.enabled) return; e.preventDefault(); }

    scope.domElement.addEventListener('contextmenu', onContextMenu);
    scope.domElement.addEventListener('pointerdown',  onPointerDown);
    scope.domElement.addEventListener('wheel',        onMouseWheel, { passive: false });
    scope.domElement.addEventListener('touchstart',   onTouchStart, { passive: false });
    scope.domElement.addEventListener('touchend',     onTouchEnd);
    scope.domElement.addEventListener('touchmove',    onTouchMove,  { passive: false });

    this.update();
  };

  THREE.OrbitControls.prototype = Object.create(THREE.EventDispatcher.prototype);
  THREE.OrbitControls.prototype.constructor = THREE.OrbitControls;
};
