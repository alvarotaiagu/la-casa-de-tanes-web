/* =====================================================================
   La Casa de Tanes · «Redes alrededor»: la lámina del valle (canvas) que acompaña a la lista.
   - Datos (js/valle-datos.js, de scripts/mapa-valle.py), en METROS desde la casa (x al este, y al sur): el relieve
     sombreado del IGN en tres láminas (valle MDT05, Redes MDT25, hasta Oviedo MDT200), embalses, ríos, carreteras y
     pueblos de OpenStreetMap, el límite del Parque Natural de Redes y la ruta REAL de OSRM a cada destino.
   - La lista manda: pasar por un sitio (ratón o foco) enseña su camino; pulsarlo lo fija (aria-pressed). El mapa la
     acompaña: el camino se traza desde la casa con el tiempo contándose, y pulsar un punto del mapa elige ese sitio.
   - Filtros que hacen zoom: «En el valle» encuadra el embalse, «Por Redes» abre al Parque y «Para llegar», hasta
     Oviedo y el aeropuerto. Lo que cae fuera del encuadre sale como flecha en el borde con su distancia.
   - Rendimiento: el fondo (relieve, agua, ríos, carreteras, pueblos) se pinta en un lienzo aparte y solo se rehace al
     cambiar de encuadre o de tamaño; cada fotograma estampa ese fondo y dibuja el camino y las marcas. Nada de filter
     ni shadowBlur. Grosor según el ancho (gf). DPR ≤ 2. Solo hay bucle mientras algo se mueve.
   - Con movimiento reducido: sin trazos animados ni viajes de cámara (el camino sale entero y el encuadre salta).
   - Sin JS: la lámina quieta (img/mapa/lamina-quieta) y la lista. Los datos se cargan al acercarse (900 px).
   ===================================================================== */
