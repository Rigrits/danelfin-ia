/* Modo presentación: diapositivas a pantalla completa sobre los mismos datos de la web.
   Textos fijos: web/contenido/presentacion.md (contenido.presentacion en datos.js). Cifras y gráficos: en vivo.
   Movimiento: viaje de cámara entre diapositivas (CSS 3D), escenas WebGL en portada y dólares (escenas3d.js),
   contadores, gráficos que se dibujan al entrar y revelado por partes en las diapositivas densas. */
(function () {
  'use strict';
  var A = window.App;
  if (!A) return;
  var D = A.D, Fmt = window.Fmt, Charts = window.Charts, esc = A.esc, R = D.resumen;
  var P = (D.contenido && D.contenido.presentacion) || {};
  var frases = P.frases || {};
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches && !/[?&]movimiento=1/.test(location.search);   // ?movimiento=1 fuerza las animaciones
  if (/[?&]movimiento=1/.test(location.search)) document.documentElement.classList.add('forzar-mov');
  // Versión 3D (por defecto) o común: botón 3D/2D, tecla M o ?modo=clasica. Se recuerda en este navegador.
  var clasica = /[?&]modo=clasica/.test(location.search);
  if (!clasica && !/[?&]modo=3d/.test(location.search)) { try { clasica = localStorage.getItem('pr-modo') === 'clasica'; } catch (e) {} }
  function mov() { return !reduce && !clasica; }
  var DEFECTO = [
    { tipo: 'portada', titulo: '¿Acertó Danelfin?' }, { tipo: 'danelfin', titulo: 'Qué promete Danelfin' },
    { tipo: 'metodo', titulo: 'Cómo lo medimos' }, { tipo: 'numeros', titulo: 'Los números' },
    { tipo: 'dolares', titulo: 'En dólares' }, { tipo: 'semanal', titulo: 'Semana a semana' },
    { tipo: 'stop', titulo: 'Qué hizo el stop' }, { tipo: 'tecnico', titulo: 'La foto técnica' },
    { tipo: 'cierre', titulo: 'Conclusiones' }
  ];
  var slides = (P.diapositivas && P.diapositivas.length) ? P.diapositivas : DEFECTO;
  (function () {                       // bloque y tiempo se heredan hasta que una diapositiva define otros
    var b = '', t = '';
    slides.forEach(function (s) { if (s.bloque) { b = s.bloque; t = s.tiempo || ''; } s._bloque = b; s._tiempo = t; });
  })();

  var root = document.getElementById('presentacion');
  if (!root) return;
  var $ = function (sel, r) { return (r || root).querySelector(sel); };
  var $$ = function (sel, r) { return Array.prototype.slice.call((r || root).querySelectorAll(sel)); };
  var stage = $('.pr-stage'), notes = $('.pr-notes'), bar = $('.pr-progress span'), live = $('.pr-live');
  var idx = 0, t0 = null, timer = null, activo = false;
  var actual = null;                   // { el, res, pasos, paso }
  var saliendo = [];                   // diapositivas en transición de salida

  /* ---------------------------------------------------------------- piezas */
  function head(s) {
    return '<header class="pr-head"><h2>' + esc(s.titulo || s.nombre || '') + '</h2>' +
      (s.idea ? '<p class="pr-idea">' + esc(s.idea) + '</p>' : '') + '</header>';
  }
  function tile(label, valor, sub) {
    return '<div class="pr-tile"><span class="k">' + label + '</span><span class="v">' + valor + '</span>' +
      (sub ? '<span class="s">' + sub + '</span>' : '') + '</div>';
  }
  // Contadores: el número final queda escrito (sirve sin JS/animación) y se anima de 0 a su valor.
  function fmtC(v, f) {
    return f === 'pct' ? Fmt.pct(v, 1) : f === 'pctn' ? Fmt.pct(v, 1).replace('+', '') :
      f === 'usd' ? Fmt.usd(v, 0) : String(Math.round(v));
  }
  function cnt(v, f) { return '<span class="cnt" data-v="' + v + '" data-f="' + f + '">' + fmtC(v, f) + '</span>'; }
  function conCnt(html, v, f) { return v == null ? html : html.replace(/(<\/svg>)[^<]*(<\/span>)$/, '$1' + cnt(v, f) + '$2'); }
  function de(n, total) { return cnt(n, 'int') + '<span class="of"> de ' + total + '</span>'; }
  function frase(a) {
    if (frases[a.ticker]) return frases[a.ticker];
    var f = D.contenido && D.contenido.empresas && D.contenido.empresas.fichas[a.ticker];
    return f && f.bajada ? f.bajada.split('. ')[0] + '.' : '';
  }
  function tarjetas(lista, textos) {
    if (!lista.length) return '<p class="pr-vacio">No hay recomendaciones en este grupo.</p>';
    return '<div class="pr-cards n' + Math.min(lista.length, 4) + '">' + lista.map(function (a, i) {
      return '<button type="button" class="pr-card pr-rev" data-paso="' + i + '" data-id="' + esc(a.id) + '" aria-label="' + esc(a.etiqueta) + ': ver el detalle diario">' +
        '<span class="top"><span class="tk">' + esc(a.etiqueta) + '</span><span class="co">' + esc(a.empresa) + '</span></span>' +
        A.badge(a) +
        '<span class="nums"><span class="big">' + A.gl(a.real) + '</span><span class="hold">hold ' + A.gl(a.hold) + '</span></span>' +
        '<span class="mini"><canvas aria-hidden="true"></canvas></span>' +
        '<span class="frase">' + esc(textos ? textos[i] : frase(a)) + '</span></button>';
    }).join('') + '</div>';
  }
  function dibujarMinis(el, res) {
    $$('.pr-card', el).forEach(function (c) {
      var a = A.byId(c.getAttribute('data-id'));
      var ch = a && Charts.mini($('canvas', c), a); if (ch) res.charts.push(ch);
    });
  }
  function canvas(cls, label) { return '<div class="pr-chart ' + (cls || '') + '"><canvas role="img" aria-label="' + esc(label) + '"></canvas></div>'; }
  var con = function (a) { return a.real != null; };
  // Escena 3D con respaldo 2D: si WebGL no está o falla, se ejecuta `respaldo`.
  function escena(cont, tipo, res, respaldo) {
    if (clasica || !window.Escenas3D || !Escenas3D.disponible()) { if (respaldo) respaldo(); return; }
    Escenas3D.crear(cont, tipo, D.acciones).then(function (h) {
      if (res.liberado) h.destroy(); else res.escenas.push(h);
    }).catch(function () { cont.classList.add('sin-3d'); if (respaldo && !res.liberado) respaldo(); });
  }

  /* ---------------------------------------------------------------- diapositivas */
  var B = {
    portada: function (s) {
      var fechas = D.acciones.map(function (a) { return a.fechaRec; }).sort();
      return { html: '<div class="pr-3d pr-3d-portada" aria-hidden="true"></div>' +
        '<div class="pr-cover"><p class="eyebrow">Seguimiento independiente · Inteligencia artificial aplicada a inversiones</p>' +
        '<h1>' + esc(s.titulo || '¿Acertó Danelfin?') + '</h1>' + (s.idea ? '<p class="pr-idea">' + esc(s.idea) + '</p>' : '') +
        '<p class="pr-meta">' + D.acciones.length + ' recomendaciones · del ' + Fmt.date(fechas[0]) + ' al ' + Fmt.date(D.meta.corte) +
        ' · último control de precios</p>' +
        (D.meta.equipo && D.meta.equipo.length ? '<p class="pr-meta small">Elaborado por: ' + esc(D.meta.equipo.join(', ')) + '</p>' : '') + '</div>',
        after: function (el, res) { escena($('.pr-3d', el), 'portada', res); } };
    },
    danelfin: function (s) {
      return { html: head(s) + '<div class="pr-tiles">' +
        tile('Puntaje', '1 a 10', 'AI Score: probabilidad de superar al mercado en 3 meses') +
        tile('Acierto histórico que citan', cnt(R.winrateDanelfin, 'pctn'), 'promedio de los boletines, a 3 meses') +
        tile('Retorno histórico que citan', cnt(R.avgretDanelfin, 'pct'), 'promedio de los boletines, a 3 meses') +
        tile('Probabilidad prometida', cnt(R.probProm, 'pctn'), 'de superar al mercado, promedio') + '</div>' };
    },
    metodo: function (s) {
      var paso = function (n, t, d) { return '<div class="pr-step pr-rev" data-paso="' + (n - 1) + '"><span class="n">' + n + '</span><h3>' + t + '</h3><p>' + d + '</p></div>'; };
      return { html: head(s) + '<div class="pr-steps">' +
        paso(1, 'Entrada', 'Al precio que publica cada boletín de Danelfin.') +
        paso(2, 'Salida', 'Al primer toque del stop loss o del take profit durante el día; si abre más allá del nivel, a la apertura.') +
        paso(3, 'Medición', '<strong>Real</strong>, con las reglas; <strong>hold</strong>, sin vender nunca; y el <strong>S&amp;P 500</strong> en las mismas fechas.') +
        '</div>' };
    },
    numeros: function (s) {
      return { html: head(s) + '<div class="pr-tiles">' +
        tile('Rendimiento real promedio', conCnt(A.gl(R.realProm), R.realProm, 'pct'), 'con stop loss y take profit') +
        tile('Rendimiento hold promedio', conCnt(A.gl(R.holdProm), R.holdProm, 'pct'), 'sin vender') +
        tile('Tocaron el stop loss', de(R.stops, R.n), R.takes + ' el take profit · ' + R.abiertas + ' abiertas') +
        tile('Superaron al S&amp;P 500', de(R.superaronSPY, R.n), 'alpha promedio ' + Fmt.pct(R.alphaProm, 1)) + '</div>' };
    },
    dolares: function (s) {
      return { html: head(s) + '<p class="pr-sub">Con ' + Fmt.usd(R.capital, 0, false) + ' en cada recomendación (' + Fmt.usd(R.invertido, 0, false) + ' en total):</p>' +
        '<div class="pr-tiles n3">' + tile('Resultado real', conCnt(A.glUsd(R.pnlReal), R.pnlReal, 'usd')) +
        tile('Hold (sin stops)', conCnt(A.glUsd(R.pnlHold), R.pnlHold, 'usd')) +
        tile('Mismo capital en el S&amp;P 500', conCnt(A.glUsd(R.pnlSpy), R.pnlSpy, 'usd')) + '</div>' +
        '<div class="pr-3d pr-3d-resultados" role="img" aria-label="Barras 3D del rendimiento real y hold de cada acción"></div>',
        after: function (el, res) {
          var cont = $('.pr-3d', el);
          escena(cont, 'resultados', res, function () {            // respaldo 2D: el gráfico de barras de siempre
            cont.innerHTML = '<div class="legend"><span><i class="sq" style="background:var(--real)"></i>Real</span><span><i class="sq" style="background:var(--hold)"></i>Hold</span></div>' +
              canvas('md', 'Rendimiento real y hold por acción');
            res.charts.push(Charts.barras($('canvas', cont), D.acciones.filter(con)));
          });
        } };
    },
    semanal: function (s) {
      return { html: head(s) + '<div class="legend"><span><i style="border-color:var(--real)"></i>Real</span><span><i class="dash" style="border-color:var(--hold)"></i>Hold</span>' +
        '<span><i class="dot" style="border-color:var(--spy)"></i>S&amp;P 500 (SPY)</span></div>' + canvas('lg', 'Evolución semanal del promedio contra el S&P 500'),
        after: function (el, res) { res.charts.push(Charts.semanal($('.pr-chart canvas', el), D)); } };
    },
    contexto: function (s) {
      return { html: head(s) + '<ul class="pr-points">' + (s.punto || []).map(function (p, i) {
        var k = p.indexOf(':');
        return '<li class="pr-rev" data-paso="' + i + '">' + (k > 0 ? '<strong>' + esc(p.slice(0, k)) + '</strong>' + esc(p.slice(k)) : esc(p)) + '</li>';
      }).join('') + '</ul>' };
    },
    empresas: function (s) {
      var lista = D.acciones.filter(function (a) { return !s.mes || a.fechaRec.slice(0, 7) === s.mes; });
      return { html: head(s) + tarjetas(lista), after: dibujarMinis };
    },
    casos: function (s) {
      var lista = [], textos = [];
      (s.caso || []).forEach(function (c) {
        var p = c.split('|'), tk = p[0].trim();
        var a = D.acciones.filter(function (x) { return x.ticker === tk; })[0];
        if (a) { lista.push(a); textos.push((p[1] || '').trim() || frase(a)); }
      });
      return { html: head(s) + tarjetas(lista, textos), after: dibujarMinis };
    },
    stop: function (s) {
      var lista = D.acciones.filter(function (a) { return a.estado === 'stop' || a.estado === 'take'; });
      return { html: head(s) + '<p class="pr-sub">El stop ayudó en <strong>' + R.stopsAyudaron + '</strong> ' + (R.stopsAyudaron === 1 ? 'caso' : 'casos') +
        ' y perjudicó en <strong>' + R.stopsPerjudicaron + '</strong>. Sin reglas, el promedio habría sido ' + Fmt.pct(R.holdProm, 1) +
        ' en lugar de ' + Fmt.pct(R.realProm, 1) + '.</p>' + canvas('lg', 'Diferencia entre el rendimiento real y el hold por acción'),
        after: function (el, res) { res.charts.push(Charts.stopDiff($('.pr-chart canvas', el), lista)); } };
    },
    tecnico: function (s) {
      var lista = D.acciones.filter(function (a) { return a.pre && a.pre.length; });
      return { html: head(s) + '<div class="legend"><span><i style="border-color:var(--ink)"></i>Cierre</span><span><i style="border-color:var(--real)"></i>EMA 20</span>' +
        '<span><i class="dash" style="border-color:var(--hold)"></i>EMA 50</span><span><i class="dot" style="border-color:var(--spy)"></i>EMA 200</span></div>' +
        '<div class="pr-tec">' + lista.map(function (a, i) {
          var e = A.entradaSnap(a);
          return '<button type="button" class="pr-tcard pr-rev" data-paso="' + Math.floor(i / 6) + '" data-id="' + esc(a.id) + '" aria-label="' + esc(a.etiqueta) + ': ver el detalle diario">' +
            '<span class="tk">' + esc(a.etiqueta) + '</span><span class="mini"><canvas aria-hidden="true"></canvas></span>' +
            '<span class="vals">RSI ' + Fmt.n1(e.rsi) + ' · MFI ' + Fmt.n1(e.mfi) + ' · ADX ' + Fmt.n1(e.adx) +
            '<br>+DI ' + Fmt.n1(e.pdi) + ' / −DI ' + Fmt.n1(e.mdi) + ' · vs EMA 200 ' + Fmt.pct(e.cierre / e.ema200 - 1, 1) + '</span></button>';
        }).join('') + '</div>',
        after: function (el, res) {
          $$('.pr-tcard', el).forEach(function (c) {
            var ch = Charts.tecPrecio($('canvas', c), A.byId(c.getAttribute('data-id')), { compacto: true }); if (ch) res.charts.push(ch);
          });
        } };
    },
    cierre: function (s) {
      var url = location.href.split('#')[0];
      var concl = D.contenido && D.contenido.conclusiones;
      return { html: head(s) + '<ul class="pr-points">' + (s.punto || []).map(function (p, i) { return '<li class="pr-rev" data-paso="' + i + '">' + esc(p) + '</li>'; }).join('') + '</ul>' +
        (concl && window.marked ? '<div class="pr-concl prose">' + marked.parse(concl) + '</div>' : '') +
        '<p class="pr-meta">Informe completo y Excel descargable: <a href="' + esc(url) + '">' + esc(url.replace(/^https?:\/\//, '')) + '</a></p>' +
        '<p class="pr-legal">Seguimiento independiente, sin afiliación con Danelfin. No constituye asesoramiento ni recomendación de inversión; rendimientos pasados no garantizan resultados futuros.</p>' };
    }
  };
  var CLAVE = { portada: 1, numeros: 1, dolares: 1, cierre: 1 };    // momentos con entrada más vistosa

  /* ---------------------------------------------------------------- recursos y animación */
  function liberar(res) {
    if (!res || res.liberado) return;
    res.liberado = true;
    res.charts.forEach(function (c) { if (c) c.destroy(); });
    res.escenas.forEach(function (h) { try { h.destroy(); } catch (e) {} });
    res.charts = []; res.escenas = [];
  }
  function terminarSalidas() {
    saliendo.forEach(function (x) { clearTimeout(x.t); liberar(x.res); if (x.el.parentNode) x.el.parentNode.removeChild(x.el); });
    saliendo = [];
  }
  function contar(el) {
    $$('.cnt', el).forEach(function (n) {
      var v = parseFloat(n.getAttribute('data-v')), f = n.getAttribute('data-f');
      if (!mov() || isNaN(v)) return;
      var ini = performance.now(), dur = 1100, retraso = 250;
      n.textContent = fmtC(0, f);
      (function paso(now) {
        var k = Math.min(1, Math.max(0, (now - ini - retraso) / dur)), e = 1 - Math.pow(1 - k, 3);
        n.textContent = fmtC(v * e, f);
        if (k < 1 && n.isConnected) requestAnimationFrame(paso);
      })(ini);
    });
  }
  function mostrarPasos(hasta) {
    actual.paso = hasta;
    $$('.pr-rev', actual.el).forEach(function (e) { e.classList.toggle('vis', +e.getAttribute('data-paso') < hasta); });
    progreso();
  }
  function progreso() {
    var frac = actual && actual.pasos ? actual.paso / actual.pasos : 1;
    bar.style.width = ((idx + frac) / slides.length * 100) + '%';
  }

  /* ---------------------------------------------------------------- render y navegación */
  function render(i, dir) {
    i = Math.max(0, Math.min(slides.length - 1, i));
    if (actual && i === idx && actual.el.isConnected) return;
    dir = dir || (i >= idx ? 1 : -1);
    idx = i;
    var s = slides[idx], b = B[s.tipo] || function (x) { return { html: head(x) }; };
    terminarSalidas();                                          // avanzar rápido: se cierra la transición en curso
    var prev = actual;
    var el = document.createElement('div');
    el.className = 'pr-slide pr-' + (s.tipo || 'libre') + (CLAVE[s.tipo] ? ' pr-clave' : '');
    var r = b(s);
    el.innerHTML = '<div class="pr-inner">' + r.html + '</div>';
    var res = { charts: [], escenas: [], liberado: false };
    stage.appendChild(el);
    var pasos = 0;
    if (!clasica) $$('.pr-rev', el).forEach(function (e) { pasos = Math.max(pasos, +e.getAttribute('data-paso') + 1); });
    else $$('.pr-rev', el).forEach(function (e) { e.classList.add('vis'); });
    actual = { el: el, res: res, pasos: pasos, paso: 0 };
    if (!clasica) mostrarPasos(dir < 0 ? pasos : 0); else { actual.paso = 0; progreso(); }                          // al volver hacia atrás se ve completa
    if (r.after) r.after(el, res);
    if (prev && mov()) {
      el.classList.add(dir > 0 ? 'entra-adelante' : 'entra-atras');
      prev.el.classList.add(dir > 0 ? 'sale-adelante' : 'sale-atras');
      var x = { el: prev.el, res: prev.res };
      x.t = setTimeout(function () { liberar(x.res); if (x.el.parentNode) x.el.parentNode.removeChild(x.el); saliendo = saliendo.filter(function (y) { return y !== x; }); }, 900);
      saliendo.push(x);
    } else if (prev) {
      liberar(prev.res); if (prev.el.parentNode) prev.el.parentNode.removeChild(prev.el);
    } else if (mov()) {
      el.classList.add('entra-adelante');
    }
    root.style.setProperty('--viaje', idx);
    contar(el);
    $('.pr-count').textContent = (idx + 1) + ' / ' + slides.length;
    $('.pr-prev').disabled = idx === 0 && !actual.paso;
    $('.pr-next').disabled = idx === slides.length - 1 && actual.paso >= pasos;
    live.textContent = 'Diapositiva ' + (idx + 1) + ' de ' + slides.length + ': ' + (s.titulo || s.nombre || '');
    renderNotas();
    try { history.replaceState(null, '', '#presentar/' + (idx + 1)); } catch (e) {}
  }
  function siguiente() {
    if (actual && actual.paso < actual.pasos) { mostrarPasos(actual.paso + 1); botones(); return; }
    render(idx + 1, 1);
  }
  function anterior() {
    if (actual && actual.paso > 0 && actual.pasos) { mostrarPasos(actual.paso - 1); botones(); return; }
    render(idx - 1, -1);
  }
  function botones() {
    $('.pr-prev').disabled = idx === 0 && !actual.paso;
    $('.pr-next').disabled = idx === slides.length - 1 && actual.paso >= actual.pasos;
  }
  function renderNotas() {
    var s = slides[idx];
    $('.pr-n-bloque').textContent = (s._bloque || '') + (s._tiempo ? ' · tiempo sugerido ' + s._tiempo : '');
    $('.pr-n-body').innerHTML = (s.idea ? '<p><strong>' + esc(s.idea) + '</strong></p>' : '') +
      (s.notas && window.marked ? marked.parse(s.notas) : '');
  }
  function reloj() {
    if (!t0) return;
    var sec = Math.floor((Date.now() - t0) / 1000);
    $('.pr-n-timer').textContent = String(Math.floor(sec / 60)).padStart(2, '0') + ':' + String(sec % 60).padStart(2, '0');
  }

  var temaPrevio = null;
  function abrir(i, pantallaCompleta) {
    if (!root.open) { if (typeof root.showModal === 'function') root.showModal(); else root.setAttribute('open', ''); }
    if (!activo) {
      activo = true;
      temaPrevio = document.documentElement.getAttribute('data-theme');
      document.documentElement.setAttribute('data-theme', 'dark');           // identidad oscura propia del modo
      document.documentElement.classList.add('presentando');
    }
    Charts.lento = !clasica;                                                  // gráficos que se dibujan al entrar
    marcarModo();
    if (!t0) t0 = Date.now();
    if (!timer) timer = setInterval(reloj, 1000);
    reloj();
    if (pantallaCompleta && document.documentElement.requestFullscreen && !document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(function () {});
    }
    actual = null;
    render(i || 0, 1);
    root.focus();
  }
  // Limpieza al salir: directa (no depende del evento "close", que el navegador puede demorar). Idempotente.
  function terminar() {
    if (!activo) return;
    activo = false;
    terminarSalidas();
    if (actual) { liberar(actual.res); if (actual.el.parentNode) actual.el.parentNode.removeChild(actual.el); actual = null; }
    clearInterval(timer); timer = null;
    Charts.lento = false;
    document.documentElement.classList.remove('presentando');
    if (temaPrevio) document.documentElement.setAttribute('data-theme', temaPrevio);
    if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(function () {});
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
  }
  function marcarModo() {
    root.classList.toggle('pr-modo-clasica', clasica);
    var b = $('.pr-modo');
    if (b) { b.textContent = clasica ? '2D' : '3D'; b.setAttribute('aria-pressed', String(!clasica));
      b.title = clasica ? 'Versión común (M): pasar a 3D' : 'Versión 3D (M): pasar a la común'; }
  }
  function cambiarModo() {
    clasica = !clasica;
    try { localStorage.setItem('pr-modo', clasica ? 'clasica' : '3d'); } catch (e) {}
    Charts.lento = !clasica;
    marcarModo();
    terminarSalidas();                                        // se vuelve a dibujar la diapositiva actual en el modo nuevo
    if (actual) { liberar(actual.res); if (actual.el.parentNode) actual.el.parentNode.removeChild(actual.el); actual = null; }
    render(idx, -1);
  }
  function salir() { if (root.open) root.close(); terminar(); }
  root.addEventListener('cancel', function () { terminar(); });
  root.addEventListener('close', function () { if (!root.open) terminar(); });
  root.addEventListener('keydown', function (e) {
    if (A.detalle && A.detalle.open) return;
    var k = e.key;
    if (k === 'ArrowRight' || k === 'PageDown' || k === ' ') { e.preventDefault(); siguiente(); }
    else if (k === 'ArrowLeft' || k === 'PageUp') { e.preventDefault(); anterior(); }
    else if (k === 'Home') { e.preventDefault(); render(0, -1); }
    else if (k === 'End') { e.preventDefault(); render(slides.length - 1, -1); }
    else if (k === 'Escape') { e.preventDefault(); salir(); }
    else if (k === 'n' || k === 'N') { notes.hidden = !notes.hidden; }
    else if (k === 'm' || k === 'M') { cambiarModo(); }
    else if (k === 'f' || k === 'F') {
      if (document.fullscreenElement) document.exitFullscreen().catch(function () {});
      else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(function () {});
    }
  });
  root.addEventListener('click', function (e) {
    var c = e.target.closest('.pr-card, .pr-tcard');
    if (c) { A.openDetail(c.getAttribute('data-id')); return; }
    if (e.target.closest('.pr-prev')) anterior();
    else if (e.target.closest('.pr-next')) siguiente();
    else if (e.target.closest('.pr-close')) salir();
    else if (e.target.closest('.pr-toggle-notes')) notes.hidden = !notes.hidden;
    else if (e.target.closest('.pr-modo')) cambiarModo();
    else if (e.target.closest('.pr-n-reset')) { t0 = Date.now(); reloj(); }
  });
  if (A.detalle) A.detalle.addEventListener('close', function () { if (root.open) root.focus(); });

  var btn = document.getElementById('presentar');
  if (btn) btn.addEventListener('click', function () { abrir(0, true); });
  function desdeHash() {
    var m = /^#presentar(?:\/(\d+))?$/.exec(location.hash);
    if (m) abrir((parseInt(m[1], 10) || 1) - 1, false);
  }
  window.addEventListener('hashchange', function () { if (!root.open) desdeHash(); });
  desdeHash();
})();
