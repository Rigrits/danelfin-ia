/* Escenas 3D del modo presentación (Three.js, cargado a demanda).
   Escenas3D.crear(contenedor, 'portada' | 'resultados', acciones) -> Promise<{ destroy() }>.
   Si WebGL no está disponible o falla la carga, la promesa se rechaza y el modo usa la versión 2D. */
(function () {
  'use strict';
  var THREEp = null;
  function cargar() {
    if (!THREEp) {
      THREEp = import(new URL('vendor/three.module.min.js', document.baseURI).href)
        .catch(function (e) { THREEp = null; throw e; });
    }
    return THREEp;
  }
  function webgl() {
    try { var c = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl'))); }
    catch (e) { return false; }
  }
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches && !/[?&]movimiento=1/.test(location.search);
  var COL = { gain: 0x4ADE80, loss: 0xF87171, real: 0x3F7BEA, hold: 0xD9932A, ink: '#E6EAF2', ink3: '#8D9AB0' };
  var ease = function (x) { return 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3); };

  // Etiqueta de texto como sprite (se ve siempre de frente a la cámara).
  function etiqueta(T, texto, color, tam) {
    var c = document.createElement('canvas'), g = c.getContext('2d'), px = 64;
    g.font = '700 ' + px + 'px "Atkinson Hyperlegible", system-ui, sans-serif';
    var w = Math.ceil(g.measureText(texto).width) + 24;
    c.width = w; c.height = px + 24;
    g.font = '700 ' + px + 'px "Atkinson Hyperlegible", system-ui, sans-serif';
    g.fillStyle = color; g.textBaseline = 'middle'; g.fillText(texto, 12, c.height / 2);
    var tex = new T.CanvasTexture(c); tex.colorSpace = T.SRGBColorSpace; tex.anisotropy = 4;
    var s = new T.Sprite(new T.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    var k = (tam || .5) / c.height;
    s.scale.set(c.width * k, c.height * k, 1);
    return s;
  }
  function pct(v) { var s = (v * 100).toFixed(1).replace('.', ','); return (v > 0 ? '+' : '') + s.replace('-', '−') + '%'; }

  function montar(T, cont) {
    var w = cont.clientWidth || 800, h = cont.clientHeight || 450;
    var renderer = new T.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h);
    renderer.outputColorSpace = T.SRGBColorSpace;
    cont.appendChild(renderer.domElement);
    var scene = new T.Scene();
    scene.fog = new T.Fog(0x0B1220, 14, 34);
    var camera = new T.PerspectiveCamera(42, w / h, .1, 100);
    scene.add(new T.AmbientLight(0xffffff, .55));
    var dir = new T.DirectionalLight(0xffffff, 1.6); dir.position.set(6, 10, 8); scene.add(dir);
    var rim = new T.DirectionalLight(0x7FA9FF, .8); rim.position.set(-8, 4, -6); scene.add(rim);
    var ro = new ResizeObserver(function () {
      var W = cont.clientWidth, H = cont.clientHeight; if (!W || !H) return;
      renderer.setSize(W, H); camera.aspect = W / H; camera.updateProjectionMatrix();
    });
    ro.observe(cont);
    return { renderer: renderer, scene: scene, camera: camera, ro: ro };
  }
  function liberar(m, raf) {
    cancelAnimationFrame(raf.id);
    m.ro.disconnect();
    m.scene.traverse(function (o) {
      if (o.geometry) o.geometry.dispose();
      if (o.material) { (Array.isArray(o.material) ? o.material : [o.material]).forEach(function (mt) { if (mt.map) mt.map.dispose(); mt.dispose(); }); }
    });
    m.renderer.dispose();
    if (m.renderer.domElement.parentNode) m.renderer.domElement.parentNode.removeChild(m.renderer.domElement);
  }
  function piso(T, scene, ancho, prof) {
    var grid = new T.GridHelper(Math.max(ancho, prof) + 8, Math.round(Math.max(ancho, prof) + 8), 0x33415C, 0x1A2540);
    grid.material.transparent = true; grid.material.opacity = .55;
    scene.add(grid);
    var plano = new T.Mesh(new T.PlaneGeometry(ancho + 2, prof + 2),
      new T.MeshStandardMaterial({ color: 0x131C31, transparent: true, opacity: .55, roughness: .9 }));
    plano.rotation.x = -Math.PI / 2; plano.position.y = -.001; scene.add(plano);
  }

  /* ---------------------------------------------------------------- portada: 12 columnas */
  function portada(T, cont, acciones) {
    var m = montar(T, cont), raf = { id: 0 };
    var lista = acciones.filter(function (a) { return a.real != null; });
    var max = Math.max.apply(null, lista.map(function (a) { return Math.abs(a.real); }).concat([.05]));
    var esc = 3.2 / max, paso = 1.15, x0 = -(lista.length - 1) * paso / 2;
    piso(T, m.scene, lista.length * paso, 3);
    var cols = lista.map(function (a, i) {
      var hgt = Math.max(.04, Math.abs(a.real) * esc), arriba = a.real >= 0;
      var mat = new T.MeshStandardMaterial({ color: arriba ? COL.gain : COL.loss, roughness: .35, metalness: .15,
        emissive: arriba ? COL.gain : COL.loss, emissiveIntensity: .18 });
      var geo = new T.BoxGeometry(.72, hgt, .72);
      geo.translate(0, arriba ? hgt / 2 : -hgt / 2, 0);              // crece desde el piso, hacia arriba o abajo
      var mesh = new T.Mesh(geo, mat);
      mesh.position.set(x0 + i * paso, 0, 0);
      mesh.scale.y = reduce ? 1 : .001;
      m.scene.add(mesh);
      var tk = etiqueta(T, a.etiqueta || a.ticker, COL.ink, .42);
      tk.position.set(mesh.position.x, arriba ? -.35 : .35, .75); m.scene.add(tk);
      var vl = etiqueta(T, pct(a.real), arriba ? '#4ADE80' : '#F87171', .38);
      vl.position.set(mesh.position.x, arriba ? hgt + .35 : -hgt - .35, 0); vl.material.opacity = reduce ? 1 : 0;
      m.scene.add(vl);
      return { mesh: mesh, vl: vl, delay: i * .09 };
    });
    var t0 = performance.now(), R = 17;
    function frame(now) {
      var t = (now - t0) / 1000;
      cols.forEach(function (c) {
        var k = reduce ? 1 : ease((t - .2 - c.delay) / 1.1);
        c.mesh.scale.y = Math.max(.001, k);
        c.vl.material.opacity = reduce ? 1 : ease((t - 1 - c.delay) / .6);
      });
      var ang = reduce ? .35 : .35 + Math.sin(t * .18) * .42;        // órbita lenta de ida y vuelta
      m.camera.position.set(Math.sin(ang) * R, 3.6 + Math.sin(t * .25) * .3, Math.cos(ang) * R);
      m.camera.lookAt(0, -.4, 0);
      m.renderer.render(m.scene, m.camera);
      if (!reduce) raf.id = requestAnimationFrame(frame);
    }
    raf.id = requestAnimationFrame(frame);
    return { destroy: function () { liberar(m, raf); } };
  }

  /* ---------------------------------------------------------------- resultados: real vs hold */
  function resultados(T, cont, acciones) {
    var m = montar(T, cont), raf = { id: 0 };
    var lista = acciones.filter(function (a) { return a.real != null; });
    var max = Math.max.apply(null, lista.map(function (a) { return Math.max(Math.abs(a.real), Math.abs(a.hold)); }).concat([.05]));
    var esc = 3 / max, paso = 1.3, x0 = -(lista.length - 1) * paso / 2;
    piso(T, m.scene, lista.length * paso, 4);
    var barras = [];
    lista.forEach(function (a, i) {
      [['real', -.45, COL.real], ['hold', .45, COL.hold]].forEach(function (f, j) {
        var v = a[f[0]], hgt = Math.max(.04, Math.abs(v) * esc), arriba = v >= 0;
        var geo = new T.BoxGeometry(.5, hgt, .5); geo.translate(0, arriba ? hgt / 2 : -hgt / 2, 0);
        var mesh = new T.Mesh(geo, new T.MeshStandardMaterial({ color: f[2], roughness: .35, metalness: .2, emissive: f[2], emissiveIntensity: .15 }));
        mesh.position.set(x0 + i * paso, 0, f[1]); mesh.scale.y = reduce ? 1 : .001;
        m.scene.add(mesh);
        barras.push({ mesh: mesh, delay: i * .07 + j * .12 });
      });
      var tk = etiqueta(T, a.etiqueta || a.ticker, COL.ink, .4);
      tk.position.set(x0 + i * paso, .35, 1.25); m.scene.add(tk);
    });
    var lr = etiqueta(T, 'Real (con stop)', '#7FA9FF', .42); lr.position.set(x0 - 1.9, .3, -.45); m.scene.add(lr);
    var lh = etiqueta(T, 'Hold (sin stop)', '#E3A63C', .42); lh.position.set(x0 - 1.9, .3, .45); m.scene.add(lh);
    var t0 = performance.now(), dur = 6.5, xa = x0 + 1.5, xb = -x0 - 1.5;
    // distancia final para que toda la fila llene el ancho del cuadro (el lienzo es muy apaisado)
    function dFin() { return Math.max(6, (-x0 + 2.8) / (Math.tan(21 * Math.PI / 180) * m.camera.aspect)); }
    function frame(now) {
      var t = (now - t0) / 1000;
      barras.forEach(function (b) { b.mesh.scale.y = reduce ? 1 : Math.max(.001, ease((t - .2 - b.delay) / 1)); });
      var p, pos = new T.Vector3(), mira = new T.Vector3();
      if (reduce || t > dur + 1.6) {                                   // vista final: toda la brecha, con vaivén suave
        var tt = reduce ? 0 : t - dur - 1.6, ang = .32 + Math.sin(tt * .2) * .18;
        var d = dFin(); pos.set(Math.sin(ang) * d, d * .42, Math.cos(ang) * d); mira.set(0, -1.3, 0);
      } else if (t > dur) {                                            // se aleja hasta la vista final
        p = ease((t - dur) / 1.6);
        var d2 = dFin(), fin = new T.Vector3(Math.sin(.32) * d2, d2 * .42, Math.cos(.32) * d2);
        pos.lerpVectors(new T.Vector3(xb, 1.2, 3.6), fin, p); mira.lerpVectors(new T.Vector3(xb + .6, -.3, 0), new T.Vector3(0, -1.3, 0), p);
      } else {                                                         // recorrido de frente, de izquierda a derecha
        p = t / dur; p = p * p * (3 - 2 * p);
        var x = xa + (xb - xa) * p;
        pos.set(x, 1.2, 3.6); mira.set(x + .6, -.3, 0);
      }
      m.camera.position.copy(pos); m.camera.lookAt(mira);
      m.renderer.render(m.scene, m.camera);
      if (!reduce) raf.id = requestAnimationFrame(frame);
    }
    raf.id = requestAnimationFrame(frame);
    return { destroy: function () { liberar(m, raf); } };
  }

  window.Escenas3D = {
    disponible: webgl,
    crear: function (cont, tipo, acciones) {
      if (!webgl()) return Promise.reject(new Error('WebGL no disponible'));
      return cargar().then(function (T) {
        if (!cont.isConnected) return { destroy: function () {} };
        return tipo === 'portada' ? portada(T, cont, acciones) : resultados(T, cont, acciones);
      });
    }
  };
})();
