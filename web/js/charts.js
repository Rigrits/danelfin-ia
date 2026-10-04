/* Gráficos (Chart.js local). Los colores salen de las variables CSS para que sigan al tema. */
(function () {
  'use strict';

  /* ---------------------------------------------------------------- formato */
  var MINUS = '−';
  function num(v, d) {
    return v.toLocaleString('es-AR', { minimumFractionDigits: d, maximumFractionDigits: d }).replace('-', MINUS);
  }
  var Fmt = {
    n2: function (v) { return v == null ? '—' : num(v, 2); },
    n1: function (v) { return v == null ? '—' : num(v, 1); },
    pct: function (v, d) {
      if (v == null) return '—';
      d = d == null ? 1 : d;
      var s = num(v * 100, d);
      return (v > 0 && s.charAt(0) !== MINUS ? '+' : '') + s + '%';
    },
    date: function (iso) { var p = iso.split('-'); return p[2] + '/' + p[1] + '/' + p[0]; },
    dm: function (iso) { var p = iso.split('-'); return p[2] + '/' + p[1]; }
  };

  function theme() {
    var s = getComputedStyle(document.documentElement);
    var g = function (n) { return s.getPropertyValue(n).trim(); };
    return { real: g('--real'), hold: g('--hold'), spy: g('--spy'), gain: g('--gain'), loss: g('--loss'),
      ink: g('--ink'), ink2: g('--ink-2'), ink3: g('--ink-3'), line: g('--line'), line2: g('--line-2'), surface: g('--surface') };
  }
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var anim = reduce ? false : { duration: 250 };

  /* ---------------------------------------------------------------- plugins */
  // Sombrea la zona por debajo del stop loss y por encima del take profit.
  var bands = {
    id: 'bands',
    beforeDatasetsDraw: function (chart, args, o) {
      if (!o || o.sl == null) return;
      var y = chart.scales.y, a = chart.chartArea, c = chart.ctx;
      c.save();
      var ySL = y.getPixelForValue(o.sl);
      c.fillStyle = o.lossBg;
      c.fillRect(a.left, Math.max(a.top, Math.min(ySL, a.bottom)), a.right - a.left, a.bottom - Math.max(a.top, Math.min(ySL, a.bottom)));
      if (o.tp != null && o.tp <= y.max) {
        var yTP = y.getPixelForValue(o.tp);
        c.fillStyle = o.gainBg;
        c.fillRect(a.left, a.top, a.right - a.left, Math.max(0, Math.min(yTP, a.bottom) - a.top));
      }
      c.restore();
    }
  };

  // Etiquetas directas al borde derecho (sin depender de la leyenda).
  var lineLabels = {
    id: 'lineLabels',
    afterDatasetsDraw: function (chart, args, o) {
      if (!o || !o.items) return;
      var y = chart.scales.y, a = chart.chartArea, c = chart.ctx;
      c.save();
      c.font = '700 12px "Atkinson Hyperlegible", system-ui, sans-serif';
      c.textAlign = 'right';
      o.items.forEach(function (it) {
        var py = it.pos != null ? it.pos : y.getPixelForValue(it.value);
        if (py < a.top - 2 || py > a.bottom + 2) return;
        var w = c.measureText(it.text).width + 8;
        c.fillStyle = o.bg;
        c.globalAlpha = .85;
        c.fillRect(a.right - w - 2, py - (it.below ? -3 : 17), w, 15);
        c.globalAlpha = 1;
        c.fillStyle = it.color;
        c.fillText(it.text, a.right - 6, py - (it.below ? -15 : 5));
      });
      c.restore();
    }
  };

  // Valor numérico en la punta de cada barra (para el gráfico de alpha).
  var valueLabels = {
    id: 'valueLabels',
    afterDatasetsDraw: function (chart, args, o) {
      if (!o) return;
      var c = chart.ctx;
      c.save();
      c.font = '700 12px "Atkinson Hyperlegible", system-ui, sans-serif';
      c.textAlign = 'center';
      chart.getDatasetMeta(0).data.forEach(function (bar, i) {
        var v = chart.data.datasets[0].data[i];
        if (v == null) return;
        c.fillStyle = o.color;
        c.fillText(Fmt.pct(v, 1), bar.x, v >= 0 ? bar.y - 6 : bar.y + 15);
      });
      c.restore();
    }
  };

  /* ---------------------------------------------------------------- utilidades */
  function constLine(n, v, color, dash, width) {
    var arr = []; for (var i = 0; i < n; i++) arr.push(v);
    return { data: arr, borderColor: color, borderDash: dash, borderWidth: width || 1.5, pointRadius: 0, fill: false, order: 5 };
  }
  function exitIndex(a) {
    if (!a.salida) return -1;
    for (var i = 0; i < a.serie.length; i++) if (a.serie[i].d === a.salida.fecha) return i;
    return -1;
  }
  function exitMarker(a, n, idx, t) {
    var arr = []; for (var i = 0; i < n; i++) arr.push(null);
    if (idx >= 0) arr[idx] = a.salida.precio;
    var col = a.salida && a.salida.motivo === 'TP' ? t.gain : t.loss;
    return { data: arr, borderColor: col, backgroundColor: col, pointStyle: 'crossRot', pointRadius: 8, pointBorderWidth: 3,
      showLine: false, order: 0 };
  }
  function nice(lo, hi) {
    var raw = (hi - lo) / 6, mag = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / mag;
    var step = (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * mag;
    return { min: Math.floor(lo / step) * step, max: Math.ceil(hi / step) * step, step: step };
  }
  function pctAxis(t) {
    return { ticks: { color: t.ink3, callback: function (v) { return Fmt.pct(v, 0); } }, grid: { color: t.line }, border: { display: false } };
  }
  function base(t) {
    return { responsive: true, maintainAspectRatio: false, animation: anim, color: t.ink2,
      font: { family: '"Atkinson Hyperlegible", system-ui, sans-serif', size: 12 } };
  }

  /* ---------------------------------------------------------------- ficha (mini) */
  function mini(canvas, a) {
    var t = theme(), s = a.serie;
    if (!s.length) return null;
    var n = s.length, labels = s.map(function (x) { return x.d; }), close = s.map(function (x) { return x.c; });
    var lo = Math.min.apply(null, close.concat([a.sl])), hi = Math.max.apply(null, close.concat([a.entrada]));
    var pad = (hi - lo) * 0.12 || 1;
    var tpNear = a.tp <= hi + (hi - lo) * 0.6;
    var ymin = lo - pad, ymax = (tpNear ? Math.max(hi, a.tp) : hi) + pad;
    var idx = exitIndex(a);
    var datasets = [
      { data: close, borderColor: t.real, borderWidth: 2.2, pointRadius: 0, tension: 0.1, order: 2,
        segment: idx >= 0 ? { borderColor: function (c) { return c.p0DataIndex >= idx ? t.ink3 : t.real; },
          borderDash: function (c) { return c.p0DataIndex >= idx ? [4, 3] : undefined; } } : undefined },
      constLine(n, a.entrada, t.ink3, [2, 3], 1.2),
      constLine(n, a.sl, t.loss, [5, 3], 1.5)
    ];
    if (tpNear) datasets.push(constLine(n, a.tp, t.gain, [5, 3], 1.5));
    datasets.push(exitMarker(a, n, idx, t));
    var o = base(t);
    o.events = [];
    o.plugins = { legend: { display: false }, tooltip: { enabled: false },
      bands: { sl: a.sl, tp: tpNear ? a.tp : null,
        lossBg: t.loss + '1F', gainBg: t.gain + '1F' } };
    o.scales = { x: { display: false }, y: { display: false, min: ymin, max: ymax } };
    o.animation = false;
    return new Chart(canvas, { type: 'line', data: { labels: labels, datasets: datasets }, options: o, plugins: [bands] });
  }

  /* ---------------------------------------------------------------- detalle */
  function detalle(canvas, a) {
    var t = theme(), s = a.serie, n = s.length;
    var labels = s.map(function (x) { return x.d; });
    var close = s.map(function (x) { return x.c; });
    var low = s.map(function (x) { return x.l; }), high = s.map(function (x) { return x.h; });
    var idx = exitIndex(a);
    var lo = Math.min.apply(null, low.concat([a.sl])), hi = Math.max.apply(null, high.concat([a.tp]));
    var ax = nice(lo, hi);
    var datasets = [
      { label: 'Mín. diario', data: low, borderColor: 'transparent', pointRadius: 0, fill: false, order: 4 },
      { label: 'Rango diario (mín.–máx.)', data: high, borderColor: 'transparent', pointRadius: 0, fill: '-1',
        backgroundColor: t.real + '2E', order: 4 },
      { label: 'Cierre', data: close, borderColor: t.real, borderWidth: 2.6, pointRadius: 0, pointHoverRadius: 4, tension: 0.08, order: 2,
        segment: idx >= 0 ? { borderColor: function (c) { return c.p0DataIndex >= idx ? t.ink3 : t.real; },
          borderDash: function (c) { return c.p0DataIndex >= idx ? [5, 4] : undefined; } } : undefined },
      Object.assign(constLine(n, a.entrada, t.ink3, [2, 3], 1.5), { label: 'Entrada' }),
      Object.assign(constLine(n, a.sl, t.loss, [6, 4], 2), { label: 'Stop loss' }),
      Object.assign(constLine(n, a.tp, t.gain, [6, 4], 2), { label: 'Take profit' }),
      Object.assign(exitMarker(a, n, idx, t), { label: 'Salida' })
    ];
    var o = base(t);
    o.interaction = { mode: 'index', intersect: false };
    o.plugins = {
      legend: { display: false },
      tooltip: {
        filter: function (it) { return it.datasetIndex === 2; },
        callbacks: {
          title: function (items) { return Fmt.date(items[0].label); },
          label: function (it) { return 'Cierre ' + Fmt.n2(it.parsed.y); },
          afterLabel: function (it) { var q = s[it.dataIndex]; return 'Apertura ' + Fmt.n2(q.o) + ' · Máx ' + Fmt.n2(q.h) + ' · Mín ' + Fmt.n2(q.l); }
        }
      },
      bands: { sl: a.sl, tp: a.tp, lossBg: t.loss + '1A', gainBg: t.gain + '1A' },
      lineLabels: { bg: t.surface, items: [
        { value: a.tp, text: 'Take profit ' + Fmt.n2(a.tp), color: t.gain },
        { value: a.entrada, text: 'Entrada ' + Fmt.n2(a.entrada), color: t.ink2 },
        { value: a.sl, text: 'Stop loss ' + Fmt.n2(a.sl), color: t.loss, below: true }
      ] }
    };
    o.scales = {
      x: { ticks: { color: t.ink3, maxTicksLimit: 8, callback: function (v) { return Fmt.dm(this.getLabelForValue(v)); } }, grid: { display: false } },
      y: { min: ax.min, max: ax.max, ticks: { color: t.ink3, stepSize: ax.step, callback: function (v) { return Fmt.n2(v); } }, grid: { color: t.line }, border: { display: false } }
    };
    return new Chart(canvas, { type: 'line', data: { labels: labels, datasets: datasets }, options: o, plugins: [bands, lineLabels] });
  }

  /* ---------------------------------------------------------------- barras real vs hold */
  function barras(canvas, list) {
    var t = theme();
    var o = base(t);
    o.plugins = { legend: { display: false },
      tooltip: { callbacks: { label: function (it) { return it.dataset.label + ': ' + Fmt.pct(it.parsed.y, 1); } } } };
    o.scales = { x: { ticks: { color: t.ink2 }, grid: { display: false } }, y: pctAxis(t) };
    return new Chart(canvas, { type: 'bar', data: {
      labels: list.map(function (a) { return a.ticker; }),
      datasets: [
        { label: 'Real', data: list.map(function (a) { return a.real; }), backgroundColor: t.real, borderRadius: 3, borderSkipped: false },
        { label: 'Hold', data: list.map(function (a) { return a.hold; }), backgroundColor: t.hold, borderRadius: 3, borderSkipped: false }
      ] }, options: o });
  }

  /* ---------------------------------------------------------------- evolución semanal promedio */
  function semanal(canvas, D) {
    var t = theme(), fr = D.viernes, real = [], hold = [], spy = [], cnt = [];
    fr.forEach(function (f) {
      var r = [], h = [], s = [];
      D.acciones.forEach(function (a) {
        a.viernes.forEach(function (v) { if (v.f === f) { r.push(v.real); h.push(v.hold); s.push(v.spy); } });
      });
      var m = function (x) { return x.length ? x.reduce(function (p, c) { return p + c; }, 0) / x.length : null; };
      real.push(m(r)); hold.push(m(h)); spy.push(m(s)); cnt.push(r.length);
    });
    var o = base(t);
    o.interaction = { mode: 'index', intersect: false };
    o.plugins = { legend: { display: false },
      tooltip: { callbacks: {
        title: function (items) { return 'Viernes ' + Fmt.date(items[0].label); },
        label: function (it) { return it.dataset.label + ': ' + Fmt.pct(it.parsed.y, 1); },
        afterBody: function (items) { return cnt[items[0].dataIndex] + ' posiciones activas'; } } },
      lineLabels: { bg: t.surface, items: [] } };
    o.scales = { x: { ticks: { color: t.ink3, callback: function (v) { return Fmt.dm(this.getLabelForValue(v)); } }, grid: { display: false } }, y: pctAxis(t) };
    return new Chart(canvas, { type: 'line', data: { labels: fr, datasets: [
      { label: 'Real', data: real, borderColor: t.real, backgroundColor: t.real, borderWidth: 3, pointRadius: 4, pointHoverRadius: 6, tension: .1 },
      { label: 'Hold', data: hold, borderColor: t.hold, backgroundColor: t.hold, borderWidth: 3, borderDash: [8, 5], pointRadius: 4, pointStyle: 'rectRot', pointHoverRadius: 6, tension: .1 },
      { label: 'S&P 500 (SPY)', data: spy, borderColor: t.spy, backgroundColor: t.spy, borderWidth: 2.4, borderDash: [2, 4], pointRadius: 3, pointStyle: 'triangle', tension: .1 }
    ] }, options: o });
  }

  /* ---------------------------------------------------------------- alpha vs SPY */
  function alpha(canvas, list) {
    var t = theme();
    var o = base(t);
    o.layout = { padding: { top: 20, bottom: 14 } };
    o.plugins = { legend: { display: false }, valueLabels: { color: t.ink },
      tooltip: { callbacks: { label: function (it) { return 'Alpha: ' + Fmt.pct(it.parsed.y, 1); } } } };
    o.scales = { x: { ticks: { color: t.ink2 }, grid: { display: false }, border: { color: t.line2 } }, y: pctAxis(t) };
    var vals = list.map(function (a) { return a.alphaReal; });
    return new Chart(canvas, { type: 'bar', data: { labels: list.map(function (a) { return a.ticker; }), datasets: [
      { label: 'Alpha real', data: vals, borderRadius: 3, borderSkipped: false,
        backgroundColor: vals.map(function (v) { return v >= 0 ? t.gain : t.loss; }) } ] },
      options: o, plugins: [valueLabels] });
  }

  window.Fmt = Fmt;
  window.Charts = { mini: mini, detalle: detalle, barras: barras, semanal: semanal, alpha: alpha };
})();
