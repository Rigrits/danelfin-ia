/* TP IA · Danelfin — lógica de la página. Todo sale de window.DATOS (web/data/datos.js, generado por el script). */
(function () {
  'use strict';
  var D = window.DATOS;
  var Fmt = window.Fmt, Charts = window.Charts;
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  if (!D || !D.acciones) {
    $('#contenido').innerHTML = '<div class="wrap"><div class="notice"><strong>No se encontraron los datos.</strong> ' +
      'Falta <code>data/datos.js</code>. Se genera corriendo <code>python seguimiento_danelfin.py</code> en la carpeta del proyecto.</div></div>';
    return;
  }

  /* ------------------------------------------------------------ iconos y piezas */
  var I = {
    up: '<svg viewBox="0 0 10 10" aria-hidden="true"><path d="M5 1l4.5 8h-9z" fill="currentColor"/></svg>',
    down: '<svg viewBox="0 0 10 10" aria-hidden="true"><path d="M5 9L.5 1h9z" fill="currentColor"/></svg>',
    flat: '<svg viewBox="0 0 10 10" aria-hidden="true"><path d="M1 5h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    x: '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2 2l8 8M10 2L2 10" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
    check: '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2 6.5l3 3 5-6.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    dot: '<svg viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="6" r="3.5" fill="none" stroke="currentColor" stroke-width="2"/></svg>'
  };
  function gl(v, d) {
    if (v == null) return '<span class="gl flat">—</span>';
    d = d == null ? 1 : d;
    var r = Fmt.round(v, d);
    var c = r > 0 ? 'up' : r < 0 ? 'down' : 'flat';
    return '<span class="gl ' + c + '">' + I[c] + Fmt.pct(v, d) + '</span>';
  }
  function badge(a) {
    if (a.estado === 'stop') return '<span class="badge stop">' + I.x + 'Stop loss · ' + Fmt.dm(a.salida.fecha) + '</span>';
    if (a.estado === 'take') return '<span class="badge take">' + I.check + 'Take profit · ' + Fmt.dm(a.salida.fecha) + '</span>';
    if (a.estado === 'abierta') return '<span class="badge open">' + I.dot + 'Abierta</span>';
    return '<span class="badge open">Sin datos aún</span>';
  }
  function estadoTxt(a) { return a.estado === 'stop' ? 'Stop loss' : a.estado === 'take' ? 'Take profit' : a.estado === 'abierta' ? 'Abierta' : 'Sin datos'; }
  function byId(id) { return D.acciones.filter(function (a) { return a.id === id; })[0]; }
  // Si un ticker se recomendó más de una vez, la etiqueta visible suma la fecha.
  (function () {
    var n = {};
    D.acciones.forEach(function (a) { n[a.ticker] = (n[a.ticker] || 0) + 1; });
    D.acciones.forEach(function (a) { a.etiqueta = n[a.ticker] > 1 ? a.ticker + ' ' + Fmt.dm(a.fechaRec) : a.ticker; });
  })();
  function stale(a) { return a.fechaDato && a.fechaDato < D.meta.corte; }

  var st = { metrica: 'real', filtro: 'todas', orden: 'fecha' };
  function val(a) { return a[st.metrica]; }
  function visibles() {
    var l = D.acciones.filter(function (a) { return st.filtro === 'todas' || a.estado === st.filtro; });
    var cmp = {
      fecha: function (a, b) { return a.fechaRec < b.fechaRec ? -1 : a.fechaRec > b.fechaRec ? 1 : 0; },
      mejor: function (a, b) { return (val(b) == null ? -9 : val(b)) - (val(a) == null ? -9 : val(a)); },
      peor: function (a, b) { return (val(a) == null ? 9 : val(a)) - (val(b) == null ? 9 : val(b)); },
      ticker: function (a, b) { return a.ticker < b.ticker ? -1 : 1; }
    }[st.orden];
    return l.slice().sort(cmp);
  }

  /* ------------------------------------------------------------ tablas ordenables */
  function makeTable(host, o) {
    var state = { key: o.sortKey, dir: o.sortDir || 1 };
    function draw() {
      var rows = o.rows().slice();
      var col = o.cols.filter(function (c) { return c.key === state.key; })[0];
      if (col && col.val) rows.sort(function (a, b) {
        var x = col.val(a), y = col.val(b);
        if (x == null) return 1; if (y == null) return -1;
        return (x < y ? -1 : x > y ? 1 : 0) * state.dir;
      });
      var h = (o.caption ? '<div class="tcap">' + esc(o.caption) + '</div>' : '') +
        '<div class="scroll" role="region" tabindex="0" aria-label="' + esc(o.caption || 'Tabla de datos') + '"><table><thead><tr>';
      o.cols.forEach(function (c) {
        var sorted = c.key === state.key ? (state.dir > 0 ? 'ascending' : 'descending') : 'none';
        h += '<th scope="col"' + (c.left ? ' class="l"' : '') + (c.val ? ' aria-sort="' + sorted + '"' : '') + '>' +
          (c.val ? '<button type="button" data-k="' + c.key + '">' + esc(c.label) + '</button>' : esc(c.label)) + '</th>';
      });
      h += '</tr></thead><tbody>';
      rows.forEach(function (r) {
        h += '<tr>';
        o.cols.forEach(function (c, i) {
          h += '<td' + (c.left ? ' class="l"' : '') + '>' + c.cell(r) + '</td>';
        });
        h += '</tr>';
      });
      if (!rows.length) h += '<tr><td colspan="' + o.cols.length + '" class="l muted">Sin resultados para este filtro.</td></tr>';
      host.innerHTML = h + '</tbody></table></div>';
    }
    host.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-k]');
      if (b) {
        var k = b.getAttribute('data-k');
        if (state.key === k) state.dir = -state.dir; else { state.key = k; state.dir = 1; }
        draw();
        var again = host.querySelector('button[data-k="' + k + '"]'); if (again) again.focus();
        return;
      }
      var t = e.target.closest('button[data-id]');
      if (t) openDetail(t.getAttribute('data-id'));
    });
    draw();
    return { draw: draw };
  }
  function tkBtn(a) { return '<button type="button" class="linkbtn" data-id="' + esc(a.id) + '">' + esc(a.etiqueta) + '</button>'; }

  /* ------------------------------------------------------------ encabezado y resumen */
  function renderHeader() {
    var e = D.meta.excel;
    $('#descarga-meta').textContent = '· ' + e.kb + ' KB · al ' + Fmt.dm(D.meta.corte);
    $('#descarga').setAttribute('title', 'Excel con el seguimiento completo, actualizado al ' + Fmt.date(D.meta.corte));
  }
  function renderHero() {
    var R = D.resumen, n = R.n;
    var first = D.acciones.reduce(function (m, a) { return a.fechaRec < m ? a.fechaRec : m; }, '9999');
    $('#lede').textContent = 'Seguimiento de ' + D.acciones.length + ' recomendaciones BUY de Danelfin AI, desde el ' + Fmt.date(first) +
      ' hasta el ' + Fmt.date(D.meta.corte) + '. Cada una se sigue con su precio de entrada, stop loss y take profit tal como los publica Danelfin.';
    var k = function (label, num, sub) { return '<div class="kpi" role="listitem"><span class="label">' + label + '</span><span class="num">' + num + '</span><span class="sub">' + sub + '</span></div>'; };
    $('#kpis').innerHTML =
      k('Rendimiento real promedio', gl(R.realProm), 'con los stop loss y take profit de Danelfin') +
      k('Rendimiento hold promedio', gl(R.holdProm), 'sin vender: &uacute;ltimo cierre contra entrada') +
      k('Tocaron el stop loss', R.stops + '<span class="of">de ' + n + '</span>', R.takes + ' el take profit · ' + R.abiertas + ' abiertas') +
      k('Superaron al S&amp;P 500', R.superaronSPY + '<span class="of">de ' + n + '</span>', 'alpha promedio ' + Fmt.pct(R.alphaProm));
    var des = D.meta.desactualizados || [];
    if (des.length) {
      var av = $('#aviso-datos');
      av.textContent = 'Atención: ' + des.map(function (x) { return x.t + ' (dato al ' + Fmt.dm(x.fecha) + ')'; }).join(', ') +
        (des.length === 1 ? ' no tiene' : ' no tienen') + ' todavía el cierre del ' + Fmt.date(D.meta.corte) +
        ' porque la fuente de precios no lo publicó a tiempo. Se completa en la próxima actualización.';
      av.hidden = false;
    }
    $('#facts').innerHTML = R.frases.map(function (f) { return '<li>' + esc(f) + '</li>'; }).join('');
    var c = D.contenido && D.contenido.conclusiones;
    if (c && window.marked) { $('#conclusiones').innerHTML = marked.parse(c); $('#equipo-bloque').hidden = false; }
    else $('.readout').style.gridTemplateColumns = '1fr';
  }

  function renderDanelfin() {
    var t = D.contenido && D.contenido.danelfin;
    $('#danelfin-texto').innerHTML = (t && window.marked) ? marked.parse(t) :
      '<p class="muted">Contenido pendiente: se redacta en <code>web/contenido/danelfin.md</code> y se incorpora al correr el script.</p>';
    makeTable($('#promesa-wrap'), {
      caption: 'Lo que Danelfin cita en cada mail, frente a lo que pasó hasta hoy',
      sortKey: 'fecha', rows: function () { return D.acciones; },
      cols: [
        { key: 'ticker', label: 'Ticker', val: function (a) { return a.ticker; }, cell: tkBtn },
        { key: 'fecha', label: 'Recomendada', val: function (a) { return a.fechaRec; }, cell: function (a) { return Fmt.date(a.fechaRec); } },
        { key: 'score', label: 'AI Score', val: function (a) { return a.score; }, cell: function (a) { return a.score + '/10'; } },
        { key: 'prob', label: 'Prob. de superar al mercado (3M)', val: function (a) { return a.prob; }, cell: function (a) { return Fmt.pct(a.prob, 1).replace('+', ''); } },
        { key: 'wr', label: 'Win rate hist. 3M', val: function (a) { return a.winrate; }, cell: function (a) { return a.winrate == null ? '—' : Fmt.pct(a.winrate, 1).replace('+', ''); } },
        { key: 'ar', label: 'Retorno prom. hist. 3M', val: function (a) { return a.avgret; }, cell: function (a) { return Fmt.pct(a.avgret, 1); } },
        { key: 'real', label: 'Real a la fecha', val: function (a) { return a.real; }, cell: function (a) { return gl(a.real); } },
        { key: 'estado', label: 'Estado', left: true, val: estadoTxt, cell: function (a) { return badge(a); } }
      ]
    });
    var p = document.createElement('p');
    p.className = 'muted small';
    p.style.marginTop = '.8rem';
    p.textContent = 'El win rate y el retorno histórico son a 3 meses y salen de cada mail; el rendimiento real es a la fecha de corte, con menos tiempo transcurrido.';
    $('#promesa-wrap').parentNode.appendChild(p);
  }

  /* ------------------------------------------------------------ resultados */
  var charts = { grid: [], panels: {}, dlg: null };
  function destroy(c) { if (c) c.destroy(); }

  function renderGrid() {
    var l = visibles();
    $('#cuenta').textContent = l.length + ' de ' + D.acciones.length + ' recomendaciones';
    charts.grid.forEach(destroy); charts.grid = [];
    var g = $('#grid');
    g.innerHTML = l.length ? '' : '<p class="empty">Ninguna recomendación en este estado por ahora.</p>';
    l.forEach(function (a) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'card'; b.setAttribute('data-id', a.id);
      b.setAttribute('aria-label', a.etiqueta + ', recomendada el ' + Fmt.date(a.fechaRec) + ', ' + estadoTxt(a) + ', ' +
        (val(a) == null ? 'sin datos' : Fmt.pct(val(a), 1)) + (stale(a) ? ', dato al ' + Fmt.date(a.fechaDato) : '') + '. Ver detalle');
      b.innerHTML = '<span class="card-top"><span class="tk">' + esc(a.etiqueta) + '</span><span class="co">' + esc(a.empresa) + '</span></span>' +
        badge(a) +
        '<span class="big">' + gl(val(a)) + '</span>' +
        (stale(a) ? '<span class="stale">Último dato: ' + Fmt.dm(a.fechaDato) + '</span>' : '') +
        '<span class="mini"><canvas aria-hidden="true"></canvas></span>' +
        '<span class="lv"><span><small>Entrada</small>' + Fmt.n2(a.entrada) + '</span><span><small>Stop loss</small>' + Fmt.n2(a.sl) + '</span><span><small>Take profit</small>' + Fmt.n2(a.tp) + '</span></span>';
      g.appendChild(b);
      var cv = $('canvas', b);
      var ch = Charts.mini(cv, a);
      if (ch) charts.grid.push(ch);
    });
  }
  function renderPanels() {
    var l = visibles().filter(function (a) { return a.real != null; });
    ['barras', 'semanal', 'alpha'].forEach(function (k) { destroy(charts.panels[k]); });
    charts.panels.barras = Charts.barras($('#ch-barras'), l);
    charts.panels.semanal = Charts.semanal($('#ch-semanal'), D);
    var al = D.acciones.filter(function (a) { return a.alphaReal != null; }).slice().sort(function (a, b) { return b.alphaReal - a.alphaReal; });
    charts.panels.alpha = Charts.alpha($('#ch-alpha'), al);
  }

  var tablaRes;
  function renderTablaResultados() {
    tablaRes = makeTable($('#tabla-wrap'), {
      caption: 'Detalle numérico de las recomendaciones', sortKey: 'fecha',
      rows: visibles,
      cols: [
        { key: 'ticker', label: 'Ticker', val: function (a) { return a.ticker; }, cell: tkBtn },
        { key: 'empresa', label: 'Empresa', left: true, val: function (a) { return a.empresa; }, cell: function (a) { return esc(a.empresa); } },
        { key: 'fecha', label: 'Recomendada', val: function (a) { return a.fechaRec; }, cell: function (a) { return Fmt.date(a.fechaRec); } },
        { key: 'entrada', label: 'Entrada', val: function (a) { return a.entrada; }, cell: function (a) { return Fmt.n2(a.entrada); } },
        { key: 'sl', label: 'Stop loss', val: function (a) { return a.sl; }, cell: function (a) { return Fmt.n2(a.sl); } },
        { key: 'tp', label: 'Take profit', val: function (a) { return a.tp; }, cell: function (a) { return Fmt.n2(a.tp); } },
        { key: 'estado', label: 'Estado', left: true, val: estadoTxt, cell: badge },
        { key: 'salida', label: 'Precio de salida', val: function (a) { return a.salida ? a.salida.precio : null; }, cell: function (a) { return a.salida ? Fmt.n2(a.salida.precio) : '—'; } },
        { key: 'ultimo', label: 'Último cierre', val: function (a) { return a.ultimo; }, cell: function (a) { return Fmt.n2(a.ultimo); } },
        { key: 'real', label: 'Real', val: function (a) { return a.real; }, cell: function (a) { return gl(a.real); } },
        { key: 'hold', label: 'Hold', val: function (a) { return a.hold; }, cell: function (a) { return gl(a.hold); } }
      ]
    });
  }

  /* ------------------------------------------------------------ indicadores y benchmark */
  function zone(v, hi, lo, hiT, loT) { return v >= hi ? '<span class="zone">' + hiT + '</span>' : v <= lo ? '<span class="zone">' + loT + '</span>' : ''; }
  function adxZone(v) { return '<span class="zone">' + (v < 20 ? 'sin tendencia' : v < 25 ? 'débil' : v < 40 ? 'tendencia' : 'fuerte') + '</span>'; }
  function entradaSnap(a) { return a.indicadores.filter(function (s) { return s.momento.indexOf('Al entrar') === 0; })[0]; }

  function renderIndicadores() {
    makeTable($('#ind-entrada-wrap'), {
      caption: 'Indicadores al recomendar (cierre previo a la entrada) y resultado', sortKey: 'fecha',
      rows: function () { return D.acciones.filter(entradaSnap); },
      cols: [
        { key: 'ticker', label: 'Ticker', val: function (a) { return a.ticker; }, cell: tkBtn },
        { key: 'fecha', label: 'Recomendada', val: function (a) { return a.fechaRec; }, cell: function (a) { return Fmt.date(a.fechaRec); } },
        { key: 'res', label: 'Resultado', left: true, val: function (a) { return a.real; }, cell: function (a) { return gl(a.real); } },
        { key: 'adx', label: 'ADX', val: function (a) { return entradaSnap(a).adx; }, cell: function (a) { var s = entradaSnap(a); return Fmt.n1(s.adx) + adxZone(s.adx); } },
        { key: 'pdi', label: '+DI', val: function (a) { return entradaSnap(a).pdi; }, cell: function (a) { return Fmt.n1(entradaSnap(a).pdi); } },
        { key: 'mdi', label: '−DI', val: function (a) { return entradaSnap(a).mdi; }, cell: function (a) { return Fmt.n1(entradaSnap(a).mdi); } },
        { key: 'rsi', label: 'RSI', val: function (a) { return entradaSnap(a).rsi; }, cell: function (a) { var s = entradaSnap(a); return Fmt.n1(s.rsi) + zone(s.rsi, 70, 30, 'sobrecompra', 'sobreventa'); } },
        { key: 'mfi', label: 'MFI', val: function (a) { return entradaSnap(a).mfi; }, cell: function (a) { var s = entradaSnap(a); return Fmt.n1(s.mfi) + zone(s.mfi, 80, 20, 'sobrecompra', 'sobreventa'); } },
        { key: 'hist', label: 'Hist. MACD', val: function (a) { return entradaSnap(a).hist; }, cell: function (a) { var h = entradaSnap(a).hist; return '<span class="gl ' + (h > 0 ? 'up' : 'down') + '">' + I[h > 0 ? 'up' : 'down'] + Fmt.n2(h) + '</span>'; } },
        { key: 'ema', label: 'Cierre vs EMA 50', left: true, val: function (a) { var s = entradaSnap(a); return s.cierre / s.ema50; }, cell: function (a) { var s = entradaSnap(a); return s.cierre > s.ema50 ? 'Sobre la EMA 50' : 'Bajo la EMA 50'; } },
        { key: 'conds', label: 'Condiciones alcistas', val: function (a) { return entradaSnap(a).conds; }, cell: function (a) { return entradaSnap(a).conds + ' de 5'; } }
      ]
    });

    var sel = $('#ind-ticker');
    sel.innerHTML = D.acciones.filter(function (a) { return a.indicadores.length; }).map(function (a) { return '<option value="' + esc(a.id) + '">' + esc(a.etiqueta) + ' · ' + esc(a.empresa) + '</option>'; }).join('');
    var evol = makeTable($('#ind-evol-wrap'), {
      caption: 'Evolución de los indicadores', sortKey: null,
      rows: function () { var a = byId(sel.value); return a ? a.indicadores : []; },
      cols: [
        { key: 'm', label: 'Momento', left: true, cell: function (s) { return esc(s.momento); } },
        { key: 'f', label: 'Fecha', cell: function (s) { return Fmt.date(s.fecha); } },
        { key: 'c', label: 'Cierre', cell: function (s) { return Fmt.n2(s.cierre); } },
        { key: 'adx', label: 'ADX', cell: function (s) { return Fmt.n1(s.adx); } },
        { key: 'pdi', label: '+DI', cell: function (s) { return Fmt.n1(s.pdi); } },
        { key: 'mdi', label: '−DI', cell: function (s) { return Fmt.n1(s.mdi); } },
        { key: 'rsi', label: 'RSI', cell: function (s) { return Fmt.n1(s.rsi); } },
        { key: 'mfi', label: 'MFI', cell: function (s) { return Fmt.n1(s.mfi); } },
        { key: 'macd', label: 'MACD', cell: function (s) { return Fmt.n2(s.macd); } },
        { key: 'sen', label: 'Señal', cell: function (s) { return Fmt.n2(s.senal); } },
        { key: 'hist', label: 'Histograma', cell: function (s) { return Fmt.n2(s.hist); } },
        { key: 'e20', label: 'EMA 20', cell: function (s) { return Fmt.n2(s.ema20); } },
        { key: 'e50', label: 'EMA 50', cell: function (s) { return Fmt.n2(s.ema50); } },
        { key: 'e200', label: 'EMA 200', cell: function (s) { return Fmt.n2(s.ema200); } },
        { key: 'conds', label: 'Cond. alcistas', cell: function (s) { return s.conds + ' de 5'; } },
        { key: 'pos', label: 'Posición', left: true, cell: function (s) { return '<span class="tag">' + esc(s.pos) + '</span>'; } }
      ]
    });
    sel.addEventListener('change', function () { evol.draw(); });

    makeTable($('#bench-wrap'), {
      sortKey: 'alpha', sortDir: -1,
      rows: function () { return D.acciones.filter(function (a) { return a.alphaReal != null; }); },
      cols: [
        { key: 'ticker', label: 'Ticker', val: function (a) { return a.ticker; }, cell: tkBtn },
        { key: 'acc', label: 'Acción', val: function (a) { return a.real; }, cell: function (a) { return gl(a.real); } },
        { key: 'spy', label: 'SPY', val: function (a) { return a.spyReal; }, cell: function (a) { return gl(a.spyReal); } },
        { key: 'alpha', label: 'Alpha', val: function (a) { return a.alphaReal; }, cell: function (a) { return gl(a.alphaReal); } }
      ]
    });
  }

  /* ------------------------------------------------------------ metodología y pie */
  function renderMetodologia() {
    $('#supuestos').innerHTML = D.meta.supuestos.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('');
    var p = D.meta.params;
    $('#parametros').innerHTML = [
      'ADX, +DI y −DI: ' + p.adx + ' períodos (suavizado de Wilder)',
      'RSI: ' + p.rsi + ' períodos; MFI: ' + p.mfi + ' períodos',
      'MACD: ' + p.macd.join(' / ') + ' (rápida / lenta / señal)',
      'Medias exponenciales: ' + p.emas.join(', ') + ' ruedas',
      'Condiciones alcistas (0 a 5): cierre sobre la EMA 50, +DI mayor que −DI, RSI mayor que 50, MFI mayor que 50 y MACD sobre su señal'
    ].map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('');
    if (D.meta.avisos && D.meta.avisos.length) {
      $('#avisos').innerHTML = D.meta.avisos.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('');
      $('#det-avisos').hidden = false;
    }
  }
  function renderPie() {
    var m = D.meta;
    if (m.equipoNombre) $('#equipo-nombre').textContent = m.equipoNombre + '. ';
    $('#integrantes').textContent = m.equipo.join(', ') + '.';
    var g = new Date(m.generado);
    $('#pie-datos').textContent = 'Datos al último cierre del ' + Fmt.date(m.corte) + ' · generado el ' +
      g.toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }) + '.';
  }

  /* ------------------------------------------------------------ detalle */
  var dlg = $('#detalle');
  function openDetail(t) {
    var a = byId(t); if (!a) return;
    $('#det-titulo').textContent = a.etiqueta + ' · ' + a.empresa;
    $('#det-sub').textContent = 'Recomendada el ' + Fmt.date(a.fechaRec) + ' · AI Score ' + a.score + '/10 · probabilidad de superar al mercado ' + Fmt.pct(a.prob, 1).replace('+', '');
    var stat = function (k, v) { return '<div class="stat"><div class="k">' + k + '</div><div class="v">' + v + '</div></div>'; };
    var h = '<div class="dlg-stats">' +
      stat('Entrada', Fmt.n2(a.entrada)) + stat('Stop loss', Fmt.n2(a.sl)) + stat('Take profit', Fmt.n2(a.tp)) +
      stat('Último cierre', Fmt.n2(a.ultimo)) + stat('Real', gl(a.real)) + stat('Hold', gl(a.hold)) +
      stat('S&amp;P 500 en la ventana', gl(a.spyReal)) + stat('Alpha real', gl(a.alphaReal)) + '</div>';
    h += callout(a);
    h += '<div class="dlg-chart"><canvas id="ch-detalle" role="img" aria-label="Precio diario de ' + esc(a.ticker) + ' con entrada, stop loss, take profit y salida"></canvas></div>';
    h += '<p class="muted small">Línea azul: cierre diario hasta la salida (gris punteada: lo que habría pasado después). Banda azul clara: rango diario mínimo–máximo. ✕: salida simulada.</p>';
    h += '<div class="table-wrap flush"><div class="tcap">Viernes desde la entrada</div><div class="scroll"><table><thead><tr><th scope="col">Viernes</th><th scope="col">Cierre</th><th scope="col">Real</th><th scope="col">Hold</th><th scope="col">S&amp;P 500</th></tr></thead><tbody>' +
      a.viernes.map(function (v) { return '<tr><td>' + Fmt.date(v.f) + '</td><td>' + Fmt.n2(v.p) + '</td><td>' + gl(v.real) + '</td><td>' + gl(v.hold) + '</td><td>' + gl(v.spy) + '</td></tr>'; }).join('') +
      '</tbody></table></div></div>';
    $('#det-cuerpo').innerHTML = h;
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
    drawDetail(a);
  }
  function drawDetail(a) {
    destroy(charts.dlg);
    var cv = $('#ch-detalle');
    charts.dlg = (cv && a.serie.length) ? Charts.detalle(cv, a) : null;
    dlg.setAttribute('data-id', a.id);
  }
  function callout(a) {
    var s = '';
    var minLow = a.serie.length ? Math.min.apply(null, a.serie.map(function (x) { return x.l; })) : null;
    if (a.estado === 'stop' || a.estado === 'take') {
      var ex = a.salida, day = a.serie.filter(function (x) { return x.d === ex.fecha; })[0] || {};
      var isSL = ex.motivo === 'SL', lvl = isSL ? a.sl : a.tp;
      var gap = isSL ? ex.precio < a.sl - 0.005 : ex.precio > a.tp + 0.005;
      s = (isSL ? 'Tocó el stop loss' : 'Tocó el take profit') + ' el ' + Fmt.date(ex.fecha) + ': el ' + (isSL ? 'mínimo' : 'máximo') + ' del día (' +
        Fmt.n2(isSL ? day.l : day.h) + ') ' + (isSL ? 'cayó hasta' : 'llegó a') + ' el nivel de ' + Fmt.n2(lvl) + '. ' +
        (gap ? 'La acción abrió ya más allá del nivel (' + Fmt.n2(day.o) + '), así que se simula la salida a la apertura: ' : 'Se simula la salida en ') + Fmt.n2(ex.precio) + '. ';
      if (ex.ambiguo) s += 'El mismo día también tocó el otro nivel; se asume el stop por prudencia. ';
      var fv = a.viernes.filter(function (v) { return v.f >= ex.fecha; })[0];
      if (fv && isSL) s += 'El viernes ' + Fmt.dm(fv.f) + ' cerró en ' + Fmt.n2(fv.p) + (fv.p > a.sl ? ', por encima del stop: recuperó, pero la posición ya estaba cerrada.' : ', todavía por debajo del stop.');
    } else if (a.estado === 'abierta') {
      s = 'Sigue abierta. Desde la entrada, el mínimo diario fue ' + Fmt.n2(minLow) + ' (' + Fmt.pct(minLow / a.sl - 1, 1) + ' respecto del stop loss de ' + Fmt.n2(a.sl) + ') y el último cierre ' + Fmt.n2(a.ultimo) + '.';
    } else s = 'Todavía no hay datos de mercado posteriores a la recomendación.';
    return '<div class="callout ' + (a.estado === 'stop' ? 'stop' : a.estado === 'take' ? 'take' : '') + '">' + esc(s) + '</div>';
  }
  $('#det-cerrar').addEventListener('click', function () { dlg.close(); });
  dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
  dlg.addEventListener('close', function () { destroy(charts.dlg); charts.dlg = null; });

  /* ------------------------------------------------------------ eventos */
  $$('[data-metrica]').forEach(function (b) {
    b.addEventListener('click', function () {
      st.metrica = b.getAttribute('data-metrica');
      $$('[data-metrica]').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
      renderGrid();
    });
  });
  $$('[data-filtro]').forEach(function (b) {
    b.addEventListener('click', function () {
      st.filtro = b.getAttribute('data-filtro');
      $$('[data-filtro]').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
      renderGrid(); renderPanels(); tablaRes.draw();
    });
  });
  $('#orden').addEventListener('change', function (e) { st.orden = e.target.value; renderGrid(); renderPanels(); });
  $('#grid').addEventListener('click', function (e) { var c = e.target.closest('.card'); if (c) openDetail(c.getAttribute('data-id')); });

  $('#tema').addEventListener('click', function () {
    var cur = document.documentElement.getAttribute('data-theme');
    var nx = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', nx);
    try { localStorage.setItem('tema', nx); } catch (e) {}
    renderGrid(); renderPanels();
    if (dlg.open) { var a = byId(dlg.getAttribute('data-id')); if (a) drawDetail(a); }
  });

  // Resalta la sección visible en la navegación.
  if ('IntersectionObserver' in window) {
    var links = {};
    $$('.site-nav a').forEach(function (a) { links[a.getAttribute('href').slice(1)] = a; });
    var io = new IntersectionObserver(function (ents) {
      ents.forEach(function (en) {
        if (en.isIntersecting) { Object.keys(links).forEach(function (k) { links[k].removeAttribute('aria-current'); }); if (links[en.target.id]) links[en.target.id].setAttribute('aria-current', 'true'); }
      });
    }, { rootMargin: '-35% 0px -60% 0px' });
    $$('main section').forEach(function (s) { io.observe(s); });
  }

  /* ------------------------------------------------------------ arranque */
  renderHeader(); renderHero(); renderDanelfin();
  renderGrid(); renderPanels(); renderTablaResultados();
  renderIndicadores(); renderMetodologia(); renderPie();
})();