(function () {
  'use strict';
  const T = (window.Tanes = window.Tanes || {});
  const caja = document.getElementById('valle');
  if (!caja) return;
  const $$ = (s, c) => Array.from((c || document).querySelectorAll(s));
  const lamina = document.getElementById('valle-lamina');
  const pista = document.getElementById('valle-pista');
  const botones = $$('.parada', caja);
  const filtros = $$('.filtro', caja);
  const tramos = $$('.tramo', caja);
  const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const C = { fondo: '#22130D', noche: '#1F0F0A', agua: '#79AA9C', laton: '#B4A380', arenisca: '#E6D6C5', media: '#C8AE92' };
  const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const sale = (t) => 1 - Math.pow(1 - t, 3);
  const enMedio = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const kmTxt = (v) => (v < 1 ? Math.round(v * 1000) + ' m' : String(Math.round(v * 10) / 10).replace('.', ',') + ' km');
  const minTxt = (m) => (m >= 60 ? Math.floor(m / 60) + ' h ' + String(m % 60).padStart(2, '0') + ' min' : m + ' min');
  const LETRA = '"Ubuntu Sans", system-ui, sans-serif';
  const SCRIPT = '"Imperial Script", cursive';

  let D = null, cv = null, ctx = null, base = null, bctx = null;
  let W = 0, H = 0, dpr = 1, gf = 1;
  let vista = { cx: 0, cy: 0, s: 0.05 }, viaje = null;
  let grupo = 'cerca', elegida = null, sobre = null;
  let ruta = { id: null, t: 1, t0: 0, dur: 0 };
  let raf = 0, baseSucia = true;
  const imgs = {};
  const porId = new Map();

  /* ---------- carga diferida ---------- */
  function cargar() {
    if (window.TANES_VALLE) { iniciar(); return; }
    const s = document.createElement('script');
    s.src = caja.dataset.datos || 'js/valle-datos.js';
    s.onload = iniciar;
    s.onerror = () => console.warn('valle: sin datos, se queda la lámina quieta');
    document.head.appendChild(s);
  }
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); cargar(); } }, { rootMargin: '900px 0px' });
    io.observe(caja);
  } else cargar();

  /* ---------- geometría ---------- */
  const X = (x) => (x - vista.cx) * vista.s + W / 2;
  const Y = (y) => (y - vista.cy) * vista.s + H / 2;
  const cajaDe = (flat) => { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (let i = 0; i < flat.length; i += 2) { const x = flat[i], y = flat[i + 1]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } return [x0, y0, x1, y1]; };
  const seVe = (b, m) => { m = m || 0; return X(b[2]) >= -m && X(b[0]) <= W + m && Y(b[3]) >= -m && Y(b[1]) <= H + m; };
  function trazo(c, flat, cerrar) {
    c.beginPath();
    c.moveTo(X(flat[0]), Y(flat[1]));
    for (let i = 2; i < flat.length; i += 2) c.lineTo(X(flat[i]), Y(flat[i + 1]));
    if (cerrar) c.closePath();
  }

  /* ---------- encuadres de los filtros ---------- */
  function encuadre(g) {
    const pts = [[0, 0]];
    // «Para llegar» es el encuadre más abierto: caben todos (Oviedo y el aeropuerto al noroeste, Tarna al sureste)
    D.destinos.forEach((d) => { if (d.grupo === g || g === 'lejos') pts.push([d.x, d.y]); });
    // «En el valle» encuadra el embalse (las láminas de agua grandes a menos de 9 km); «Por Redes», el Parque entero
    if (g === 'cerca') D.agua.forEach((a) => { if (a.area > 150000 && Math.hypot((a.b[0] + a.b[2]) / 2, (a.b[1] + a.b[3]) / 2) < 9000) pts.push([a.b[0], a.b[1]], [a.b[2], a.b[3]]); });
    if (g === 'redes') D.parque.forEach((p) => { pts.push([p.b[0], p.b[1]], [p.b[2], p.b[3]]); });
    let x0 = Math.min(...pts.map((p) => p[0])), x1 = Math.max(...pts.map((p) => p[0]));
    let y0 = Math.min(...pts.map((p) => p[1])), y1 = Math.max(...pts.map((p) => p[1]));
    const minimo = g === 'cerca' ? 6000 : 12000;
    if (x1 - x0 < minimo) { const c = (x0 + x1) / 2; x0 = c - minimo / 2; x1 = c + minimo / 2; }
    if (y1 - y0 < minimo * 0.6) { const c = (y0 + y1) / 2; y0 = c - minimo * 0.3; y1 = c + minimo * 0.3; }
    const margen = W < 520 ? 0.2 : 0.13;
    const bw = (x1 - x0) * (1 + 2 * margen), bh = (y1 - y0) * (1 + 2 * margen);
    const s = Math.min(W / bw, H / bh);
    return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, s };
  }

  /* ---------- el fondo (lienzo aparte) ---------- */
  function pintarBase() {
    const c = bctx;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.fillStyle = C.fondo;
    c.fillRect(0, 0, W, H);
    // relieve: de la lámina más amplia a la más fina (la fina tapa a la amplia donde existe)
    D.capas.forEach((k) => {
      const im = imgs[k.id];
      if (!im || !im.complete || !im.naturalWidth) return;
      const b = [k.x0, k.y0, k.x1, k.y1];
      if (!seVe(b)) return;
      c.drawImage(im, X(k.x0), Y(k.y0), (k.x1 - k.x0) * vista.s, (k.y1 - k.y0) * vista.s);
    });
    const kmpx = 1 / vista.s / 1000;                       // km por píxel
    // el límite del Parque Natural de Redes
    c.setLineDash([6 * gf, 5 * gf]);
    c.lineWidth = 1.3 * gf;
    c.strokeStyle = rgba(C.laton, 0.5);
    D.parque.forEach((p) => { if (seVe(p.b, 10)) { trazo(c, p.p); c.stroke(); } });
    c.setLineDash([]);
    // ríos y embalses
    c.strokeStyle = rgba(C.agua, 0.55);
    c.lineWidth = clamp(2.4 - kmpx * 8, 0.8, 2.2) * gf;
    c.lineJoin = c.lineCap = 'round';
    D.rios.forEach((r) => { if (seVe(r.b, 4)) { trazo(c, r.p); c.stroke(); } });
    c.fillStyle = rgba(C.agua, 0.9);
    D.agua.forEach((a) => { if (seVe(a.b, 2) && a.area * vista.s * vista.s > 4) { trazo(c, a.p, true); c.fill(); } });
    // carreteras: las finas se desvanecen al alejarse (factor continuo, nada de umbrales de golpe)
    const ancho = [2.3, 1.7, 1.15, 0.85], alfa = [0.62, 0.5, 0.36, 0.3];
    const fade = [1, 1, clamp((0.12 - kmpx) / 0.07, 0, 1), clamp((0.06 - kmpx) / 0.035, 0, 1)];
    for (let n = 3; n >= 0; n--) {
      if (fade[n] <= 0.02) continue;
      c.strokeStyle = rgba(C.arenisca, alfa[n] * fade[n]);
      c.lineWidth = ancho[n] * gf;
      D.carreteras.forEach((r) => { if (r.n === n && seVe(r.b, 4)) { trazo(c, r.p); c.stroke(); } });
    }
    // pueblos (para orientarse), con su nombre si cabe y no pisa
    const fp = clamp((0.09 - kmpx) / 0.05, 0, 1);
    const ocupado = [];
    c.font = `400 ${Math.round(11.5 * clamp(gf, 0.9, 1.15))}px ${LETRA}`;
    c.textBaseline = 'middle';
    D.pueblos.forEach((p) => {
      const grande = p.tipo === 'city' || p.tipo === 'town';
      const a = grande ? 1 : fp;
      if (a <= 0.05) return;
      const x = X(p.x), y = Y(p.y);
      if (x < 6 || x > W - 6 || y < 6 || y > H - 6) return;
      if (D.destinos.some((d) => Math.hypot(X(d.x) - x, Y(d.y) - y) < 14) || Math.hypot(X(0) - x, Y(0) - y) < 16) return;
      c.fillStyle = rgba(C.media, 0.75 * a);
      c.beginPath(); c.arc(x, y, (grande ? 2.6 : 1.8) * gf, 0, Math.PI * 2); c.fill();
      const w = c.measureText(p.nombre).width, r = [x + 6, y - 8, x + 8 + w, y + 8];
      if (r[2] > W - 4 || ocupado.some((o) => !(r[2] < o[0] || o[2] < r[0] || r[3] < o[1] || o[3] < r[1]))) return;
      ocupado.push(r);
      c.fillStyle = rgba(C.media, 0.82 * a);
      c.fillText(p.nombre, x + 7, y);
    });
    baseSucia = false;
  }

  /* ---------- lo de encima: camino, marcas, rótulos, flechas ---------- */
  function caminoParcial(d, t) {
    const p = d.ruta, L = d.largo;
    const objetivo = L * t;
    ctx.beginPath();
    ctx.moveTo(X(p[0]), Y(p[1]));
    let hx = p[0], hy = p[1];
    for (let i = 2; i < p.length; i += 2) {
      const ac = d.acum[i / 2];
      if (ac <= objetivo) { ctx.lineTo(X(p[i]), Y(p[i + 1])); hx = p[i]; hy = p[i + 1]; continue; }
      const prev = d.acum[i / 2 - 1], f = (objetivo - prev) / Math.max(1e-6, ac - prev);
      hx = p[i - 2] + (p[i] - p[i - 2]) * f; hy = p[i - 1] + (p[i + 1] - p[i - 1]) * f;
      ctx.lineTo(X(hx), Y(hy));
      break;
    }
    return [hx, hy];
  }
  function chapa(texto, x, y, opc) {
    opc = opc || {};
    ctx.font = `${opc.peso || 500} ${Math.round((opc.t || 12.5) * clamp(gf, 0.92, 1.12))}px ${LETRA}`;
    const w = ctx.measureText(texto).width + 14, h = Math.round(22 * clamp(gf, 0.92, 1.1));
    return { texto, w, h, x, y, opc };
  }
  function ponerChapas(lista, ocupado) {
    const dentro = (r) => r[0] >= 4 && r[1] >= 4 && r[2] <= W - 4 && r[3] <= H - 4;
    const choca = (r) => ocupado.some((o) => !(r[2] <= o[0] || o[2] <= r[0] || r[3] <= o[1] || o[3] <= r[1]));
    const puestas = [];
    lista.forEach((ch) => {
      const { x, y, w, h } = ch;
      const cands = [[x + 11, y - h / 2], [x - 11 - w, y - h / 2], [x - w / 2, y - 12 - h], [x - w / 2, y + 12], [x + 9, y - h - 4], [x - 9 - w, y + 4]];
      let ok = null;
      for (const [cx, cy] of cands) { const r = [cx, cy, cx + w, cy + h]; if (dentro(r) && !choca(r)) { ok = r; break; } }
      if (!ok && ch.opc.siempre) { const r = [clamp(x + 11, 4, W - w - 4), clamp(y - h / 2, 4, H - h - 4)]; ok = [r[0], r[1], r[0] + w, r[1] + h]; }
      if (!ok) return;
      ocupado.push(ok);
      puestas.push({ ...ch, r: ok });
    });
    return puestas;
  }
  function dibujarChapa(p) {
    const [x0, y0, x1, y1] = p.r;
    const activa = p.opc.activa;
    ctx.fillStyle = activa ? C.laton : rgba(C.noche, 0.86);
    ctx.beginPath();
    const r = (y1 - y0) / 2;
    ctx.moveTo(x0 + r, y0); ctx.lineTo(x1 - r, y0); ctx.arc(x1 - r, y0 + r, r, -Math.PI / 2, Math.PI / 2); ctx.lineTo(x0 + r, y1); ctx.arc(x0 + r, y0 + r, r, Math.PI / 2, -Math.PI / 2); ctx.fill();
    ctx.fillStyle = activa ? C.noche : C.arenisca;
    ctx.font = `${p.opc.peso || 500} ${Math.round((p.opc.t || 12.5) * clamp(gf, 0.92, 1.12))}px ${LETRA}`;
    ctx.textBaseline = 'middle';
    ctx.fillText(p.texto, x0 + 7, (y0 + y1) / 2 + 0.5);
  }
  function pintar(ahora) {
    if (!ctx) return;
    if (baseSucia) pintarBase();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(base, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineJoin = ctx.lineCap = 'round';
    const actual = sobre || elegida;
    const ocupado = [];
    const chapas = [], flechas = [], marcas = [];
    // el camino (el que se está mirando), con su cabeza y el tiempo contándose
    let cabeza = null;
    if (ruta.id && porId.has(ruta.id)) {
      const d = porId.get(ruta.id);
      const t = ruta.dur ? clamp(((ahora || performance.now()) - ruta.t0) / ruta.dur, 0, 1) : 1;
      ruta.t = t;
      const e = quieto ? 1 : sale(t);
      ctx.strokeStyle = rgba(C.noche, 0.75); ctx.lineWidth = 5.2 * gf;
      caminoParcial(d, e); ctx.stroke();
      ctx.strokeStyle = C.laton; ctx.lineWidth = 2.6 * gf;
      const [hx, hy] = caminoParcial(d, e); ctx.stroke();
      cabeza = { x: X(hx), y: Y(hy), min: Math.max(1, Math.round(d.min * e)), d, e };
    }
    // la casa
    const cx = X(0), cy = Y(0);
    ctx.fillStyle = C.laton; ctx.strokeStyle = C.noche; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(cx, cy, 6.5 * clamp(gf, 0.9, 1.2), 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.font = `${Math.round(26 * clamp(gf, 0.85, 1.15))}px ${SCRIPT}`;
    const wCasa = ctx.measureText('La Casa').width;
    const casaR = [cx + 10, cy - 34, cx + 14 + wCasa, cy - 4];
    if (casaR[2] > W - 4) { casaR[0] = cx - 14 - wCasa; casaR[2] = cx - 10; }
    ocupado.push(casaR);
    ctx.lineWidth = 4; ctx.strokeStyle = rgba(C.noche, 0.85); ctx.textBaseline = 'alphabetic';
    ctx.strokeText('La Casa', casaR[0], casaR[3] - 6);
    ctx.fillStyle = C.laton; ctx.fillText('La Casa', casaR[0], casaR[3] - 6);
    // los destinos
    const margen = 18;
    const orden = D.destinos.slice().sort((a, b) => (a.id === actual) - (b.id === actual) || (a.grupo === grupo) - (b.grupo === grupo));
    orden.forEach((d) => {
      const x = X(d.x), y = Y(d.y);
      const activa = d.id === actual;
      const delGrupo = d.grupo === grupo;
      if (x < margen || x > W - margen || y < margen || y > H - margen) {
        // fuera del encuadre: flecha en el borde con su distancia (el rótulo, si cabe sin pisar; el del elegido, siempre)
        const ang = Math.atan2(y - H / 2, x - W / 2);
        const ix = W / 2 - margen - 14, iy = H / 2 - margen - 14;
        const k = Math.min(ix / Math.max(1e-6, Math.abs(Math.cos(ang))), iy / Math.max(1e-6, Math.abs(Math.sin(ang))));
        const fx = W / 2 + Math.cos(ang) * k, fy = H / 2 + Math.sin(ang) * k;
        flechas.push({ id: d.id, x: fx, y: fy, ang, activa });
        chapas.push({ ...chapa(`${d.nombre} · ${kmTxt(d.km)}`, fx - Math.cos(ang) * 10, fy - Math.sin(ang) * 10, { activa, siempre: activa, t: 11.5 }), id: d.id, flecha: true });
        return;
      }
      marcas.push({ id: d.id, x, y });
      const r = (activa ? 7.5 : delGrupo ? 5.5 : 4) * clamp(gf, 0.9, 1.2);
      ctx.fillStyle = activa ? C.laton : delGrupo ? C.noche : rgba(C.noche, 0.8);
      ctx.strokeStyle = activa ? C.noche : delGrupo ? C.laton : rgba(C.media, 0.85);
      ctx.lineWidth = activa ? 2.5 : 2;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      if (delGrupo || activa) chapas.push({ ...chapa(activa ? `${d.nombre} · ${minTxt(d.min)}` : d.nombre, x, y, { activa, siempre: activa }), id: d.id });
    });
    // flechas
    flechas.forEach((f) => {
      ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.ang);
      ctx.fillStyle = f.activa ? C.laton : rgba(C.laton, 0.85); ctx.strokeStyle = C.noche; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(9, 0); ctx.lineTo(-6, -7); ctx.lineTo(-3, 0); ctx.lineTo(-6, 7); ctx.closePath(); ctx.stroke(); ctx.fill();
      ctx.restore();
    });
    // la cabeza del camino con el tiempo contándose
    if (cabeza && cabeza.e < 1) {
      ctx.fillStyle = C.laton; ctx.beginPath(); ctx.arc(cabeza.x, cabeza.y, 4.5 * gf, 0, Math.PI * 2); ctx.fill();
      chapas.unshift({ ...chapa(`${minTxt(cabeza.min)}`, cabeza.x, cabeza.y, { activa: true, siempre: true, t: 12 }), id: '__cabeza' });
    }
    // rótulos: primero el activo y la cabeza, luego los del grupo, luego las flechas
    chapas.sort((a, b) => (b.opc.activa ? 1 : 0) - (a.opc.activa ? 1 : 0));
    const puestas = ponerChapas(chapas, ocupado);
    puestas.forEach(dibujarChapa);
    // escala gráfica (arriba a la izquierda: abajo la tapan los dedos en el móvil)
    const metros = [500, 1000, 2000, 5000, 10000, 20000, 50000].find((mm) => mm * vista.s > 70) || 50000;
    const lx = metros * vista.s;
    ctx.strokeStyle = rgba(C.arenisca, 0.85); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(14, 18); ctx.lineTo(14, 24); ctx.lineTo(14 + lx, 24); ctx.lineTo(14 + lx, 18); ctx.stroke();
    ctx.fillStyle = rgba(C.arenisca, 0.9); ctx.font = `500 11px ${LETRA}`; ctx.textBaseline = 'alphabetic';
    ctx.fillText(metros >= 1000 ? metros / 1000 + ' km' : metros + ' m', 20 + lx, 27);
    cv.__chapas = puestas.map((p) => ({ id: p.id, r: p.r.map(Math.round), activa: !!p.opc.activa }));
    cv.__flechas = flechas.map((f) => ({ id: f.id, x: Math.round(f.x), y: Math.round(f.y) }));
    cv.__marcas = marcas.map((mm) => ({ id: mm.id, x: Math.round(mm.x), y: Math.round(mm.y) }));
    cv.__vista = { cx: Math.round(vista.cx), cy: Math.round(vista.cy), s: vista.s, grupo };
    cv.__ruta = { id: ruta.id, progreso: ruta.id ? ruta.t : 0 };
  }

  /* ---------- el bucle: solo mientras algo se mueve ---------- */
  function paso(ahora) {
    raf = 0;
    let sigue = false;
    if (viaje) {
      const t = clamp((ahora - viaje.t0) / viaje.dur, 0, 1), e = enMedio(t);
      vista = { cx: viaje.a.cx + (viaje.b.cx - viaje.a.cx) * e, cy: viaje.a.cy + (viaje.b.cy - viaje.a.cy) * e, s: Math.exp(Math.log(viaje.a.s) + (Math.log(viaje.b.s) - Math.log(viaje.a.s)) * e) };
      baseSucia = true;
      if (t >= 1) viaje = null; else sigue = true;
    }
    if (ruta.id && ruta.dur && ahora - ruta.t0 < ruta.dur) sigue = true;
    pintar(ahora);
    if (sigue) raf = requestAnimationFrame(paso);
  }
  const otra = () => { if (!raf) raf = requestAnimationFrame(paso); };
  function irA(v) {
    if (quieto || !W) { viaje = null; vista = v; baseSucia = true; otra(); return; }
    viaje = { a: { ...vista }, b: v, t0: performance.now(), dur: 950 };
    otra();
  }
  function trazar(id) {
    if (!id) { ruta = { id: null, t: 1, t0: 0, dur: 0 }; otra(); return; }
    if (ruta.id === id && ruta.t >= 1) { otra(); return; }
    const d = porId.get(id);
    ruta = { id, t: quieto ? 1 : 0, t0: performance.now(), dur: quieto ? 0 : Math.round(650 + 1100 * Math.sqrt(d.km / 90)) };
    otra();
  }

  /* ---------- lista, filtros y mapa ---------- */
  function ponerFiltro(g, sinViaje) {
    grupo = g;
    filtros.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.grupo === g)));
    tramos.forEach((t) => t.classList.toggle('es-activo', t.dataset.grupo === g));
    const v = encuadre(g);
    if (sinViaje) { vista = v; baseSucia = true; otra(); } else irA(v);
  }
  function decir(id) {
    if (!pista) return;
    const d = id && porId.get(id);
    pista.innerHTML = d ? `<b>${d.nombre}</b>: ${minTxt(d.min)} y ${kmTxt(d.km)} por carretera desde la casa${d.pie ? ` (a pie, ${minTxt(d.pie.minutos)})` : ''}.` : 'Pasa por un sitio de la lista o pulsa en el mapa: sale su camino por carretera desde la casa.';
  }
  function elegir(id) {
    if (!porId.has(id)) return;
    elegida = id;
    botones.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.destino === id)));
    const d = porId.get(id);
    if (d.grupo !== grupo) ponerFiltro(d.grupo);
    trazar(id);
    decir(id);
  }
  function previsualizar(id) {
    sobre = id;
    trazar(id || elegida);
    decir(id || elegida);
  }
  botones.forEach((b) => {
    const id = b.dataset.destino;
    b.addEventListener('click', () => elegir(id));
    b.addEventListener('mouseenter', () => { if (D) previsualizar(id); });
    b.addEventListener('mouseleave', () => { if (D) previsualizar(null); });
    b.addEventListener('focus', () => { if (D) previsualizar(id); });
    b.addEventListener('blur', () => { if (D) previsualizar(null); });
  });
  filtros.forEach((b) => b.addEventListener('click', () => { if (D) ponerFiltro(b.dataset.grupo); }));
  function golpe(x, y) {
    const r = cv.getBoundingClientRect();
    const px = x - r.left, py = y - r.top;
    let mejor = null, dm = 22;
    (cv.__marcas || []).forEach((mm) => { const dd = Math.hypot(mm.x - px, mm.y - py); if (dd < dm) { dm = dd; mejor = mm.id; } });
    if (mejor) return mejor;
    (cv.__flechas || []).forEach((f) => { if (Math.hypot(f.x - px, f.y - py) < 24) mejor = f.id; });
    if (mejor) return mejor;
    (cv.__chapas || []).forEach((c) => { if (c.id !== '__cabeza' && px >= c.r[0] && px <= c.r[2] && py >= c.r[1] && py <= c.r[3]) mejor = c.id; });
    return mejor;
  }

  /* ---------- arrancar ---------- */
  function medir() {
    const w = lamina.clientWidth, h = lamina.clientHeight;
    if (!w || !h) return;
    const cambio = w !== W || h !== H;
    W = w; H = h;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    gf = clamp(W / 1000, 0.66, 1.25) * (W < 520 ? 1.12 : 1);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    base.width = cv.width; base.height = cv.height;
    if (cambio) { viaje = null; vista = encuadre(grupo); }
    baseSucia = true;
    otra();
  }
  function iniciar() {
    D = window.TANES_VALLE;
    if (!D || !lamina) return;
    D.destinos.forEach((d) => {
      porId.set(d.id, d);
      d.acum = [0];
      for (let i = 2; i < d.ruta.length; i += 2) d.acum.push(d.acum[d.acum.length - 1] + Math.hypot(d.ruta[i] - d.ruta[i - 2], d.ruta[i + 1] - d.ruta[i - 1]));
      d.largo = d.acum[d.acum.length - 1];
    });
    [D.agua, D.rios, D.carreteras].forEach((l) => l.forEach((f) => { f.b = cajaDe(f.p); }));
    D.parque = D.parque.map((p) => ({ p, b: cajaDe(p) }));
    cv = document.createElement('canvas');
    cv.setAttribute('role', 'img');
    cv.setAttribute('aria-label', 'Lámina del valle de Caso y del Parque Natural de Redes con La Casa, el embalse de Tanes y los sitios de la lista; el camino del sitio elegido, por carretera desde la casa.');
    ctx = cv.getContext('2d');
    base = document.createElement('canvas');
    bctx = base.getContext('2d');
    lamina.appendChild(cv);
    D.capas.forEach((k) => {
      const im = new Image();
      im.decoding = 'async';
      im.onload = () => { baseSucia = true; otra(); };
      im.src = `img/mapa/relieve-${k.id}.webp`;
      imgs[k.id] = im;
    });
    // el mapa: pasar el ratón enseña, pulsar (o tocar) elige
    cv.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      const id = golpe(e.clientX, e.clientY);
      lamina.classList.toggle('es-sobre', !!id);
      if (id !== sobre) previsualizar(id);
    });
    cv.addEventListener('pointerleave', () => { lamina.classList.remove('es-sobre'); if (sobre) previsualizar(null); });
    cv.addEventListener('click', (e) => { const id = golpe(e.clientX, e.clientY); if (id) elegir(id); });
    filtros.forEach((b) => { b.closest('.filtros').hidden = false; });
    caja.classList.add('es-viva');
    if ('ResizeObserver' in window) new ResizeObserver(medir).observe(lamina);
    medir();
    ponerFiltro('cerca', true);
    lamina.classList.add('es-viva');
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { baseSucia = true; otra(); });
    T.valle = {
      estado: () => ({ grupo, elegida, sobre, vista: { ...vista }, ruta: { id: ruta.id, t: ruta.t }, listo: true }),
      elegir, filtro: (g) => ponerFiltro(g),
    };
    document.dispatchEvent(new CustomEvent('tanes:valle'));
  }
})();
