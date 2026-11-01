/* Modo presentación: diapositivas a pantalla completa sobre los mismos datos de la web.
   Textos fijos: web/contenido/presentacion.md (contenido.presentacion en datos.js). Cifras y gráficos: en vivo. */
(function () {
  'use strict';
  var A = window.App;
  if (!A) return;
  var D = A.D, Fmt = window.Fmt, Charts = window.Charts, esc = A.esc, R = D.resumen;
  var P = (D.contenido && D.contenido.presentacion) || {};
  var frases = P.frases || {};
  var DEFECTO = [
    { tipo: 'portada', titulo: '¿Acertó Danelfin?' }, { tipo: 'danelfin', titulo: 'Qué promete Danelfin' },
    { tipo: 'metodo', titulo: 'Cómo lo medimos' }, { tipo: 'numeros', titulo: 'Los números' },
    { tipo: 'dolares', titulo: 'En dólares' }, { tipo: 'semanal', titulo: 'Semana a semana' },
    { tipo: 'stop', titulo: 'Qué hizo el stop' }, { tipo: 'tecnico', titulo: 'La foto técnica' },
    { tipo: 'cierre', titulo: 'Conclusiones' }
  ];
  var slides = (P.diapositivas && P.diapositivas.length) ? P.diapositivas : DEFECTO;
  // bloque y tiempo se heredan hasta que una diapositiva define otros
  (function () {
    var b = '', t = '';
    slides.forEach(function (s) { if (s.bloque) { b = s.bloque; t = s.tiempo || ''; } s._bloque = b; s._tiempo = t; });
  })();

  var root = document.getElementById('presentacion');
  if (!root) return;
  var $ = function (sel, r) { return (r || root).querySelector(sel); };
  var $$ = function (sel, r) { return Array.prototype.slice.call((r || root).querySelectorAll(sel)); };
  var stage = $('.pr-stage'), notes = $('.pr-notes'), bar = $('.pr-progress span'), live = $('.pr-live');
  var idx = 0, charts = [], t0 = null, timer = null;

  /* ---------------------------------------------------------------- piezas */
  function head(s) {
    return '<header class="pr-head"><h2>' + esc(s.titulo || s.nombre || '') + '</h2>' +
      (s.idea ? '<p class="pr-idea">' + esc(s.idea) + '</p>' : '') + '</header>';
  }
  function tile(label, valor, sub) {
    return '<div class="pr-tile"><span class="k">' + label + '</span><span class="v">' + valor + '</span>' +
      (sub ? '<span class="s">' + sub + '</span>' : '') + '</div>';
  }
  function de(n, total) { return n + '<span class="of"> de ' + total + '</span>'; }
  function frase(a) {
    if (frases[a.ticker]) return frases[a.ticker];
    var f = D.contenido && D.contenido.empresas && D.contenido.empresas.fichas[a.ticker];
    return f && f.bajada ? f.bajada.split('. ')[0] + '.' : '';
  }
  function tarjetas(lista, textos) {
    if (!lista.length) return '<p class="pr-vacio">No hay recomendaciones en este grupo.</p>';
    return '<div class="pr-cards n' + Math.min(lista.length, 4) + '">' + lista.map(function (a, i) {
      return '<button type="button" class="pr-card" data-id="' + esc(a.id) + '" aria-label="' + esc(a.etiqueta) + ': ver el detalle diario">' +
        '<span class="top"><span class="tk">' + esc(a.etiqueta) + '</span><span class="co">' + esc(a.empresa) + '</span></span>' +
        A.badge(a) +
        '<span class="nums"><span class="big">' + A.gl(a.real) + '</span><span class="hold">hold ' + A.gl(a.hold) + '</span></span>' +
        '<span class="mini"><canvas aria-hidden="true"></canvas></span>' +
        '<span class="frase">' + esc(textos ? textos[i] : frase(a)) + '</span></button>';
    }).join('') + '</div>';
  }
  function dibujarMinis() {
    $$('.pr-card', stage).forEach(function (c) {
      var a = A.byId(c.getAttribute('data-id'));
      var ch = a && Charts.mini($('canvas', c), a); if (ch) charts.push(ch);
    });
  }
  function canvas(cls, label) { return '<div class="pr-chart ' + (cls || '') + '"><canvas role="img" aria-label="' + esc(label) + '"></canvas></div>'; }
  var con = function (a) { return a.real != null; };

  /* ---------------------------------------------------------------- diapositivas */
  var B = {
    portada: function (s) {
      var fechas = D.acciones.map(function (a) { return a.fechaRec; }).sort();
      return { html: '<div class="pr-cover"><p class="eyebrow">Seguimiento independiente · Inteligencia artificial aplicada a inversiones</p>' +
        '<h1>' + esc(s.titulo || '¿Acertó Danelfin?') + '</h1>' + (s.idea ? '<p class="pr-idea">' + esc(s.idea) + '</p>' : '') +
        '<p class="pr-meta">' + D.acciones.length + ' recomendaciones · del ' + Fmt.date(fechas[0]) + ' al ' + Fmt.date(D.meta.corte) +
        ' · datos al último cierre</p>' +
        (D.meta.equipo && D.meta.equipo.length ? '<p class="pr-meta small">Elaborado por: ' + esc(D.meta.equipo.join(', ')) + '</p>' : '') + '</div>' };
    },
    danelfin: function (s) {
      return { html: head(s) + '<div class="pr-tiles">' +
        tile('Puntaje', '1 a 10', 'AI Score: probabilidad de superar al mercado en 3 meses') +
        tile('Acierto histórico que citan', Fmt.pct(R.winrateDanelfin, 1).replace('+', ''), 'promedio de los boletines, a 3 meses') +
        tile('Retorno histórico que citan', Fmt.pct(R.avgretDanelfin, 1), 'promedio de los boletines, a 3 meses') +
        tile('Probabilidad prometida', Fmt.pct(R.probProm, 1).replace('+', ''), 'de superar al mercado, promedio') + '</div>' };
    },
    metodo: function (s) {
      var paso = function (n, t, d) { return '<div class="pr-step"><span class="n">' + n + '</span><h3>' + t + '</h3><p>' + d + '</p></div>'; };
      return { html: head(s) + '<div class="pr-steps">' +
        paso(1, 'Entrada', 'Al precio que publica cada boletín de Danelfin.') +
        paso(2, 'Salida', 'Al primer toque del stop loss o del take profit durante el día; si abre más allá del nivel, a la apertura.') +
        paso(3, 'Medición', '<strong>Real</strong>, con las reglas; <strong>hold</strong>, sin vender nunca; y el <strong>S&amp;P 500</strong> en las mismas fechas.') +
        '</div>' };
    },
    numeros: function (s) {
      return { html: head(s) + '<div class="pr-tiles">' +
        tile('Rendimiento real promedio', A.gl(R.realProm), 'con stop loss y take profit') +
        tile('Rendimiento hold promedio', A.gl(R.holdProm), 'sin vender') +
        tile('Tocaron el stop loss', de(R.stops, R.n), R.takes + ' el take profit · ' + R.abiertas + ' abiertas') +
        tile('Superaron al S&amp;P 500', de(R.superaronSPY, R.n), 'alpha promedio ' + Fmt.pct(R.alphaProm, 1)) + '</div>' };
    },
    dolares: function (s) {
      return { html: head(s) + '<p class="pr-sub">Con ' + Fmt.usd(R.capital, 0, false) + ' en cada recomendación (' + Fmt.usd(R.invertido, 0, false) + ' en total):</p>' +
        '<div class="pr-tiles n3">' + tile('Resultado real', A.glUsd(R.pnlReal)) + tile('Hold (sin stops)', A.glUsd(R.pnlHold)) +
        tile('Mismo capital en el S&amp;P 500', A.glUsd(R.pnlSpy)) + '</div>' +
        '<div class="legend"><span><i class="sq" style="background:var(--real)"></i>Real</span><span><i class="sq" style="background:var(--hold)"></i>Hold</span></div>' +
        canvas('md', 'Rendimiento real y hold por acción'),
        after: function () { charts.push(Charts.barras($('.pr-chart canvas', stage), D.acciones.filter(con))); } };
    },
    semanal: function (s) {
      return { html: head(s) + '<div class="legend"><span><i style="border-color:var(--real)"></i>Real</span><span><i class="dash" style="border-color:var(--hold)"></i>Hold</span>' +
        '<span><i class="dot" style="border-color:var(--spy)"></i>S&amp;P 500 (SPY)</span></div>' + canvas('lg', 'Evolución semanal del promedio contra el S&P 500'),
        after: function () { charts.push(Charts.semanal($('.pr-chart canvas', stage), D)); } };
    },
    contexto: function (s) {
      var pts = s.punto || [];
      return { html: head(s) + '<ul class="pr-points">' + pts.map(function (p) {
        var i = p.indexOf(':');
        return '<li>' + (i > 0 ? '<strong>' + esc(p.slice(0, i)) + '</strong>' + esc(p.slice(i)) : esc(p)) + '</li>';
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
        after: function () { charts.push(Charts.stopDiff($('.pr-chart canvas', stage), lista)); } };
    },
    tecnico: function (s) {
      var lista = D.acciones.filter(function (a) { return a.pre && a.pre.length; });
      return { html: head(s) + '<div class="legend"><span><i style="border-color:var(--ink)"></i>Cierre</span><span><i style="border-color:var(--real)"></i>EMA 20</span>' +
        '<span><i class="dash" style="border-color:var(--hold)"></i>EMA 50</span><span><i class="dot" style="border-color:var(--spy)"></i>EMA 200</span></div>' +
        '<div class="pr-tec">' + lista.map(function (a) {
          var e = A.entradaSnap(a);
          return '<button type="button" class="pr-tcard" data-id="' + esc(a.id) + '" aria-label="' + esc(a.etiqueta) + ': ver el detalle diario">' +
            '<span class="tk">' + esc(a.etiqueta) + '</span><span class="mini"><canvas aria-hidden="true"></canvas></span>' +
            '<span class="vals">RSI ' + Fmt.n1(e.rsi) + ' · MFI ' + Fmt.n1(e.mfi) + ' · ADX ' + Fmt.n1(e.adx) +
            '<br>+DI ' + Fmt.n1(e.pdi) + ' / −DI ' + Fmt.n1(e.mdi) + ' · vs EMA 200 ' + Fmt.pct(e.cierre / e.ema200 - 1, 1) + '</span></button>';
        }).join('') + '</div>',
        after: function () {
          $$('.pr-tcard', stage).forEach(function (c) {
            var ch = Charts.tecPrecio($('canvas', c), A.byId(c.getAttribute('data-id')), { compacto: true }); if (ch) charts.push(ch);
          });
        } };
    },
    cierre: function (s) {
      var url = location.href.split('#')[0];
      var concl = D.contenido && D.contenido.conclusiones;
      return { html: head(s) + '<ul class="pr-points">' + (s.punto || []).map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('') + '</ul>' +
        (concl && window.marked ? '<div class="pr-concl prose">' + marked.parse(concl) + '</div>' : '') +
        '<p class="pr-meta">Informe completo y Excel descargable: <a href="' + esc(url) + '">' + esc(url.replace(/^https?:\/\//, '')) + '</a></p>' +
        '<p class="pr-legal">Seguimiento independiente, sin afiliación con Danelfin. No constituye asesoramiento ni recomendación de inversión; rendimientos pasados no garantizan resultados futuros.</p>' };
    }
  };

  /* ---------------------------------------------------------------- render y navegación */
  function limpiar() { charts.forEach(function (c) { if (c) c.destroy(); }); charts = []; }
  function render(i) {
    idx = Math.max(0, Math.min(slides.length - 1, i));
    var s = slides[idx], b = B[s.tipo] || function (x) { return { html: head(x) }; };
    limpiar();
    var r = b(s);
    stage.innerHTML = '<div class="pr-slide pr-' + esc(s.tipo || 'libre') + '">' + r.html + '</div>';
    if (r.after) r.after();
    bar.style.width = ((idx + 1) / slides.length * 100) + '%';
    $('.pr-count').textContent = (idx + 1) + ' / ' + slides.length;
    $('.pr-prev').disabled = idx === 0;
    $('.pr-next').disabled = idx === slides.length - 1;
    live.textContent = 'Diapositiva ' + (idx + 1) + ' de ' + slides.length + ': ' + (s.titulo || s.nombre || '');
    renderNotas();
    try { history.replaceState(null, '', '#presentar/' + (idx + 1)); } catch (e) {}
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
  var activo = false;
  function abrir(i, pantallaCompleta) {
    if (!root.open) { if (typeof root.showModal === 'function') root.showModal(); else root.setAttribute('open', ''); }
    activo = true;
    document.documentElement.classList.add('presentando');
    if (!t0) t0 = Date.now();
    if (!timer) timer = setInterval(reloj, 1000);
    reloj();
    if (pantallaCompleta && document.documentElement.requestFullscreen && !document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(function () {});
    }
    render(i || 0);
    root.focus();
  }
  // Limpieza al salir. Se llama de forma directa (no solo desde el evento "close", que el navegador
  // puede demorar, por ejemplo con la pestaña en segundo plano). Es idempotente.
  function terminar() {
    if (!activo) return;
    activo = false;
    limpiar();
    clearInterval(timer); timer = null;
    document.documentElement.classList.remove('presentando');
    if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(function () {});
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
  }
  function salir() { if (root.open) root.close(); terminar(); }
  root.addEventListener('cancel', function () { terminar(); });          // Esc
  root.addEventListener('close', function () { if (!root.open) terminar(); });
  root.addEventListener('keydown', function (e) {
    if (A.detalle && A.detalle.open) return;                 // el detalle abierto maneja sus propias teclas
    var k = e.key;
    if (k === 'ArrowRight' || k === 'PageDown' || k === ' ') { e.preventDefault(); render(idx + 1); }
    else if (k === 'ArrowLeft' || k === 'PageUp') { e.preventDefault(); render(idx - 1); }
    else if (k === 'Home') { e.preventDefault(); render(0); }
    else if (k === 'End') { e.preventDefault(); render(slides.length - 1); }
    else if (k === 'Escape') { e.preventDefault(); salir(); }
    else if (k === 'n' || k === 'N') { notes.hidden = !notes.hidden; }
    else if (k === 'f' || k === 'F') {
      if (document.fullscreenElement) document.exitFullscreen().catch(function () {});
      else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(function () {});
    }
  });
  root.addEventListener('click', function (e) {
    var c = e.target.closest('.pr-card, .pr-tcard');
    if (c) { A.openDetail(c.getAttribute('data-id')); return; }
    if (e.target.closest('.pr-prev')) render(idx - 1);
    else if (e.target.closest('.pr-next')) render(idx + 1);
    else if (e.target.closest('.pr-close')) salir();
    else if (e.target.closest('.pr-toggle-notes')) notes.hidden = !notes.hidden;
    else if (e.target.closest('.pr-n-reset')) { t0 = Date.now(); reloj(); }
  });
  // Al cerrar el detalle, el foco vuelve a la presentación para seguir con las flechas.
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
