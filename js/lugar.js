/* ------------------------------------------------------------------
   La Casa de Tanes · lugar.js · «El espejo de Tanes»
   window.Tanes.lugar.montar(el, { movimiento, densidad, webgl }) → { destruir() }

   Un vuelo en 3D que se mueve con el scroll: la cámara sale de encima
   de las peñas del otro lado del embalse, baja por la ladera y acaba
   rozando el agua frente a la casona, que refleja las montañas.
   - Relieve MDT05/MDT25 y ortofoto PNOA del IGN (CC BY 4.0), la casona
     sobre su planta del Catastro (Tanes 9) y el pueblo con sus edificios
     del Catastro, nombres de OpenStreetMap (scripts/lugar-datos.py).
   - Reflejo plano: la escena vista desde la cámara espejada bajo la lámina
     se pinta a media resolución en una textura (una pasada más, sin
     técnicas caras) y el agua la lee con un rizado suave y Fresnel.
   - El sol, la luna y la luz de este momento en Tanes (cálculo local,
     fórmulas de SunCalc). De noche, ventanas y galería encendidas.
   - Three.js 0.160.0, copia propia en vendor/, pedido con import() solo
     cuando hace falta.
   - Plan B en el mismo hueco (sin WebGL, movimiento reducido, «sobria»,
     ahorro de datos, móvil antes de pulsar el botón, Playwright): la vista
     desde el agua dibujada con los mismos datos y el reflejo, más el
     pueblo desde el aire con la casa marcada.
   El HTML que trae `el` es el respaldo: se guarda y se repone al destruir.
   Parámetros: ?fps (fotogramas), ?sin-webgl (plan B), ?lugar=3d (fuerza
   el 3D aunque el navegador sea automatizado), ?hora=HH:MM (prueba el
   cielo a otra hora de hoy en Tanes).
   ------------------------------------------------------------------ */
(function () {
  'use strict';
  var T = (window.Tanes = window.Tanes || {});
  if (T.lugar && T.lugar.montar) return;

  var SCRIPT = (typeof document !== 'undefined' && document.currentScript && document.currentScript.src) || '';
  var RAIZ = SCRIPT ? new URL('../', SCRIPT).href : (typeof location !== 'undefined' ? new URL('./', location.href).href : './');
  var BASE = RAIZ + 'img/lugar/';
  var THREE_URL = RAIZ + 'vendor/three-0.160.0.module.min.js';
  var LAT = 43.205389, LON = -5.399521, TZ = 'Europe/Madrid', RAD = Math.PI / 180;

  /* ============ utilidades ============ */
  var lim = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var suave = function (a, b, x) { var t = lim((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  var pad = function (n) { return String(n).padStart(2, '0'); };
  var hexA = function (c) { return [1, 3, 5].map(function (i) { return parseInt(c.slice(i, i + 2), 16); }); };
  var mezcla = function (a, b, t) { var x = hexA(a), y = hexA(b); return '#' + x.map(function (v, i) { return pad(Math.round(lim(lerp(v, y[i], t), 0, 255)).toString(16)); }).join(''); };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var RUMBOS = ['norte', 'noreste', 'este', 'sureste', 'sur', 'suroeste', 'oeste', 'noroeste'];
  var rumbo = function (az) { return RUMBOS[Math.round((((az % 360) + 360) % 360) / 45) % 8]; };
  var hash = function (s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967295; };

  /* ============ el sol y la luna (fórmulas de SunCalc, V. Agafonkin) ============ */
  var J1970 = 2440588, J2000 = 2451545, OBL = RAD * 23.4397;
  var dias = function (f) { return f.valueOf() / 864e5 - 0.5 + J1970 - J2000; };
  var ascRec = function (l, b) { return Math.atan2(Math.sin(l) * Math.cos(OBL) - Math.tan(b) * Math.sin(OBL), Math.cos(l)); };
  var declin = function (l, b) { return Math.asin(Math.sin(b) * Math.cos(OBL) + Math.cos(b) * Math.sin(OBL) * Math.sin(l)); };
  var sideral = function (d) { return RAD * (280.16 + 360.9856235 * d) - RAD * -LON; };
  function altAz(H, dec) {
    var phi = RAD * LAT;
    return {
      alt: Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H)) / RAD,
      az: (Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi)) / RAD + 180 + 360) % 360, // desde el norte, hacia el este
    };
  }
  function solCoords(d) {
    var M = RAD * (357.5291 + 0.98560028 * d);
    var L = M + RAD * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M)) + RAD * 102.9372 + Math.PI;
    return { dec: declin(L, 0), ra: ascRec(L, 0) };
  }
  function lunaCoords(d) {
    var L = RAD * (218.316 + 13.176396 * d), M = RAD * (134.963 + 13.064993 * d), F = RAD * (93.272 + 13.22935 * d);
    var l = L + RAD * 6.289 * Math.sin(M), b = RAD * 5.128 * Math.sin(F);
    return { ra: ascRec(l, b), dec: declin(l, b), dist: 385001 - 20905 * Math.cos(M) };
  }
  function sol(f) { var d = dias(f), c = solCoords(d); return altAz(sideral(d) - c.ra, c.dec); }
  function luna(f) {
    var d = dias(f), m = lunaCoords(d), s = solCoords(d), p = altAz(sideral(d) - m.ra, m.dec);
    var phi = Math.acos(Math.sin(s.dec) * Math.sin(m.dec) + Math.cos(s.dec) * Math.cos(m.dec) * Math.cos(s.ra - m.ra));
    var inc = Math.atan2(149598000 * Math.sin(phi), m.dist - 149598000 * Math.cos(phi));
    var ang = Math.atan2(Math.cos(s.dec) * Math.sin(s.ra - m.ra), Math.sin(s.dec) * Math.cos(m.dec) - Math.cos(s.dec) * Math.sin(m.dec) * Math.cos(s.ra - m.ra));
    return { alt: p.alt, az: p.az, luz: (1 + Math.cos(inc)) / 2, fase: 0.5 + 0.5 * inc * (ang < 0 ? -1 : 1) / Math.PI };
  }
  function nombreFase(f) {
    if (f < 0.03 || f >= 0.97) return 'nueva';
    if (f < 0.22) return 'creciente';
    if (f < 0.28) return 'en cuarto creciente';
    if (f < 0.47) return 'gibosa creciente';
    if (f < 0.53) return 'llena';
    if (f < 0.72) return 'gibosa menguante';
    if (f < 0.78) return 'en cuarto menguante';
    return 'menguante';
  }
  var fmtHora = null;
  function horaTanes(f) {
    try {
      fmtHora = fmtHora || new Intl.DateTimeFormat('es-ES', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
      return fmtHora.format(f);
    } catch (e) { return pad(f.getHours()) + ':' + pad(f.getMinutes()); }
  }
  // ?hora=HH:MM: el cielo de hoy a esa hora de Tanes (solo para mirar la noche o el atardecer sin esperar)
  var desfase = 0;
  (function () {
    try {
      var h = new URLSearchParams(location.search).get('hora');
      var m = h && /^(\d{1,2}):(\d{2})$/.exec(h);
      if (!m) return;
      var ahora = new Date(), partes = horaTanes(ahora).split(':');
      desfase = ((+m[1] * 60 + +m[2]) - (+partes[0] * 60 + +partes[1])) * 60000;
    } catch (e) { desfase = 0; }
  })();
  var ahoraMismo = function () { return new Date(Date.now() + desfase); };
  // la frase del cielo de ahora (se dice igual en el 3D y en el plano)
  function fraseCielo(f) {
    var s = sol(f), l = luna(f), h = horaTanes(f);
    if (s.alt > 0) return 'Ahora en Tanes son las ' + h + ' y el sol está a ' + Math.round(s.alt) + '° sobre el horizonte, al ' + rumbo(s.az) + '.';
    if (s.alt > -6) return 'Ahora en Tanes son las ' + h + ': ' + (s.az < 180 ? 'está amaneciendo' : 'está anocheciendo') + '.';
    var txt = 'Ahora en Tanes son las ' + h + ' y es de noche';
    if (l.alt > 0 && l.luz > 0.03) txt += '; la luna, ' + nombreFase(l.fase) + ', está a ' + Math.round(l.alt) + '° al ' + rumbo(l.az);
    return txt + '. En la casa hay luz en las ventanas.';
  }

  /* ============ el color del cielo según la altura del sol ============ */
  var CIELO = [            // [altura del sol, cenit, horizonte]
    [-18, '#04070f', '#0b1120'],
    [-10, '#081028', '#1c2442'],
    [-4, '#1a2752', '#74515e'],
    [0, '#34508c', '#de8a66'],
    [6, '#5279b8', '#eebf98'],
    [18, '#6893cc', '#d7e1e6'],
    [45, '#4c82c4', '#cbdbe6'],
  ];
  function cieloPara(alt) {
    if (alt <= CIELO[0][0]) return { cz: CIELO[0][1], ch: CIELO[0][2] };
    for (var i = 1; i < CIELO.length; i++) {
      if (alt <= CIELO[i][0]) {
        var a = CIELO[i - 1], b = CIELO[i], t = (alt - a[0]) / (b[0] - a[0]);
        return { cz: mezcla(a[1], b[1], t), ch: mezcla(a[2], b[2], t) };
      }
    }
    var u = CIELO[CIELO.length - 1];
    return { cz: u[1], ch: u[2] };
  }

  /* ============ el recorrido: interpolación monótona por componente ============ */
  // Hermite con tangentes de Fritsch-Butland: no se pasa de largo (ni baja por debajo del agua) aunque
  // los tramos sean de kilómetros al principio y de metros al final. Empieza y acaba en reposo.
  function monotona(ps, vs) {
    var n = ps.length, d = [], m = [], i;
    for (i = 0; i < n - 1; i++) d[i] = (vs[i + 1] - vs[i]) / (ps[i + 1] - ps[i]);
    m[0] = 0; m[n - 1] = 0;
    for (i = 1; i < n - 1; i++) {
      if (d[i - 1] * d[i] <= 0) { m[i] = 0; continue; }
      var h0 = ps[i] - ps[i - 1], h1 = ps[i + 1] - ps[i];
      m[i] = 3 * (h0 + h1) / ((2 * h1 + h0) / d[i - 1] + (h1 + 2 * h0) / d[i]);
    }
    return function (p) {
      if (p <= ps[0]) return vs[0];
      if (p >= ps[n - 1]) return vs[n - 1];
      var k = 0; while (k < n - 2 && p > ps[k + 1]) k++;
      var h = ps[k + 1] - ps[k], t = (p - ps[k]) / h, t2 = t * t, t3 = t2 * t;
      return (2 * t3 - 3 * t2 + 1) * vs[k] + (t3 - 2 * t2 + t) * h * m[k] + (-2 * t3 + 3 * t2) * vs[k + 1] + (t3 - t2) * h * m[k + 1];
    };
  }
  function camino(rec) {
    var ps = rec.map(function (r) { return r.p; });
    var f = [0, 1, 2].map(function (k) { return monotona(ps, rec.map(function (r) { return r.pos[k]; })); });
    var g = [0, 1, 2].map(function (k) { return monotona(ps, rec.map(function (r) { return r.mira[k]; })); });
    return function (p) { return { pos: [f[0](p), f[1](p), f[2](p)], mira: [g[0](p), g[1](p), g[2](p)] }; };
  }

  /* ============ alturas: PNG RGB → metros ============ */
  function cargarAlturas(url) {
    return fetch(url).then(function (r) { if (!r.ok) throw new Error('alturas ' + r.status); return r.blob(); })
      .then(function (b) {
        var op = { colorSpaceConversion: 'none', premultiplyAlpha: 'none' };
        return (window.createImageBitmap ? createImageBitmap(b, op).catch(function () { return createImageBitmap(b); }) : Promise.reject(new Error('sin createImageBitmap')));
      })
      .then(function (bmp) {
        var c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
        var g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(bmp, 0, 0);
        var d = g.getImageData(0, 0, c.width, c.height).data, n = c.width * c.height, out = new Float32Array(n);
        for (var i = 0; i < n; i++) out[i] = (d[i * 4] * 256 + d[i * 4 + 1]) / 10 - 100;
        if (bmp.close) bmp.close();
        return { w: c.width, h: c.height, data: out };
      });
  }
  function muestreador(r) {
    var sx = (r.w - 1) / (r.x1 - r.x0), sz = (r.h - 1) / (r.z1 - r.z0), w = r.w, h = r.h, a = r.data;
    return function (x, z) {
      var fx = lim((x - r.x0) * sx, 0, w - 1.0001), fz = lim((z - r.z0) * sz, 0, h - 1.0001);
      var i = fx | 0, j = fz | 0, u = fx - i, v = fz - j, k = j * w + i;
      return (a[k] * (1 - u) + a[k + 1] * u) * (1 - v) + (a[k + w] * (1 - u) + a[k + w + 1] * u) * v;
    };
  }
  function pesoCaja(r, x, z, b) {             // 0..1 «dentro de la caja», con un borde de transición de b metros
    var d = Math.min(x - r.x0, r.x1 - x, z - r.z0, r.z1 - z);
    return lim(d / b, 0, 1);
  }

  /* ============ texturas dibujadas (ligeras) ============ */
  function azar(semilla) { var s = semilla >>> 0 || 1; return function () { s = (s * 16807) % 2147483647; return s / 2147483647; }; }
  function lienzo(w, h, pintar) { var c = document.createElement('canvas'); c.width = w; c.height = h || w; pintar(c.getContext('2d'), w, h || w); return c; }
  function texPiedra(base, semilla) {       // mampostería de arenisca: hiladas irregulares con llaga
    return lienzo(512, 512, function (g, L) {
      var r = azar(semilla);
      g.fillStyle = mezcla(base, '#5b4a36', 0.45); g.fillRect(0, 0, L, L);
      var y = 0;
      while (y < L) {
        var hh = 18 + r() * 22, x = -r() * 40;
        while (x < L) {
          var ww = 30 + r() * 64, t = r();
          g.fillStyle = mezcla(mezcla(base, t < 0.4 ? '#8c6a44' : t < 0.75 ? '#e2c592' : '#a08f78', 0.25 + r() * 0.45), '#000000', r() * 0.14);
          g.fillRect(x + 1.5, y + 1.5, ww - 3, hh - 3);
          x += ww;
        }
        y += hh;
      }
      var im = g.getImageData(0, 0, L, L), d = im.data;
      for (var i = 0; i < d.length; i += 4) { var n = (r() - 0.5) * 16; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
      g.putImageData(im, 0, 0);
    });
  }
  function texSillar(base, semilla) {       // esquinas de sillería: bloques grandes alternos
    return lienzo(128, 256, function (g, W, H) {
      var r = azar(semilla);
      g.fillStyle = mezcla(base, '#5b4a36', 0.5); g.fillRect(0, 0, W, H);
      for (var j = 0; j < 4; j++) {
        var y = j * H / 4, w = j % 2 ? W * 0.62 : W;
        g.fillStyle = mezcla(base, r() < 0.5 ? '#efd8a8' : '#b89566', r() * 0.35);
        g.fillRect(2, y + 2, w - 4, H / 4 - 4);
        if (j % 2) { g.fillStyle = mezcla(base, '#a88a60', 0.3); g.fillRect(w + 2, y + 2, W - w - 4, H / 4 - 4); }
      }
    });
  }
  function texRevoco(base, semilla) {
    return lienzo(256, 256, function (g, L) {
      var r = azar(semilla); g.fillStyle = base; g.fillRect(0, 0, L, L);
      var im = g.getImageData(0, 0, L, L), d = im.data;
      for (var i = 0; i < d.length; i += 4) { var n = (r() - 0.5) * 14; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
      g.putImageData(im, 0, 0);
      for (var k = 0; k < 40; k++) { g.fillStyle = 'rgba(0,0,0,' + (r() * 0.05).toFixed(3) + ')'; g.fillRect(r() * L, r() * L, 10 + r() * 40, 2 + r() * 30); }
    });
  }
  function texTeja(base, semilla) {          // teja árabe: hileras de canales con sombra
    return lienzo(256, 256, function (g, L) {
      var r = azar(semilla), filas = 8, cols = 10, fh = L / filas, cw = L / cols;
      g.fillStyle = mezcla(base, '#000000', 0.35); g.fillRect(0, 0, L, L);
      for (var j = 0; j < filas; j++) {
        for (var i = 0; i < cols; i++) {
          var x = i * cw, y = j * fh, c = mezcla(mezcla(base, r() < 0.5 ? '#5e3a2a' : '#c98a62', r() * 0.45), '#3a3a30', r() * 0.18);
          var gr = g.createLinearGradient(x, 0, x + cw, 0);
          gr.addColorStop(0, mezcla(c, '#000000', 0.45)); gr.addColorStop(0.45, mezcla(c, '#ffffff', 0.1)); gr.addColorStop(1, mezcla(c, '#000000', 0.5));
          g.fillStyle = gr; g.fillRect(x + 1, y, cw - 2, fh + 3);
          g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x + 1, y + fh - 3, cw - 2, 3);
        }
      }
    });
  }
  function texTablas(base, semilla, horizontal) {   // tablas de castaño (la galería)
    return lienzo(256, 256, function (g, L) {
      var r = azar(semilla), p = 0;
      while (p < L) {
        var w = 18 + r() * 10, c = mezcla(base, r() < 0.5 ? '#2e1d12' : '#7a5236', r() * 0.4);
        g.fillStyle = c; if (horizontal) g.fillRect(0, p, L, w); else g.fillRect(p, 0, w, L);
        for (var k = 0; k < 10; k++) { g.fillStyle = 'rgba(0,0,0,' + (0.05 + r() * 0.1).toFixed(2) + ')'; if (horizontal) g.fillRect(0, p + r() * w, L, 1); else g.fillRect(p + r() * w, 0, 1, L); }
        g.fillStyle = 'rgba(0,0,0,.55)'; if (horizontal) g.fillRect(0, p + w - 2, L, 2); else g.fillRect(p + w - 2, 0, 2, L);
        p += w;
      }
    });
  }

  /* ============ módulo ============ */
  function montar(el, opciones) {
    opciones = opciones || {};
    var q = new URLSearchParams(location.search);
    var reduce = opciones.movimiento === false || matchMedia('(prefers-reduced-motion: reduce)').matches;
    var sobria = opciones.densidad === 'sobria';
    var movil = matchMedia('(max-width: 820px)').matches || matchMedia('(pointer: coarse)').matches;
    var ahorro = !!(navigator.connection && navigator.connection.saveData);
    var forzar3d = q.get('lugar') === '3d';
    var automatizado = !!navigator.webdriver && !forzar3d;                           // Playwright: nunca pinta el 3D
    var sinWebgl = opciones.webgl === false || q.has('sin-webgl') || automatizado;
    if (!sinWebgl && !sobria && !reduce && !forzar3d) {
      try { var cv0 = document.createElement('canvas'); sinWebgl = !(cv0.getContext('webgl2') || cv0.getContext('webgl')); } catch (e) { sinWebgl = true; }
    }
    var puede3d = !sinWebgl && !sobria && !reduce;
    var auto3d = puede3d && !movil && !ahorro;
    var respaldo = el.innerHTML;
    var estado = { modo: 'plano', destruido: false, error3d: null, cargado: false, p: 0, pVis: 0, calidad: 0 };
    var escuchas = [];
    var escucha = function (o, ev, fn, op) { o.addEventListener(ev, fn, op); escuchas.push(function () { o.removeEventListener(ev, fn, op); }); };
    var t3 = null, meta = null, cargando = null, intervalo = 0;

    /* ---------- DOM ---------- */
    el.classList.add('lugar');
    el.innerHTML =
      '<div class="lugar__pista">' +
        '<div class="lugar__escenario" role="img" aria-label="Vuelo en 3D desde las peñas de Redes hasta el embalse de Tanes, que refleja las montañas, frente a La Casa; con el relieve real y la luz de este momento">' +
          '<img class="lugar__poster" alt="" decoding="async" src="' + BASE + 'vista-penas-1600.webp" srcset="' + BASE + 'vista-penas-960.webp 960w, ' + BASE + 'vista-penas-1600.webp 1600w" sizes="100vw">' +
          '<div class="lugar__rotulos" aria-hidden="true"></div>' +
          '<ol class="lugar__paradas"></ol>' +
          '<div class="lugar__pie3d"><p class="lugar__ahora" data-l="ahora3d"></p>' +
          '<button type="button" class="lugar__btn lugar__btn--suave" data-l="aplano">Ver en plano</button></div>' +
          '<p class="lugar__aviso" data-l="aviso" role="status" hidden></p>' +
        '</div>' +
      '</div>' +
      '<div class="lugar__planob">' +
        '<figure class="lugar__vista">' +
          '<div class="lugar__marco"><img alt="El embalse de Tanes visto desde el agua: las montañas se reflejan en la lámina y, en la orilla, el pueblo de Tanes con La Casa" decoding="async" loading="lazy" src="' + BASE + 'vista-espejo-960.webp" srcset="' + BASE + 'vista-espejo-960.webp 960w, ' + BASE + 'vista-espejo-1600.webp 1600w" sizes="(max-width: 820px) 100vw, 66vw">' +
          '<i class="lugar__noche" aria-hidden="true"></i><ul class="lugar__marcas" aria-hidden="true"></ul></div>' +
          '<figcaption>Desde el agua: las peñas de Redes repetidas en el embalse y, en la orilla, Tanes. Dibujado con el relieve y la ortofoto del IGN.</figcaption>' +
        '</figure>' +
        '<figure class="lugar__pueblo">' +
          '<div class="lugar__marco lugar__marco--pueblo"><img alt="Tanes desde el aire: las casas del pueblo, la carretera, la orilla del embalse y La Casa marcada" decoding="async" loading="lazy" src="' + BASE + 'plano-pueblo-900.webp" width="900" height="900">' +
          '<i class="lugar__noche" aria-hidden="true"></i><ul class="lugar__marcas lugar__marcas--pueblo" aria-hidden="true"></ul></div>' +
          '<figcaption>Tanes desde el aire (ortofoto PNOA). La casa, sobre su parcela del Catastro.</figcaption>' +
        '</figure>' +
        '<ol class="lugar__pasos"></ol>' +
        '<p class="lugar__ahora" data-l="ahora2d"></p>' +
        '<p class="lugar__acciones"><button type="button" class="lugar__btn" data-l="a3d" hidden>Ver el vuelo en 3D</button></p>' +
      '</div>' +
      '<p class="lugar__fuente" data-l="fuente">Relieve MDT05 y MDT25 y ortofoto PNOA © IGN / CNIG, CC BY 4.0 · Planta de la casa y del pueblo © Dirección General del Catastro · Nombres © colaboradores de OpenStreetMap. Relieve a escala real. El sol y la luna se calculan en tu navegador para Tanes.</p>';
    var $ = function (k) { return el.querySelector('[data-l="' + k + '"]'); };
    var pista = el.querySelector('.lugar__pista'), escenario = el.querySelector('.lugar__escenario');
    var capaRot = el.querySelector('.lugar__rotulos');
    var aviso = $('aviso');
    var avisar = function (t) { aviso.textContent = t || ''; aviso.hidden = !t; };

    /* ---------- paradas (las mismas en el 3D y en el plano) ---------- */
    var PARADAS = [
      { desde: 0, t: 'Las peñas', d: 'Por encima de las peñas de Redes. Abajo, el valle y el embalse de Tanes.' },
      { desde: 0.3, t: 'La ladera', d: 'El monte baja hasta el agua. Enfrente, Tanes, en la orilla.' },
      { desde: 0.6, t: 'El embalse', d: 'Con el agua quieta, el embalse repite las montañas.' },
      { desde: 0.86, t: 'La Casa', d: 'La casona de piedra, con su galería de madera mirando al agua.' },
    ];
    var htmlParadas = PARADAS.map(function (p, i) { return '<li data-i="' + i + '"><b>' + esc(p.t) + '</b><span>' + esc(p.d) + '</span></li>'; }).join('');
    el.querySelector('.lugar__paradas').innerHTML = htmlParadas;
    el.querySelector('.lugar__pasos').innerHTML = htmlParadas;
    var lisParadas = el.querySelectorAll('.lugar__paradas li');
    var paradaActual = -1;
    function marcarParada(p) {
      var i = 0; for (var k = 0; k < PARADAS.length; k++) if (p >= PARADAS[k].desde - 0.001) i = k;
      if (i === paradaActual) return;
      paradaActual = i;
      lisParadas.forEach(function (li, k) { li.classList.toggle('es-actual', k === i); li.classList.toggle('es-pasada', k < i); });
    }

    /* ---------- el cielo de ahora, en texto (y la noche en el plano) ---------- */
    function cieloTexto() {
      var f = ahoraMismo(), txt = fraseCielo(f), s = sol(f);
      $('ahora2d').textContent = txt; $('ahora3d').textContent = txt;
      el.style.setProperty('--lugar-noche', String(lim((-s.alt - 1) / 10, 0, 1).toFixed(2)));
      if (t3) t3.luces(f);
    }

    /* ---------- plan B: marcas sobre las dos imágenes ---------- */
    function montarPlano(m) {
      var nombres = {}; m.lugares.forEach(function (l) { nombres[l.clave] = l; });
      var ulV = el.querySelector('.lugar__vista .lugar__marcas');
      ulV.innerHTML = m.planB.vista.marcas.map(function (k) {
        var l = nombres[k.clave]; if (!l) return '';
        return '<li class="lugar__marca' + (k.clave === 'casa' ? ' lugar__marca--casa' : '') + '" data-x="' + k.x + '" data-y="' + k.y + '"><span>' + esc(l.nombre) + (l.sub ? ' <small>' + esc(l.sub) + '</small>' : '') + '</span></li>';
      }).join('');
      var pl = m.planB.plano, x0 = pl.cx - pl.lado / 2, z0 = pl.cz - pl.lado / 2, cs = m.casona.rect;
      el.querySelector('.lugar__marcas--pueblo').innerHTML =
        '<li class="lugar__marca lugar__marca--casa lugar__marca--pueblo" style="left:' + ((cs.cx - x0) / pl.lado * 100).toFixed(2) + '%;top:' + ((cs.cz - z0) / pl.lado * 100).toFixed(2) + '%"><span>La Casa</span></li>';
      colocarMarcas();
    }
    // la vista se recorta con object-fit: cover; las marcas siguen al recorte y se ocultan si quedan fuera
    function colocarMarcas() {
      var marco = el.querySelector('.lugar__vista .lugar__marco'); if (!marco || !meta) return;
      var W = marco.clientWidth, H = marco.clientHeight; if (!W || !H) return;
      var iw = meta.planB.vista.ancho, ih = meta.planB.vista.alto, k = Math.max(W / iw, H / ih);
      var ox = (W - iw * k) / 2, oy = (H - ih * k) * 0.5;
      var lis = [].slice.call(el.querySelectorAll('.lugar__vista .lugar__marca'));
      lis.forEach(function (li) {
        var x = ox + (+li.dataset.x) / 100 * iw * k, y = oy + (+li.dataset.y) / 100 * ih * k;
        li.hidden = x < 12 || x > W - 12 || y < 8 || y > H - 8;
        li.style.left = x.toFixed(1) + 'px'; li.style.top = y.toFixed(1) + 'px';
        li.classList.toggle('a-la-izq', x > W * 0.7);
      });
      var vis = lis.filter(function (li) { return !li.hidden; }).sort(function (a, b) { return parseFloat(a.style.left) - parseFloat(b.style.left); });
      for (var i = 0; i < vis.length; i++) for (var j = i + 1; j < vis.length; j++) {
        var a = vis[i].firstElementChild.getBoundingClientRect(), b = vis[j].firstElementChild.getBoundingClientRect();
        if (a.right > b.left - 6 && a.left < b.right + 6 && a.bottom > b.top - 2 && a.top < b.bottom + 2) vis[i].classList.add('a-la-izq');
      }
    }

    function ponModo(m) {
      estado.modo = m;
      el.dataset.modo = m;
      $('a3d').hidden = !(puede3d && m === 'plano' && !estado.error3d);
      if (t3) t3.activo(m === '3d');
    }

    /* ---------- datos ---------- */
    var pMeta = fetch(BASE + 'lugar.json').then(function (r) { if (!r.ok) throw new Error('lugar.json ' + r.status); return r.json(); })
      .then(function (m) { meta = m; if (!estado.destruido) montarPlano(m); return m; });
    pMeta.catch(function (e) { console.warn('Lugar: sin datos', e); });

    /* ---------- el 3D ---------- */
    function cargar3d() {
      if (t3) return Promise.resolve(t3);
      if (cargando) return cargando;
      avisar('Cargando el relieve…');
      var hiDef = !movil && !ahorro;
      cargando = pMeta.then(function (m) {
        return Promise.all([
          import(THREE_URL),
          cargarAlturas(BASE + m.rasters.cerca.archivo), cargarAlturas(BASE + m.rasters.medio.archivo),
          cargarAlturas(BASE + m.rasters.pueblo.archivo), cargarAlturas(BASE + m.rasters.lejos.archivo),
        ]).then(function (r) {
          if (estado.destruido) return null;
          var R = {};
          ['cerca', 'medio', 'pueblo', 'lejos'].forEach(function (k, i) { var b = r[i + 1], o = m.rasters[k]; R[k] = Object.assign({}, o, { w: b.w, h: b.h, data: b.data }); });
          return crear3d(r[0], m, R, hiDef);
        });
      }).then(function (t) { avisar(''); return t; }, function (e) {
        estado.error3d = String((e && e.message) || e);
        console.warn('Lugar: el 3D no está disponible:', e);
        avisar(''); cargando = null; ponModo('plano');
        return null;
      });
      return cargando;
    }

    function crear3d(THREE, m, R, hiDef) {
      var NIVEL = m.nivel;
      var cv = document.createElement('canvas');
      cv.className = 'lugar__lienzo'; cv.setAttribute('aria-hidden', 'true');
      escenario.insertBefore(cv, capaRot);
      var ren = new THREE.WebGLRenderer({ canvas: cv, antialias: hiDef, powerPreference: 'high-performance', alpha: false, stencil: false });
      var topeDPR = function () { return estado.calidad >= 1 ? 1 : (movil ? 1.25 : 1.5); };
      var escalaReflejo = function () { return estado.calidad >= 2 ? 0.25 : estado.calidad >= 1 ? 0.35 : (hiDef ? 0.5 : 0.4); };
      ren.setPixelRatio(Math.min(devicePixelRatio || 1, topeDPR()));
      ren.outputColorSpace = THREE.SRGBColorSpace;
      ren.shadowMap.enabled = true; ren.shadowMap.type = THREE.PCFSoftShadowMap; ren.shadowMap.autoUpdate = false;
      var anis = Math.min(8, ren.capabilities.getMaxAnisotropy());
      var esc3 = new THREE.Scene();
      var LEJOS = 45000;
      var cam = new THREE.PerspectiveCamera(40, 1.6, 1, LEJOS);
      var disponer = [];
      var guarda = function (o) { disponer.push(o); return o; };

      /* --- alturas combinadas: pueblo 4 m, medio 8 m, cerca 20 m, lejos ~230 m (sin exagerar) --- */
      var hC = muestreador(R.cerca), hM = muestreador(R.medio), hP = muestreador(R.pueblo), hL = muestreador(R.lejos);
      function altura(x, z) {
        var wc = pesoCaja(R.cerca, x, z, 1);
        if (wc <= 0) return hL(x, z);
        var h = hC(x, z);
        var wm = pesoCaja(R.medio, x, z, 80); if (wm > 0) h = lerp(h, hM(x, z), wm);
        var wp = pesoCaja(R.pueblo, x, z, 40); if (wp > 0) h = lerp(h, hP(x, z), wp);
        return h;
      }
      var yDe = altura;

      /* --- materiales del suelo: ortofoto cercana con la del pueblo encima --- */
      var ldr = new THREE.TextureLoader();
      var cargaTex = function (url, alListo) {
        return ldr.load(url, function (t) { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = anis; t.needsUpdate = true; if (alListo) alListo(t); pedir(true); },
          undefined, function () { console.warn('Lugar: no carga', url); });
      };
      var O = m.orto, calidadTex = hiDef ? 'alta' : 'baja';
      var uPueblo = { mapPueblo: { value: null }, puebloCaja: { value: new THREE.Vector4(O.pueblo.x0, O.pueblo.z0, O.pueblo.x1, O.pueblo.z1) }, puebloListo: { value: 0 } };
      var matCerca = guarda(new THREE.MeshLambertMaterial({ color: '#66735a' }));
      matCerca.onBeforeCompile = function (sh) {
        Object.assign(sh.uniforms, uPueblo);
        sh.vertexShader = 'varying vec2 vXZ;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vXZ = position.xz;');
        sh.fragmentShader = 'varying vec2 vXZ;\nuniform sampler2D mapPueblo;\nuniform vec4 puebloCaja;\nuniform float puebloListo;\n' +
          sh.fragmentShader.replace('#include <map_fragment>', [
            '#ifdef USE_MAP',
            '  vec4 texel = texture2D(map, vMapUv);',
            '  vec2 fu = (vXZ - puebloCaja.xy) / (puebloCaja.zw - puebloCaja.xy);',
            '  if (puebloListo > 0.5 && fu.x > 0.0 && fu.x < 1.0 && fu.y > 0.0 && fu.y < 1.0) {',
            '    vec4 tf = texture2D(mapPueblo, vec2(fu.x, 1.0 - fu.y));',
            '    float b = smoothstep(0.0, 0.1, min(min(fu.x, 1.0 - fu.x), min(fu.y, 1.0 - fu.y)));',
            '    texel = mix(texel, tf, b);',
            '  }',
            '  diffuseColor *= texel;',
            '#endif'].join('\n'));
      };
      cargaTex(BASE + O.cerca.archivos[calidadTex], function (t) { matCerca.map = t; matCerca.color.set('#ffffff'); matCerca.needsUpdate = true; });
      cargaTex(BASE + O.pueblo.archivos[calidadTex], function (t) { uPueblo.mapPueblo.value = t; uPueblo.puebloListo.value = 1; });
      var matLejos = guarda(new THREE.MeshLambertMaterial({ color: '#5c6658', polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 2 }));
      cargaTex(BASE + O.lejos.archivos.alta, function (t) { matLejos.map = t; matLejos.color.set('#ffffff'); matLejos.needsUpdate = true; });

      /* --- relieve cercano: rejilla densa en el pueblo y más abierta lejos --- */
      var cs = m.casona, rc = cs.rect;
      var pasos = hiDef ? [4, 10, 24, 60] : [6, 16, 36, 80];
      var pasoEn = function (d) { return d < 300 ? pasos[0] : d < 1000 ? pasos[1] : d < 2600 ? pasos[2] : pasos[3]; };
      function ejes(a0, a1, c) {
        var out = [a0], v = a0;
        while (v < a1 - 0.01) {
          var s = pasoEn(Math.abs(v - c));
          s = pasoEn(Math.min(Math.abs(v - c), Math.abs(v + s - c)));
          v = Math.min(a1, v + s); out.push(v);
        }
        return out;
      }
      var C = R.cerca;
      var xs = ejes(C.x0, C.x1, 0), zs = ejes(C.z0, C.z1, 0);
      function rejilla(xs, zs, yFn, uvCaja, hueco, faldon) {
        var nx = xs.length, nz = zs.length, n = nx * nz;
        var nF = faldon ? 2 * (nx + nz) : 0;
        var pos = new Float32Array((n + nF) * 3), uv = new Float32Array((n + nF) * 2);
        var k = 0, i, j;
        for (j = 0; j < nz; j++) for (i = 0; i < nx; i++, k++) {
          var x = xs[i], z = zs[j];
          pos[k * 3] = x; pos[k * 3 + 1] = yFn(x, z, i, j); pos[k * 3 + 2] = z;
          uv[k * 2] = (x - uvCaja.x0) / (uvCaja.x1 - uvCaja.x0); uv[k * 2 + 1] = 1 - (z - uvCaja.z0) / (uvCaja.z1 - uvCaja.z0);
        }
        var idx = [];
        for (j = 0; j < nz - 1; j++) for (i = 0; i < nx - 1; i++) {
          if (hueco && i >= hueco[0] && i < hueco[2] && j >= hueco[1] && j < hueco[3]) continue;
          var a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
          idx.push(a, c, b, b, c, d);
        }
        if (faldon) {                                     // el borde baja como una pared: tapa las rendijas entre mallas
          var borde = [], f0 = n;
          for (i = 0; i < nx; i++) borde.push(i);
          for (j = 1; j < nz; j++) borde.push(j * nx + nx - 1);
          for (i = nx - 2; i >= 0; i--) borde.push((nz - 1) * nx + i);
          for (j = nz - 2; j > 0; j--) borde.push(j * nx);
          borde.forEach(function (v, q) {
            var w = f0 + q;
            pos[w * 3] = pos[v * 3]; pos[w * 3 + 1] = pos[v * 3 + 1] - faldon; pos[w * 3 + 2] = pos[v * 3 + 2];
            uv[w * 2] = uv[v * 2]; uv[w * 2 + 1] = uv[v * 2 + 1];
          });
          for (var qq = 0; qq < borde.length; qq++) {
            var v0 = borde[qq], v1 = borde[(qq + 1) % borde.length], w0 = f0 + qq, w1 = f0 + (qq + 1) % borde.length;
            idx.push(v0, w0, v1, v1, w0, w1, v0, v1, w0, v1, w1, w0);
          }
        }
        var g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
        g.setIndex(n + nF > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1));
        g.computeVertexNormals();
        return guarda(g);
      }
      var cerca = new THREE.Mesh(rejilla(xs, zs, function (x, z) { return yDe(x, z); }, O.cerca, null, 200), matCerca);
      cerca.receiveShadow = true;
      esc3.add(cerca);
      var L = R.lejos, xsL = [], zsL = [], i, j;
      for (i = 0; i < L.w; i++) xsL.push(L.x0 + i * (L.x1 - L.x0) / (L.w - 1));
      for (j = 0; j < L.h; j++) zsL.push(L.z0 + j * (L.z1 - L.z0) / (L.h - 1));
      var lejos = new THREE.Mesh(rejilla(xsL, zsL, function (x, z, i, j) { return L.data[j * L.w + i]; }, O.lejos, L.hueco, 400), matLejos);
      esc3.add(lejos);

      /* --- el agua: lámina con el reflejo de la escena (cámara espejada, media resolución) --- */
      var rtW = 2, rtH = 2;
      var rt = guarda(new THREE.WebGLRenderTarget(rtW, rtH, { depthBuffer: true, stencilBuffer: false }));
      var camR = new THREE.PerspectiveCamera();
      var mReflejo = new THREE.Matrix4();
      var planoAgua = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(NIVEL - 0.25));
      var aguaTex = cargaTex(BASE + O.agua.archivo, function (t) { t.colorSpace = THREE.NoColorSpace; t.needsUpdate = true; });
      aguaTex.colorSpace = THREE.NoColorSpace;
      var uAgua = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
        tiempo: { value: 0 }, reflejo: { value: null }, mReflejo: { value: mReflejo },
        mapaAgua: { value: null }, aguaCaja: { value: new THREE.Vector4(C.x0, C.z0, C.x1, C.z1) }, mPorU: { value: O.agua.metros_por_unidad * 255 },
        dirSol: { value: new THREE.Vector3(0, 1, 0) }, colSol: { value: new THREE.Color('#ffffff') }, brilloSol: { value: 1 },
        dirLuna: { value: new THREE.Vector3(0, 1, 0) }, brilloLuna: { value: 0 },
        profundo: { value: new THREE.Color('#163b36') }, somero: { value: new THREE.Color('#3a6f5e') }, luzAgua: { value: 1 },
        olas: { value: reduce ? 0 : 1 },
      }]);
      uAgua.reflejo.value = rt.texture; uAgua.mapaAgua.value = aguaTex; uAgua.mReflejo.value = mReflejo;
      var matAgua = guarda(new THREE.ShaderMaterial({
        uniforms: uAgua, fog: true, toneMapped: false,
        vertexShader: [
          'uniform mat4 mReflejo; varying vec3 vW; varying vec4 vR;', '#include <fog_pars_vertex>',
          'void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vR = mReflejo * w;',
          ' vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;', '#include <fog_vertex>', '}'].join('\n'),
        fragmentShader: [
          'uniform float tiempo; uniform sampler2D reflejo; uniform sampler2D mapaAgua; uniform vec4 aguaCaja; uniform float mPorU;',
          'uniform vec3 dirSol; uniform vec3 colSol; uniform float brilloSol; uniform vec3 dirLuna; uniform float brilloLuna;',
          'uniform vec3 profundo; uniform vec3 somero; uniform float luzAgua; uniform float olas;',
          'varying vec3 vW; varying vec4 vR;', '#include <fog_pars_fragment>',
          'float ruido(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);',
          '  float a = fract(sin(dot(i, vec2(127.1,311.7)))*43758.5), b = fract(sin(dot(i+vec2(1,0), vec2(127.1,311.7)))*43758.5);',
          '  float c = fract(sin(dot(i+vec2(0,1), vec2(127.1,311.7)))*43758.5), d = fract(sin(dot(i+vec2(1,1), vec2(127.1,311.7)))*43758.5);',
          '  return mix(mix(a,b,f.x), mix(c,d,f.x), f.y); }',
          'void main(){',
          '  vec2 cu = (vW.xz - aguaCaja.xy) / (aguaCaja.zw - aguaCaja.xy);',
          '  if (cu.x < 0.0 || cu.x > 1.0 || cu.y < 0.0 || cu.y > 1.0) discard;',
          '  vec4 a = texture2D(mapaAgua, vec2(cu.x, 1.0 - cu.y));',
          '  if (a.g < 0.5) discard;',
          '  float dc = a.r * mPorU;',
          '  vec2 p = vW.xz; float t = tiempo * olas;',
          '  vec3 V = normalize(cameraPosition - vW); float dist = length(cameraPosition - vW);',
          '  float fade = 1.0 - smoothstep(120.0, 3000.0, dist);',
          // rizado suave: tres trenes de ondas cortas y ruido que deriva (el embalse casi siempre está quieto)
          '  vec2 g = vec2(0.0);',
          '  g += vec2(0.6, 0.8) * cos(dot(p, vec2(0.6, 0.8)) * 0.9 - t * 1.4) * 0.30;',
          '  g += vec2(-0.8, 0.55) * cos(dot(p, vec2(-0.8, 0.55)) * 1.7 - t * 2.1) * 0.18;',
          '  g += vec2(0.2, -0.98) * cos(dot(p, vec2(0.2, -0.98)) * 3.1 - t * 2.9) * 0.10;',
          '  float e = 0.5; vec2 q = p * 0.35 + vec2(t * 0.11, t * 0.07);',
          '  g += vec2(ruido(q + vec2(e, 0.0)) - ruido(q - vec2(e, 0.0)), ruido(q + vec2(0.0, e)) - ruido(q - vec2(0.0, e))) * 0.55;',
          '  vec3 N = normalize(vec3(-g.x * 0.06 * fade, 1.0, -g.y * 0.06 * fade));',
          '  float fres = 0.18 + 0.82 * pow(1.0 - max(dot(N, V), 0.0), 3.0);',
          '  vec2 ruv = vR.xy / vR.w + N.xz * 0.35 * fade * (0.6 + 0.4 * smoothstep(0.0, 0.6, 1.0 - V.y));',
          '  vec3 refl = texture2D(reflejo, clamp(ruv, 0.001, 0.999)).rgb;',
          '  vec3 cuerpo = mix(somero, profundo, smoothstep(2.0, 70.0, dc)) * luzAgua;',
          '  vec3 col = mix(cuerpo, refl * 0.94, fres);',
          '  vec3 Rf = reflect(-V, N);',
          '  col += colSol * brilloSol * (pow(max(dot(Rf, dirSol), 0.0), 420.0) * 5.0 + pow(max(dot(Rf, dirSol), 0.0), 40.0) * 0.12);',
          '  col += vec3(0.75, 0.82, 1.0) * brilloLuna * pow(max(dot(Rf, dirLuna), 0.0), 160.0) * 2.2;',
          '  col = mix(col, col * 0.86 + vec3(0.02, 0.03, 0.025), (1.0 - smoothstep(0.0, 6.0, dc)) * 0.6);',
          '  gl_FragColor = vec4(col, 1.0);',
          '  #include <fog_fragment>',
          '  #include <colorspace_fragment>',
          '}'].join('\n'),
      }));
      var agua = new THREE.Mesh(guarda(new THREE.PlaneGeometry(C.x1 - C.x0, C.z1 - C.z0).rotateX(-Math.PI / 2)), matAgua);
      agua.position.set((C.x0 + C.x1) / 2, NIVEL, (C.z0 + C.z1) / 2);
      esc3.add(agua);

      /* --- cielo: cúpula con degradado y brillo hacia el sol --- */
      var RC = LEJOS * 0.9;
      var uCielo = { cZ: { value: new THREE.Color() }, cH: { value: new THREE.Color() }, dirSol: { value: new THREE.Vector3(0, 1, 0) }, brillo: { value: 0 }, cLuz: { value: new THREE.Color('#ffb070') } };
      var cielo = new THREE.Mesh(guarda(new THREE.SphereGeometry(RC, 40, 20)), guarda(new THREE.ShaderMaterial({
        side: THREE.BackSide, depthWrite: false, toneMapped: false, fog: false, uniforms: uCielo,
        vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: ['uniform vec3 cZ; uniform vec3 cH; uniform vec3 dirSol; uniform float brillo; uniform vec3 cLuz; varying vec3 vP;',
          'void main(){ float h = vP.y; vec3 c = mix(cH, cZ, smoothstep(0.0, 0.55, abs(h)));',
          ' float s = max(dot(normalize(vP), dirSol), 0.0); float vel = 1.0 - smoothstep(0.0, 0.45, abs(h));',
          ' c += cLuz * brillo * (pow(s, 6.0) * 0.5 + pow(s, 60.0) * 0.45) * vel;',
          ' gl_FragColor = vec4(c, 1.0);', ' #include <colorspace_fragment>', '}'].join('\n'),
      })));
      cielo.renderOrder = -10; cielo.frustumCulled = false;
      esc3.add(cielo);
      esc3.fog = new THREE.FogExp2('#d7e1e6', 1 / 26000);

      var rnd = azar(23), nE = hiDef ? 900 : 500, ePos = new Float32Array(nE * 3), RE = RC * 0.85;
      for (i = 0; i < nE; i++) {
        var a0 = rnd() * Math.PI * 2, hh = Math.asin(0.03 + rnd() * 0.96);
        ePos[i * 3] = Math.cos(hh) * Math.sin(a0) * RE; ePos[i * 3 + 1] = Math.sin(hh) * RE; ePos[i * 3 + 2] = -Math.cos(hh) * Math.cos(a0) * RE;
      }
      var eGeo = guarda(new THREE.BufferGeometry()); eGeo.setAttribute('position', new THREE.BufferAttribute(ePos, 3));
      var estrellas = new THREE.Points(eGeo, guarda(new THREE.PointsMaterial({ color: '#f3eee4', size: movil ? 1.4 : 1.7, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false })));
      estrellas.frustumCulled = false; esc3.add(estrellas);
      var texDe = function (lado, f) { var c = lienzo(lado, lado, f), t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return guarda(t); };
      var solS = new THREE.Sprite(guarda(new THREE.SpriteMaterial({ map: texDe(128, function (g, l) { var r = g.createRadialGradient(l / 2, l / 2, 0, l / 2, l / 2, l / 2); r.addColorStop(0, 'rgba(255,246,222,1)'); r.addColorStop(0.14, 'rgba(255,232,180,1)'); r.addColorStop(0.32, 'rgba(255,205,140,.35)'); r.addColorStop(1, 'rgba(255,205,140,0)'); g.fillStyle = r; g.fillRect(0, 0, l, l); }), fog: false, depthWrite: false, transparent: true, toneMapped: false })));
      solS.scale.set(RE * 0.09, RE * 0.09, 1); esc3.add(solS);
      var lunaCv = document.createElement('canvas'); lunaCv.width = lunaCv.height = 128;
      var lunaTex = guarda(new THREE.CanvasTexture(lunaCv)); lunaTex.colorSpace = THREE.SRGBColorSpace;
      var lunaS = new THREE.Sprite(guarda(new THREE.SpriteMaterial({ map: lunaTex, fog: false, depthWrite: false, transparent: true, toneMapped: false })));
      lunaS.scale.set(RE * 0.036, RE * 0.036, 1); esc3.add(lunaS);
      function pintarLuna(fase) {
        var g = lunaCv.getContext('2d'), Ld = 128, r = Ld * 0.36, c = Ld / 2;
        g.clearRect(0, 0, Ld, Ld); g.save(); g.translate(c, c);
        g.fillStyle = 'rgba(40,50,70,.5)'; g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill();
        var crec = fase < 0.5, p = crec ? fase : 1 - fase; if (!crec) g.scale(-1, 1);
        var k = Math.cos(2 * Math.PI * p);
        g.shadowColor = 'rgba(242,236,227,.55)'; g.shadowBlur = Ld * 0.1; g.fillStyle = '#f1ebdc';
        g.beginPath(); g.arc(0, 0, r, -Math.PI / 2, Math.PI / 2, false);
        g.ellipse(0, 0, Math.max(0.01, Math.abs(k)) * r, r, 0, Math.PI / 2, k >= 0 ? -Math.PI / 2 : 3 * Math.PI / 2, k >= 0);
        g.fill(); g.restore(); lunaTex.needsUpdate = true;
      }

      /* --- luces --- */
      var CASA = new THREE.Vector3(rc.cx, cs.suelo, rc.cz);
      var luzSol = new THREE.DirectionalLight('#ffffff', 2.6);
      luzSol.castShadow = true;
      var SM = hiDef ? 2048 : 1024;
      luzSol.shadow.mapSize.set(SM, SM);
      Object.assign(luzSol.shadow.camera, { left: -150, right: 150, top: 150, bottom: -150, near: 1, far: 2400 });
      luzSol.shadow.camera.updateProjectionMatrix();
      luzSol.shadow.bias = -0.0005; luzSol.shadow.normalBias = 0.06;
      luzSol.target.position.copy(CASA);
      var luzLuna = new THREE.DirectionalLight('#a8bce0', 0);
      luzLuna.target.position.copy(CASA);
      var hemi = new THREE.HemisphereLight('#dfe8f0', '#55503f', 1.5);
      var luzCasa = new THREE.PointLight('#ffc27a', 0, 45, 2);        // siempre está: si no, cambiaría el programa al anochecer
      esc3.add(luzSol, luzSol.target, luzLuna, luzLuna.target, hemi, luzCasa);

      /* --- materiales de los edificios --- */
      var texRep = function (c) { var t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = anis; return guarda(t); };
      var lamb = function (o) { return guarda(new THREE.MeshLambertMaterial(o)); };
      var MAT = {
        arenisca: lamb({ map: texRep(texPiedra('#c4a067', 11)) }),
        sillar: lamb({ map: texRep(texSillar('#d6b984', 12)) }),
        piedra: lamb({ map: texRep(texPiedra('#a89a82', 13)) }),
        blanca: lamb({ map: texRep(texRevoco('#e4dccb', 14)) }),
        ocre: lamb({ map: texRep(texRevoco('#d4bd92', 15)) }),
        teja: lamb({ map: texRep(texTeja('#ad5a3e', 5)) }),
        tejaVieja: lamb({ map: texRep(texTeja('#8a5a46', 6)) }),
        tablasH: lamb({ map: texRep(texTablas('#5a3a24', 21, true)) }),
        castano: lamb({ color: '#4a2f1e' }),
        alero: lamb({ color: '#3e2a1d', side: THREE.DoubleSide }),
        metal: lamb({ color: '#3b3a38' }),
        oscuro: lamb({ color: '#1d1a17', side: THREE.DoubleSide }),
      };
      MAT.vidrioGaleria = lamb({ color: '#2b3236', emissive: '#000000' });
      var pueblo = new THREE.Group(); esc3.add(pueblo);
      var ventanas = [];                               // {x, y, z, ang, w, h, luz, casa}
      var geoMuros = {};
      function añadeMuro(clave, a, b, y0, y1, u0) {      // a, b: [x, z] en el mundo; uv en metros/2,4
        var g = geoMuros[clave] || (geoMuros[clave] = { p: [], uv: [] });
        var l = Math.hypot(b[0] - a[0], b[1] - a[1]), u1 = u0 + l / 2.4;
        g.p.push(a[0], y0, a[1], b[0], y0, b[1], b[0], y1, b[1], a[0], y0, a[1], b[0], y1, b[1], a[0], y1, a[1]);
        g.uv.push(u0, y0 / 2.4, u1, y0 / 2.4, u1, y1 / 2.4, u0, y0 / 2.4, u1, y1 / 2.4, u0, y1 / 2.4);
      }
      function dentro(pt, anillo) {
        var c = false;
        for (var i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
          var a = anillo[i], b = anillo[j];
          if ((a[1] > pt[1]) !== (b[1] > pt[1]) && pt[0] < (b[0] - a[0]) * (pt[1] - a[1]) / (b[1] - a[1]) + a[0]) c = !c;
        }
        return c;
      }
      // tejado sobre un rectángulo orientado (a dos o a cuatro aguas), con el canto del alero
      function tejado(r, y0, tipo, alero, pendiente, mat, matGab, grupo) {
        var c = Math.cos(r.ang), s = Math.sin(r.ang);
        var Lh = r.largo / 2 + alero, Fh = r.fondo / 2 + alero, pend = Math.tan(pendiente * RAD), sube = Fh * pend;
        var P = function (u, v, y) { return [r.cx + u * c - v * s, y, r.cz + u * s + v * c]; };
        var tris = [], uvs = [];
        var cara = function (pts, uvsC) {
          for (var t = 0; t < pts.length; t += 3) {
            [pts[t], pts[t + 2], pts[t + 1]].forEach(function (v) { tris.push(v[0], v[1], v[2]); });
            [uvsC[t], uvsC[t + 2], uvsC[t + 1]].forEach(function (v) { uvs.push(v[0], v[1]); });
          }
        };
        var Y0 = y0, Y1 = y0 + sube, lg = Math.hypot(Fh, sube);
        if (tipo === '4') {
          var cr = Math.max(0, Lh - Fh);
          cara([P(-Lh, -Fh, Y0), P(Lh, -Fh, Y0), P(cr, 0, Y1), P(-Lh, -Fh, Y0), P(cr, 0, Y1), P(-cr, 0, Y1)], [[0, 0], [2 * Lh / 1.6, 0], [(Lh + cr) / 1.6, lg / 1.6], [0, 0], [(Lh + cr) / 1.6, lg / 1.6], [(Lh - cr) / 1.6, lg / 1.6]]);
          cara([P(Lh, Fh, Y0), P(-Lh, Fh, Y0), P(-cr, 0, Y1), P(Lh, Fh, Y0), P(-cr, 0, Y1), P(cr, 0, Y1)], [[0, 0], [2 * Lh / 1.6, 0], [(Lh + cr) / 1.6, lg / 1.6], [0, 0], [(Lh + cr) / 1.6, lg / 1.6], [(Lh - cr) / 1.6, lg / 1.6]]);
          var lgL = Math.hypot(Lh - cr, sube);
          cara([P(Lh, -Fh, Y0), P(Lh, Fh, Y0), P(cr, 0, Y1)], [[0, 0], [2 * Fh / 1.6, 0], [Fh / 1.6, lgL / 1.6]]);
          cara([P(-Lh, Fh, Y0), P(-Lh, -Fh, Y0), P(-cr, 0, Y1)], [[0, 0], [2 * Fh / 1.6, 0], [Fh / 1.6, lgL / 1.6]]);
        } else {
          cara([P(-Lh, -Fh, Y0), P(Lh, -Fh, Y0), P(Lh, 0, Y1), P(-Lh, -Fh, Y0), P(Lh, 0, Y1), P(-Lh, 0, Y1)], [[0, 0], [2 * Lh / 1.6, 0], [2 * Lh / 1.6, lg / 1.6], [0, 0], [2 * Lh / 1.6, lg / 1.6], [0, lg / 1.6]]);
          cara([P(Lh, Fh, Y0), P(-Lh, Fh, Y0), P(-Lh, 0, Y1), P(Lh, Fh, Y0), P(-Lh, 0, Y1), P(Lh, 0, Y1)], [[0, 0], [2 * Lh / 1.6, 0], [2 * Lh / 1.6, lg / 1.6], [0, 0], [2 * Lh / 1.6, lg / 1.6], [0, lg / 1.6]]);
          var Lw = r.largo / 2, Fw = r.fondo / 2, Yc = y0 + (Fw + alero) * pend;
          var gb = [P(Lw, -Fw, Y0), P(Lw, Fw, Y0), P(Lw, 0, Yc - 0.05), P(-Lw, Fw, Y0), P(-Lw, -Fw, Y0), P(-Lw, 0, Yc - 0.05)];
          var gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute([].concat.apply([], gb), 3));
          gg.setAttribute('uv', new THREE.Float32BufferAttribute([0, Y0 / 2.4, Fw / 1.2, Y0 / 2.4, Fw / 2.4, Yc / 2.4, 0, Y0 / 2.4, Fw / 1.2, Y0 / 2.4, Fw / 2.4, Yc / 2.4], 2));
          gg.computeVertexNormals();
          var mgm = matGab.clone(); guarda(mgm); mgm.side = THREE.DoubleSide;
          var mg = new THREE.Mesh(guarda(gg), mgm); mg.castShadow = true; mg.receiveShadow = true; grupo.add(mg);
        }
        var tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.Float32BufferAttribute(tris, 3)); tg.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); tg.computeVertexNormals();
        var mt = new THREE.Mesh(guarda(tg), mat); mt.castShadow = true; mt.receiveShadow = true; grupo.add(mt);
        var canto = new THREE.Mesh(guarda(new THREE.BoxGeometry(2 * Lh, 0.16, 2 * Fh)), MAT.alero);
        canto.position.set(r.cx, y0 - 0.1, r.cz); canto.rotation.y = -r.ang; canto.castShadow = true; grupo.add(canto);
        return Y1;
      }

      /* --- el pueblo: edificios del Catastro (muros, tejado, ventanas) --- */
      m.edificios.forEach(function (e) {
        if (e.tipo === 'casa') return;
        var hsh = hash(e.id), muro = hsh < 0.5 ? 'piedra' : hsh < 0.82 ? 'blanca' : 'ocre', planta = 2.8;
        var suelo = Math.min(e.suelo, yDe(e.rect.cx, e.rect.cz)) - 1.2;
        var arriba = e.suelo + 0.25 + e.pisos * planta;
        var an = e.anillo, u = 0;
        for (var k = 0; k < an.length; k++) {
          var A0 = an[k], B0 = an[(k + 1) % an.length], l = Math.hypot(B0[0] - A0[0], B0[1] - A0[1]);
          if (l < 0.05) continue;
          añadeMuro(muro, A0, B0, suelo, arriba, u);
          u += l / 2.4;
          if (l >= 2.6 && e.rect.fondo >= 2.5) {
            var nxv = (B0[1] - A0[1]) / l, nzv = -(B0[0] - A0[0]) / l, mid = [(A0[0] + B0[0]) / 2 + nxv * 0.3, (A0[1] + B0[1]) / 2 + nzv * 0.3];
            if (dentro(mid, an)) { nxv = -nxv; nzv = -nzv; }
            var nV = Math.max(1, Math.floor((l - 1.0) / 3.1));
            for (var pi = 0; pi < e.pisos; pi++) for (var w = 0; w < nV; w++) {
              var t = (w + 0.5) / nV, wx = A0[0] + (B0[0] - A0[0]) * t, wz = A0[1] + (B0[1] - A0[1]) * t;
              var hs2 = Math.abs(Math.sin(wx * 12.9898 + wz * 78.233 + pi * 3.1) * 43758.5453) % 1;
              ventanas.push({ x: wx + nxv * 0.03, z: wz + nzv * 0.03, y: e.suelo + 0.25 + pi * planta + 1.5, ang: Math.atan2(nxv, nzv), w: 0.85, h: 1.1, luz: hs2 < 0.3, casa: false });
            }
          }
        }
        if (e.rect.fondo >= 2.5) tejado(e.rect, arriba, e.cubierta, 0.45, 24, hsh < 0.15 ? MAT.tejaVieja : MAT.teja, MAT[muro], pueblo);
      });

      /* --- la casona (Tanes 9): planta del Catastro, piedra, cuatro aguas y la galería al agua --- */
      var casona = new THREE.Group();
      (function () {
        var Lc = rc.largo, Fc = rc.fondo, c = Math.cos(rc.ang), s = Math.sin(rc.ang);
        var y0 = cs.suelo + 0.15, hp = cs.altura_planta, yA = y0 + cs.plantas * hp, yB = Math.min(cs.suelo, yDe(rc.cx, rc.cz)) - 2.5;
        var W = function (u, v) { return [rc.cx + u * c - v * s, rc.cz + u * s + v * c]; };
        // lado de la galería: +v o -v según la normal que dio el script de datos
        var nG = cs.galeria.normal, vG = (nG[0] * -s + nG[1] * c) > 0 ? 1 : -1;
        var esq = [[-Lc / 2, -Fc / 2], [Lc / 2, -Fc / 2], [Lc / 2, Fc / 2], [-Lc / 2, Fc / 2]];
        var u = 0;
        for (var k = 0; k < 4; k++) {
          var A0 = esq[k], B0 = esq[(k + 1) % 4];
          añadeMuro('arenisca', W(A0[0], A0[1]), W(B0[0], B0[1]), yB, yA, u);
          u += Math.hypot(B0[0] - A0[0], B0[1] - A0[1]) / 2.4;
        }
        // esquinas de sillería
        var hS = yA - yB;
        esq.forEach(function (p) {
          var b = new THREE.Mesh(guarda(new THREE.BoxGeometry(0.62, hS, 0.62)), MAT.sillar);
          var w = W(p[0] - Math.sign(p[0]) * 0.28, p[1] - Math.sign(p[1]) * 0.28);
          b.position.set(w[0], yB + hS / 2, w[1]); b.rotation.y = -rc.ang;
          b.material.map.repeat.set(1, hS / 1.8);
          b.castShadow = true; b.receiveShadow = true; casona.add(b);
        });
        // tejado a cuatro aguas de teja vieja, con alero ancho de madera
        var cima = tejado(rc, yA, '4', 0.9, 24, MAT.tejaVieja, MAT.arenisca, casona);
        // dos chimeneas de piedra con sombrerete de chapa (fotos 01 y 10)
        [[0.2, 0.05], [-0.27, -0.12]].forEach(function (d, i2) {
          var w = W(Lc * d[0], Fc * d[1]), hCh = cima - yA + 1.1 - Math.abs(d[1]) * Fc * 0.9;
          var ch = new THREE.Mesh(guarda(new THREE.BoxGeometry(0.75, hCh + 0.4, 0.62)), MAT.arenisca);
          ch.position.set(w[0], yA + (hCh + 0.4) / 2 - 0.2, w[1]); ch.rotation.y = -rc.ang; ch.castShadow = true; casona.add(ch);
          var tapa = new THREE.Mesh(guarda(new THREE.BoxGeometry(0.95, 0.05, 0.8)), MAT.metal);
          tapa.position.set(w[0], yA + hCh + 0.45 + i2 * 0.05, w[1]); tapa.rotation.set(0, -rc.ang, 0.18); casona.add(tapa);
        });
        // la galería: viga, cierre de tablas, la banda acristalada con sus montantes y la cornisa
        var g = cs.galeria, uG = g.u, AN = g.ancho, VU = g.vuelo, vF = vG * Fc / 2;
        var pieza = function (geo, mat, uu, yy, vv) {
          var me = new THREE.Mesh(guarda(geo), mat), w = W(uu, vv);
          me.position.set(w[0], yy, w[1]); me.rotation.y = -rc.ang; me.castShadow = true; me.receiveShadow = true; casona.add(me); return me;
        };
        var yG = y0 + hp;                                           // suelo de la primera planta
        pieza(new THREE.BoxGeometry(AN + 0.5, 0.24, VU + 0.12), MAT.castano, uG, yG - 0.14, vF + vG * (VU + 0.12) / 2);
        pieza(new THREE.BoxGeometry(AN, 1.0, VU), MAT.tablasH, uG, yG + 0.5, vF + vG * VU / 2);
        var vid = pieza(new THREE.BoxGeometry(AN - 0.12, 1.45, VU - 0.1), MAT.vidrioGaleria, uG, yG + 1.0 + 0.725, vF + vG * (VU - 0.1) / 2);
        vid.castShadow = false;
        for (var mI = 0; mI <= 5; mI++) pieza(new THREE.BoxGeometry(0.09, 1.45, 0.09), MAT.castano, uG - AN / 2 + 0.05 + mI * (AN - 0.1) / 5, yG + 1.725, vF + vG * (VU - 0.02));
        [-1, 1].forEach(function (sg) { pieza(new THREE.BoxGeometry(0.09, 1.45, VU), MAT.castano, uG + sg * (AN / 2 - 0.05), yG + 1.725, vF + vG * VU / 2); });
        pieza(new THREE.BoxGeometry(AN + 0.12, 0.08, VU + 0.04), MAT.castano, uG, yG + 1.0, vF + vG * (VU + 0.04) / 2);
        pieza(new THREE.BoxGeometry(AN + 0.2, 0.26, VU + 0.1), MAT.castano, uG, yG + 2.58, vF + vG * (VU + 0.1) / 2);
        // la puerta en arco de la fachada de la galería (al otro lado), con «La Casa» en latón encima
        var uA = -Math.sign(uG || 1) * Lc * 0.22;
        var arco = new THREE.Shape(); arco.moveTo(-0.55, 0); arco.lineTo(0.55, 0); arco.lineTo(0.55, 1.5); arco.absarc(0, 1.5, 0.55, 0, Math.PI, false); arco.lineTo(-0.55, 0);
        var marcoA = new THREE.Shape(); marcoA.moveTo(-0.78, 0); marcoA.lineTo(0.78, 0); marcoA.lineTo(0.78, 1.5); marcoA.absarc(0, 1.5, 0.78, 0, Math.PI, false); marcoA.lineTo(-0.78, 0);
        var ponPlano = function (geo, mat, uu, yy, sep) {
          var me = new THREE.Mesh(guarda(geo), mat), w = W(uu, vF + vG * sep);
          me.position.set(w[0], yy, w[1]); me.rotation.y = -rc.ang + (vG > 0 ? 0 : Math.PI); casona.add(me); return me;
        };
        ponPlano(new THREE.ShapeGeometry(marcoA, 16), MAT.sillar, uA, y0, 0.02);
        ponPlano(new THREE.ShapeGeometry(arco, 16), MAT.castano, uA, y0, 0.04);
        var latonCv = lienzo(512, 160, function () {});
        var latonTex = guarda(new THREE.CanvasTexture(latonCv)); latonTex.colorSpace = THREE.SRGBColorSpace;
        var pintaLaton = function () {
          var gx = latonCv.getContext('2d'), fam = '';
          try { fam = getComputedStyle(el).getPropertyValue('--letra-script').trim(); } catch (e) { fam = ''; }
          gx.clearRect(0, 0, 512, 160);
          gx.font = 'italic 96px ' + (fam || '"Snell Roundhand", "Segoe Script", cursive');
          gx.textAlign = 'center'; gx.textBaseline = 'middle';
          var gr = gx.createLinearGradient(0, 30, 0, 130); gr.addColorStop(0, '#f0d79a'); gr.addColorStop(0.5, '#b8893e'); gr.addColorStop(1, '#7d5a26');
          gx.shadowColor = 'rgba(40,24,10,.6)'; gx.shadowOffsetX = 3; gx.shadowOffsetY = 4; gx.shadowBlur = 4;
          gx.fillStyle = gr; gx.fillText('La Casa', 256, 84); latonTex.needsUpdate = true;
        };
        pintaLaton();
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { if (!estado.destruido) { pintaLaton(); pedir(true); } });
        ponPlano(new THREE.PlaneGeometry(1.5, 0.47), guarda(new THREE.MeshLambertMaterial({ map: latonTex, transparent: true, depthWrite: false })), uA, y0 + 2.55, 0.03);
        // ventanas de la casona (las de la galería son la propia banda acristalada)
        var lados = [                         // [u0, v0, u1, v1] de cada fachada, recorrida con la normal hacia fuera
          [-Lc / 2, vG * Fc / 2, Lc / 2, vG * Fc / 2],
          [Lc / 2, -Fc / 2, Lc / 2, Fc / 2],
          [Lc / 2, -vG * Fc / 2, -Lc / 2, -vG * Fc / 2],
          [-Lc / 2, Fc / 2, -Lc / 2, -Fc / 2],
        ];
        var normales = [[0, vG], [1, 0], [0, -vG], [-1, 0]];
        lados.forEach(function (ld, li) {
          var len = Math.hypot(ld[2] - ld[0], ld[3] - ld[1]), n = len > 10 ? 3 : 2;
          var nu = normales[li][0], nv = normales[li][1];
          var nx = nu * c - nv * s, nz = nu * s + nv * c, ang = Math.atan2(nx, nz);
          for (var pi = 0; pi < cs.plantas; pi++) for (var w = 0; w < n; w++) {
            var t = (w + 0.5) / n, uu = ld[0] + (ld[2] - ld[0]) * t, vv = ld[1] + (ld[3] - ld[1]) * t;
            if (li === 0) {                                       // fachada de la galería
              if (Math.abs(uu - uG) < AN / 2 + 0.3 && pi >= 1) continue;
              if (Math.abs(uu - uA) < 1.0 && pi === 0) continue;
              if (pi === 2) continue;
            }
            var ww = pi === 0 ? 0.9 : 0.75, hh2 = pi === 2 ? 0.9 : 1.25;
            var p = W(uu + nu * 0.04, vv + nv * 0.04);
            var hs3 = hash(cs.galeria.rumbo + ':' + li + ':' + pi + ':' + w);
            ventanas.push({ x: p[0], z: p[1], y: y0 + pi * hp + (pi === 0 ? 1.2 : 1.5), ang: ang, w: ww, h: hh2, luz: hs3 < 0.72, casa: true });
          }
        });
        // la ventanita de la primera planta junto a «La Casa» (foto 01)
        var pv = W(uA + Math.sign(uA) * -0.2, vF + vG * 0.04);
        ventanas.push({ x: pv[0], z: pv[1], y: yG + 1.3, ang: Math.atan2(-s * vG, c * vG), w: 0.55, h: 0.55, luz: true, casa: true });
        casona.userData.galeria = { u: uG, v: vF + vG * VU, y: yG + 1.7 };
      })();
      esc3.add(casona);

      Object.keys(geoMuros).forEach(function (k) {
        var g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(geoMuros[k].p, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(geoMuros[k].uv, 2)); g.computeVertexNormals();
        var mm = MAT[k].clone(); guarda(mm); mm.side = THREE.DoubleSide;
        var me = new THREE.Mesh(guarda(g), mm); me.castShadow = true; me.receiveShadow = true; pueblo.add(me);
      });
      // ventanas: cristal oscuro de día; de noche, las encendidas con su halo
      var nVen = ventanas.length;
      var unidad = guarda(new THREE.PlaneGeometry(1, 1));
      var vidrio = new THREE.InstancedMesh(unidad, lamb({ color: '#25221f', side: THREE.DoubleSide }), nVen);
      var marco = new THREE.InstancedMesh(guarda(new THREE.BoxGeometry(1, 1, 0.08)), lamb({ color: '#4a3222' }), nVen);
      var encendidas = ventanas.filter(function (v) { return v.luz; });
      var luzV = new THREE.InstancedMesh(unidad, guarda(new THREE.MeshBasicMaterial({ color: '#ffc77a', toneMapped: false, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false })), Math.max(1, encendidas.length));
      var mtx = new THREE.Matrix4(), qt = new THREE.Quaternion(), eje = new THREE.Vector3(0, 1, 0), sc = new THREE.Vector3(1, 1, 1), ps = new THREE.Vector3();
      ventanas.forEach(function (v, k) {
        qt.setFromAxisAngle(eje, v.ang);
        ps.set(v.x, v.y, v.z); sc.set(v.w, v.h, 1); mtx.compose(ps, qt, sc); vidrio.setMatrixAt(k, mtx);
        ps.set(v.x - Math.sin(v.ang) * 0.02, v.y, v.z - Math.cos(v.ang) * 0.02); sc.set(v.w + 0.18, v.h + 0.18, 1); mtx.compose(ps, qt, sc); marco.setMatrixAt(k, mtx);
      });
      encendidas.forEach(function (v, k) { qt.setFromAxisAngle(eje, v.ang); ps.set(v.x + Math.sin(v.ang) * 0.015, v.y, v.z + Math.cos(v.ang) * 0.015); sc.set(v.w * 0.94, v.h * 0.94, 1); mtx.compose(ps, qt, sc); luzV.setMatrixAt(k, mtx); });
      sc.set(1, 1, 1);
      luzV.count = encendidas.length; luzV.visible = false;
      pueblo.add(marco, vidrio, luzV);
      var haloTex = texDe(64, function (g, l) { var r = g.createRadialGradient(l / 2, l / 2, 0, l / 2, l / 2, l / 2); r.addColorStop(0, 'rgba(255,196,120,.85)'); r.addColorStop(0.3, 'rgba(255,190,110,.25)'); r.addColorStop(1, 'rgba(255,190,110,0)'); g.fillStyle = r; g.fillRect(0, 0, l, l); });
      var halos = [];
      var ponHalo = function (x, y, z, tam) {
        var h = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, opacity: 0 }));
        guarda(h.material); h.position.set(x, y, z); h.scale.set(tam, tam, 1); h.visible = false; pueblo.add(h); halos.push(h);
      };
      encendidas.filter(function (v) { return v.casa; }).forEach(function (v) { ponHalo(v.x + Math.sin(v.ang) * 0.4, v.y, v.z + Math.cos(v.ang) * 0.4, 3.2); });
      (function () {                                                // la galería entera, de noche, es un farol
        var gd = casona.userData.galeria, c = Math.cos(rc.ang), s = Math.sin(rc.ang);
        ponHalo(rc.cx + gd.u * c - gd.v * s, gd.y, rc.cz + gd.u * s + gd.v * c, 7.5);
      })();
      luzCasa.position.set(rc.cx + cs.galeria.normal[0] * 6, cs.suelo + 3, rc.cz + cs.galeria.normal[1] * 6);

      /* --- árboles del pueblo (copas detectadas en la ortofoto) --- */
      var arb = m.arboles.filter(function (a, k) { return hiDef || k % 2 === 0; });
      var copaGeo = new THREE.IcosahedronGeometry(1, 1), cp = copaGeo.attributes.position;
      for (i = 0; i < cp.count; i++) {
        var vx = cp.getX(i), vy = cp.getY(i), vz = cp.getZ(i), hs4 = Math.abs(Math.sin(vx * 12.99 + vy * 78.23 + vz * 37.72) * 43758.55) % 1, f = 0.8 + hs4 * 0.34;
        cp.setXYZ(i, vx * f, vy * f, vz * f);
      }
      copaGeo.computeVertexNormals(); guarda(copaGeo);
      var copas = new THREE.InstancedMesh(copaGeo, lamb({ color: '#ffffff' }), Math.max(1, arb.length));
      var troncos = new THREE.InstancedMesh(guarda(new THREE.CylinderGeometry(0.18, 0.28, 1, 5)), lamb({ color: '#4a3d30' }), Math.max(1, arb.length));
      var col = new THREE.Color(), base = new THREE.Color('#4a6338'), rr = azar(77);
      arb.forEach(function (a, k) {
        var x = a[0], z = a[2], r = a[3], alto = a[4], y0 = yDe(x, z);
        qt.setFromAxisAngle(eje, rr() * 6.28);
        ps.set(x, y0 + alto - r * 0.95, z); sc.set(r, r * (0.85 + rr() * 0.3), r); mtx.compose(ps, qt, sc); copas.setMatrixAt(k, mtx);
        col.set(a[5]); col.lerp(base, 0.45); col.multiplyScalar(1.12 + rr() * 0.2); copas.setColorAt(k, col);
        ps.set(x, y0 + (alto - r) / 2, z); sc.set(1, Math.max(0.5, alto - r), 1); mtx.compose(ps, qt, sc); troncos.setMatrixAt(k, mtx);
      });
      copas.count = troncos.count = arb.length;
      sc.set(1, 1, 1);
      copas.castShadow = troncos.castShadow = true; copas.receiveShadow = true;
      esc3.add(copas, troncos);

      /* --- rótulos (HTML encima del lienzo) --- */
      var rotulos = m.lugares.map(function (l) {
        var li = document.createElement('span');
        li.className = 'lugar__rotulo' + (l.tipo === 'casa' ? ' lugar__rotulo--casa' : '') + (l.tipo === 'pico' ? ' lugar__rotulo--pico' : '');
        li.innerHTML = '<span><b>' + esc(l.nombre) + '</b>' + (l.sub ? '<small>' + esc(l.sub) + '</small>' : '') + '</span>';
        capaRot.appendChild(li);
        var y = Math.max(NIVEL, altura(l.x, l.z)) + l.dy;
        return { el: li, l: l, v: new THREE.Vector3(l.x, y, l.z), visto: false };
      });
      function tapado(a, b) {                     // ¿el relieve tapa la línea de la cámara al rótulo?
        for (var k = 1; k < 28; k++) {
          var t = k / 28, x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t, y = a.y + (b.y - a.y) * t;
          if (yDe(x, z) > y + 2) return true;
        }
        return false;
      }

      /* --- el cielo de ahora: luces, colores, astros --- */
      var dirSol = new THREE.Vector3(), dirLuna = new THREE.Vector3(), noche = 0;
      var dirDe = function (az, alt, v) { return v.set(Math.sin(az * RAD) * Math.cos(alt * RAD), Math.sin(alt * RAD), -Math.cos(az * RAD) * Math.cos(alt * RAD)); };
      var faseLuna = -1;
      function luces(f) {
        f = f || ahoraMismo();
        var s = sol(f), l = luna(f), c = cieloPara(s.alt);
        noche = lim((-s.alt - 2) / 10, 0, 1);
        var dia = lim((s.alt + 4) / 14, 0, 1);
        uCielo.cZ.value.set(c.cz); uCielo.cH.value.set(c.ch);
        dirDe(s.az, s.alt, dirSol); dirDe(l.az, l.alt, dirLuna);
        uCielo.dirSol.value.copy(dirSol);
        uCielo.brillo.value = lim(1 - Math.abs(s.alt - 1) / 14, 0, 1);
        esc3.fog.color.set(mezcla(c.ch, c.cz, 0.12));
        // sol: en un valle hondo se esconde antes tras las peñas; las sombras del relieve lo cuentan solas
        luzSol.position.copy(CASA).addScaledVector(dirSol, 1200);
        luzSol.intensity = 2.7 * suave(-1, 10, s.alt);
        luzSol.color.set(mezcla('#fff6ea', '#ff9d5c', lim(1 - s.alt / 22, 0, 1)));
        solS.visible = s.alt > -3; solS.material.opacity = lim((s.alt + 3) / 4, 0, 1);
        luzLuna.position.copy(CASA).addScaledVector(dirLuna, 1200);
        luzLuna.intensity = l.alt > 0 ? (0.25 + 0.9 * l.luz) * noche : 0;
        lunaS.visible = l.alt > -1.5 && l.luz > 0.03;
        if (lunaS.visible) { var fk = Math.round(l.fase * 100); if (fk !== faseLuna) { faseLuna = fk; pintarLuna(l.fase); } lunaS.material.opacity = lim((l.alt + 1.5) / 3, 0, 1); }
        hemi.intensity = lerp(0.45, 1.55, dia);
        hemi.color.set(mezcla('#3c4f86', '#dfe8f0', dia)); hemi.groundColor.set(mezcla('#15131c', '#55503f', dia));
        estrellas.material.opacity = noche * noche;
        uAgua.dirSol.value.copy(dirSol); uAgua.dirLuna.value.copy(dirLuna);
        uAgua.colSol.value.copy(luzSol.color); uAgua.brilloSol.value = suave(-2, 6, s.alt);
        uAgua.brilloLuna.value = l.alt > 0 ? l.luz * noche : 0;
        uAgua.luzAgua.value = lerp(0.12, 1, dia);
        var enc = noche > 0.05;
        luzV.visible = enc; luzV.material.opacity = lim(noche * 1.4, 0, 1);
        halos.forEach(function (h) { h.visible = enc; h.material.opacity = noche * 0.9; });
        MAT.vidrioGaleria.emissive.set(mezcla('#000000', '#e8a25a', lim(noche * 1.2, 0, 1)));
        luzCasa.intensity = noche * 50;
        ren.shadowMap.needsUpdate = true;
        pedir(true);
      }

      /* --- cámara: el recorrido con el scroll --- */
      var ruta = camino(m.recorrido);
      var vista = { w: 0, h: 0 };
      var hProm = 0;
      function ajustaReflejo() {
        var k = escalaReflejo() * ren.getPixelRatio();
        var w = Math.max(2, Math.round(vista.w * k)), h = Math.max(2, Math.round(vista.h * k));
        if (w !== rtW || h !== rtH) { rtW = w; rtH = h; rt.setSize(w, h); }
      }
      function ajustar() {
        var w = escenario.clientWidth, h = escenario.clientHeight;
        if (!w || !h) return;
        // la barra del navegador del móvil cambia solo el alto un poco: no se rehace todo
        if (vista.w === w && Math.abs(vista.h - h) < 160 && vista.h) { if (vista.h !== h) { vista.h = h; ren.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); ajustaReflejo(); pedir(true); } return; }
        vista.w = w; vista.h = h;
        ren.setPixelRatio(Math.min(devicePixelRatio || 1, topeDPR()));
        ren.setSize(w, h, false);
        cam.aspect = w / h;
        cam.fov = w / h < 1 ? 58 : w / h < 1.3 ? 48 : 42;
        cam.updateProjectionMatrix();
        ajustaReflejo();
        pedir(true);
      }
      function situar(p) {
        var r = ruta(p);
        cam.position.set(r.pos[0], r.pos[1], r.pos[2]);
        cam.lookAt(r.mira[0], r.mira[1], r.mira[2]);
        var sobre = Math.max(1, r.pos[1] - Math.max(NIVEL, yDe(r.pos[0], r.pos[2])));
        var cerca2 = lim(sobre * 0.25, 0.6, 30);
        if (Math.abs(cerca2 - cam.near) / cam.near > 0.1) { cam.near = cerca2; cam.updateProjectionMatrix(); }
        hProm = sobre;
      }
      // la cámara espejada bajo la lámina (como el Reflector de Three.js, sin plano oblicuo: recorte global)
      var v1 = new THREE.Vector3(), v2 = new THREE.Vector3();
      var sesgo = new THREE.Matrix4().set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
      function pintarReflejo() {
        cam.updateMatrixWorld();
        cam.getWorldDirection(v1);
        camR.position.set(cam.position.x, 2 * NIVEL - cam.position.y, cam.position.z);
        v2.copy(cam.position).add(v1); v2.y = 2 * NIVEL - v2.y;
        camR.up.set(0, -1, 0); camR.lookAt(v2);
        camR.projectionMatrix.copy(cam.projectionMatrix); camR.projectionMatrixInverse.copy(cam.projectionMatrixInverse);
        camR.near = cam.near; camR.far = cam.far;
        camR.updateMatrixWorld();
        mReflejo.copy(sesgo).multiply(camR.projectionMatrix).multiply(camR.matrixWorldInverse);
        agua.visible = false;
        cielo.position.copy(camR.position); estrellas.position.copy(camR.position);
        solS.position.copy(camR.position).addScaledVector(dirSol, RE * 0.95);
        lunaS.position.copy(camR.position).addScaledVector(dirLuna, RE * 0.95);
        ren.clippingPlanes = [planoAgua];
        ren.setRenderTarget(rt);
        ren.render(esc3, camR);
        ren.setRenderTarget(null);
        ren.clippingPlanes = [];
        agua.visible = true;
      }
      var v3 = new THREE.Vector3();
      function colocarRotulos(p) {
        var w = vista.w, h = vista.h;
        rotulos.forEach(function (r) {
          var ok = p >= r.l.fase[0] && p <= r.l.fase[1];
          if (ok) {
            v3.copy(r.v).project(cam);
            ok = v3.z < 1 && Math.abs(v3.x) < 0.94 && v3.y > -0.9 && v3.y < 0.92;
            if (ok && r.l.tipo !== 'pico') ok = !tapado(cam.position, r.v);
            if (ok && r.l.tipo === 'pico') ok = !tapado(cam.position, v2.set(r.v.x, r.v.y - r.l.dy + 4, r.v.z));
          }
          if (ok) r.el.style.transform = 'translate3d(' + ((v3.x + 1) / 2 * w).toFixed(1) + 'px,' + ((1 - v3.y) / 2 * h).toFixed(1) + 'px,0)';
          if (ok !== r.visto) { r.visto = ok; r.el.classList.toggle('es-visible', ok); }
        });
      }

      /* --- bucle: pinta solo si hace falta; se para fuera de pantalla --- */
      var raf = 0, tPrev = 0, activo = false, visible = true, sucio = true, primero = true, pAnt = -1, tAgua = 0;
      var fpsEl = null, fN = 0, fT0 = 0, tAc = 0, nAc = 0;
      if (q.has('fps')) { fpsEl = document.createElement('p'); fpsEl.className = 'lugar__fps'; escenario.appendChild(fpsEl); }
      function leerScroll() {
        var r = pista.getBoundingClientRect(), recorrido = pista.offsetHeight - escenario.offsetHeight;
        estado.p = recorrido > 0 ? lim(-r.top / recorrido, 0, 1) : 0;
      }
      function paso(t) {
        raf = 0;
        if (estado.destruido || !activo || !visible) return;
        var dt = tPrev ? Math.min(0.1, (t - tPrev) / 1000) : 0.016; tPrev = t;
        leerScroll();
        var k = reduce ? 1 : 1 - Math.exp(-dt * 5.5);                  // inercia suave, independiente de los fps
        var pV = estado.pVis + (estado.p - estado.pVis) * k;
        if (Math.abs(estado.p - pV) < 0.00005) pV = estado.p;
        var mueve = Math.abs(pV - pAnt) > 0.00001;
        estado.pVis = pV;
        var aguaViva = !reduce && pV > 0.45;                          // el rizado solo se nota cerca del agua
        if (mueve || sucio || aguaViva) {
          tAgua += dt; uAgua.tiempo.value = tAgua;
          situar(pV);
          pintarReflejo();
          cielo.position.copy(cam.position); estrellas.position.copy(cam.position);
          solS.position.copy(cam.position).addScaledVector(dirSol, RE * 0.95);
          lunaS.position.copy(cam.position).addScaledVector(dirLuna, RE * 0.95);
          ren.render(esc3, cam);
          colocarRotulos(pV); marcarParada(pV);
          pAnt = pV; sucio = false;
          if (primero) { primero = false; escenario.classList.add('lugar--listo'); estado.cargado = true; }
          if (fpsEl) { fN++; if (!fT0) fT0 = t; if (t - fT0 > 500) { fpsEl.textContent = (fN * 1000 / (t - fT0)).toFixed(0) + ' fps · calidad ' + estado.calidad + ' · DPR ' + ren.getPixelRatio().toFixed(2) + ' · reflejo ' + rtW + '×' + rtH + ' · ' + Math.round(hProm) + ' m'; fN = 0; fT0 = t; } }
          tAc += dt; nAc++;
          if (nAc >= 50) { var media = tAc / nAc; tAc = 0; nAc = 0; if (media > 0.03 && estado.calidad < 2 && !document.hidden) bajarCalidad(); }
        }
        raf = requestAnimationFrame(paso);
      }
      function pedir(ensuciar) { if (ensuciar) sucio = true; if (!raf && activo && visible && !estado.destruido) { tPrev = 0; raf = requestAnimationFrame(paso); } }
      function bajarCalidad() {
        estado.calidad++;
        if (estado.calidad === 1) { ren.setPixelRatio(1); ren.setSize(vista.w, vista.h, false); }
        if (estado.calidad === 2) { ren.shadowMap.enabled = false; luzSol.castShadow = false; ren.setPixelRatio(0.8); ren.setSize(vista.w, vista.h, false); esc3.traverse(function (o) { if (o.material) o.material.needsUpdate = true; }); }
        ajustaReflejo();
        pedir(true);
      }
      var alRedim = new ResizeObserver(function () { ajustar(); });
      alRedim.observe(escenario);
      var io = new IntersectionObserver(function (es) {
        visible = es[0].isIntersecting;
        if (visible) pedir(true); else { cancelAnimationFrame(raf); raf = 0; }
      }, { rootMargin: '120px' });
      io.observe(pista);
      var alScroll = function () { pedir(false); };
      escucha(window, 'scroll', alScroll, { passive: true });
      var alPerder = function (e) { e.preventDefault(); estado.error3d = 'contexto perdido'; ponModo('plano'); };
      cv.addEventListener('webglcontextlost', alPerder);

      ajustar();
      luces();
      try { ren.compile(esc3, cam); } catch (e) { /* sin compilación previa */ }

      t3 = {
        luces: luces,
        activo: function (si) { activo = si; cv.hidden = !si; if (si) { vista.w = 0; ajustar(); pedir(true); } else { cancelAnimationFrame(raf); raf = 0; } },
        estado: function () { return { p: estado.p, pVis: estado.pVis, calidad: estado.calidad, near: cam.near, fov: cam.fov, reflejo: [rtW, rtH], triangulos: ren.info.render.triangles, llamadas: ren.info.render.calls, ventanas: nVen, arboles: arb.length }; },
        destruir: function () {
          cancelAnimationFrame(raf); raf = 0; alRedim.disconnect(); io.disconnect();
          cv.removeEventListener('webglcontextlost', alPerder);
          disponer.forEach(function (o) { try { o.dispose(); } catch (e) { /* ya */ } });
          esc3.traverse(function (o) { if (o.material && o.material.dispose) o.material.dispose(); if (o.dispose && o.isInstancedMesh) o.dispose(); });
          try { ren.dispose(); ren.forceContextLoss(); } catch (e) { /* ya */ }
          cv.remove();
        },
      };
      return t3;
    }

    /* ---------- mandos ---------- */
    function activar3d(desdeBoton) {
      ponModo('3d');
      if (desdeBoton) el.scrollIntoView({ block: 'start', behavior: 'auto' });
      cargar3d().then(function (t) { if (t && !estado.destruido && estado.modo === '3d') t.activo(true); });
    }
    var alA3d = function () { activar3d(true); };
    var alAplano = function () { ponModo('plano'); el.scrollIntoView({ block: 'start', behavior: 'auto' }); };
    escucha($('a3d'), 'click', alA3d);
    escucha($('aplano'), 'click', alAplano);
    var alRedimPlano = new ResizeObserver(function () { colocarMarcas(); });
    alRedimPlano.observe(el);
    escuchas.push(function () { alRedimPlano.disconnect(); });

    cieloTexto();
    intervalo = setInterval(function () { if (!document.hidden) cieloTexto(); }, 60000);
    marcarParada(0);
    if (auto3d) activar3d(false); else ponModo('plano');
    el.dataset.montado = '1';

    return {
      destruir: function () {
        estado.destruido = true;
        clearInterval(intervalo);
        escuchas.forEach(function (f) { f(); });
        if (t3) t3.destruir();
        t3 = null;
        el.classList.remove('lugar'); delete el.dataset.modo; delete el.dataset.montado;
        el.style.removeProperty('--lugar-noche');
        el.innerHTML = respaldo;
      },
      estado: function () { return { modo: estado.modo, puede3d: puede3d, auto3d: auto3d, error3d: estado.error3d, cargado: estado.cargado, t3: t3 ? t3.estado() : null }; },
      ver3d: function () { activar3d(false); },
      verPlano: function () { ponModo('plano'); },
    };
  }

  T.lugar = { montar: montar, sol: sol, luna: luna, fraseCielo: fraseCielo, cieloPara: cieloPara, camino: camino, monotona: monotona };
})();
