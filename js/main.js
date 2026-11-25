/* ------------------------------------------------------------------
   La Casa de Tanes · «La Casa» · lo común de la página (receta de Amaicha)
   - Monta los módulos con su respaldo: la portada (Tanes.portada) al cargar y el 3D (Tanes.lugar, del agente Lugar 3D)
     al acercarse (IntersectionObserver, 900 px). Contrato: Tanes.<mod>.montar(el, { movimiento, densidad, webgl }) →
     { destruir() }. Si un módulo falla, vuelve su respaldo. Si js/lugar.js no está, se queda el respaldo.
   - Cabecera, menú móvil, la carta de colores, el índice de estancias, el visor por NOMBRE, cookies, el mapa a
     petición, el foco con tornillos, el rótulo del pie que se escribe y el mando (?revision).
   - El simulador de fechas va en js/reserva.js.
   ------------------------------------------------------------------ */
(function () {
  'use strict';

  const raiz = document.documentElement;
  const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const motion = !quieto;
  const sobria = () => raiz.classList.contains('densidad-sobria');
  const $ = (s, c) => (c || document).querySelector(s);
  const $$ = (s, c) => Array.from((c || document).querySelectorAll(s));
  const T = (window.Tanes = window.Tanes || {});
  const anno = $('#anno');
  if (anno) anno.textContent = new Date().getFullYear();

  // el resize de la barra del móvil (mismo ancho, poca altura) no rehace NADA (checklist punto 10)
  let anchoVista = innerWidth, altoVista = innerHeight;
  const esBarra = () => innerWidth === anchoVista && Math.abs(innerHeight - altoVista) < 160;
  T.web = { get altoVista() { return altoVista; } };

  /* ============ 1. titulares que aparecen (solo con movimiento; se observa el CONTENEDOR, checklist 13) ============ */
  const titulares = $$('[data-aparece]');
  if (motion && 'IntersectionObserver' in window) {
    const deCaja = new Map();
    titulares.forEach((h) => { const c = h.parentElement || h; if (!deCaja.has(c)) deCaja.set(c, []); deCaja.get(c).push(h); });
    const vistos = new IntersectionObserver((es) => es.forEach((e) => {
      if (e.isIntersecting) { (deCaja.get(e.target) || []).forEach((h) => h.classList.add('es-visto')); vistos.unobserve(e.target); }
    }), { rootMargin: '0px 0px -6% 0px' });
    deCaja.forEach((_, c) => vistos.observe(c));
    raiz.classList.add('con-movimiento');
  } else titulares.forEach((h) => h.classList.add('es-visto'));

  /* ============ 2. ir a un sitio ============ */
  const cabAlto = () => parseFloat(getComputedStyle(raiz).getPropertyValue('--cabecera')) || 68;
  const irA = (sel) => {
    const el = typeof sel === 'string' ? $(sel) : sel;
    if (!el) return;
    const y = el.id === 'portada' ? 0 : el.getBoundingClientRect().top + scrollY - cabAlto() - 8;
    scrollTo({ top: Math.max(0, y), behavior: quieto || sobria() ? 'auto' : 'smooth' });
  };

  /* ============ 3. cabecera: fondo al bajar (pasada la portada viva) y el enlace de la sección que se ve ============ */
  const cab = $('#cab');
  const portada = $('#portada');
  const enlaces = $$('.cab__nav a');
  const secciones = enlaces.map((a) => $(a.getAttribute('href'))).filter(Boolean);
  let actual = null;
  function pintarCabecera() {
    const viva = portada && portada.classList.contains('es-viva');
    const umbral = viva ? (parseFloat(portada.style.getPropertyValue('--recorrido')) || altoVista * 0.7) - 2 : 24;
    cab.classList.toggle('sc', scrollY > umbral);
    const y = cabAlto() + altoVista * 0.25;
    let sec = null;
    for (const s of secciones) { const r = s.getBoundingClientRect(); if (r.top <= y && r.bottom > y) sec = s; }
    if (sec !== actual) {
      actual = sec;
      enlaces.forEach((a) => { if (sec && a.getAttribute('href') === '#' + sec.id) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current'); });
    }
  }

  /* ============ 4. módulos: portada (al cargar) y lugar (al acercarse) ============ */
  const montados = new Map();
  const esperando = new Set();
  const modulo = (el) => { const m = T[el.dataset.modulo]; return m && typeof m.montar === 'function' ? m : null; };
  const opciones = () => ({ movimiento: motion && !sobria(), densidad: sobria() ? 'sobria' : 'la-casa', webgl: !raiz.classList.contains('sin-webgl') });
  function montarModulo(el) {
    if (montados.has(el)) return;
    const mod = modulo(el);
    if (!mod) { esperando.add(el); return; }
    esperando.delete(el);
    const respaldo = el.innerHTML;
    try {
      const inst = mod.montar(el, opciones());
      montados.set(el, { inst, respaldo });
      if (inst && inst.listo && typeof inst.listo.catch === 'function') inst.listo.catch((er) => { console.warn('Módulo ' + el.dataset.modulo + ': se queda el respaldo', er); el.innerHTML = respaldo; delete el.dataset.montado; });
    } catch (er) {
      console.warn('Módulo ' + el.dataset.modulo + ': se queda el respaldo', er);
      el.innerHTML = respaldo;
      montados.set(el, { inst: null, respaldo });
    }
  }
  const reintentar = () => { if (esperando.size) [...esperando].forEach(montarModulo); };
  addEventListener('load', reintentar);
  function remontarTodos() {
    [...montados].forEach(([el, { inst, respaldo }]) => {
      try { inst && inst.destruir && inst.destruir(); } catch (er) { console.warn(er); }
      el.innerHTML = respaldo;
      delete el.dataset.montado;
      montados.delete(el);
      montarModulo(el);
    });
  }
  const portadaMod = $('#portada [data-modulo="portada"]');
  if (portadaMod) montarModulo(portadaMod);
  if (!portada || !portada.classList.contains('es-viva')) raiz.classList.remove('rotulo-en-vuelo');
  const resto = $$('[data-modulo]').filter((el) => el !== portadaMod);
  if ('IntersectionObserver' in window) {
    const ioMod = new IntersectionObserver((es) => es.forEach((e) => {
      if (e.isIntersecting) { ioMod.unobserve(e.target); montarModulo(e.target); }
    }), { rootMargin: '900px 0px' });
    resto.forEach((el) => ioMod.observe(el));
  } else resto.forEach(montarModulo);
  // los clics dentro del 3D montado son del módulo
  const deModulo = (t) => !!t.closest('[data-modulo="lugar"][data-montado]');

  /* ============ 5. menú ============ */
  const btnMenu = $('#menu-btn'), menu = $('#menu-movil');
  const cerrarMenu = () => {
    document.body.classList.remove('menu');
    btnMenu.setAttribute('aria-expanded', 'false');
    menu.setAttribute('aria-hidden', 'true');
  };
  btnMenu.addEventListener('click', () => {
    const abierto = document.body.classList.toggle('menu');
    btnMenu.setAttribute('aria-expanded', String(abierto));
    menu.setAttribute('aria-hidden', String(!abierto));
  });
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && document.body.classList.contains('menu')) { cerrarMenu(); btnMenu.focus(); } });

  /* ============ 6. enlaces internos ============ */
  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || deModulo(e.target)) return;
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const destino = a.getAttribute('href');
    if (destino.length < 2 || !$(destino)) return;
    e.preventDefault();
    cerrarMenu();
    irA(destino);
    setTimeout(() => {
      const t = $(destino);
      if (!t.hasAttribute('tabindex')) t.setAttribute('tabindex', '-1');
      t.focus({ preventScroll: true });
    }, 900);
  });

  /* ============ 7. la carta de colores: la tira elegida se ensancha (contenido: también con movimiento reducido) ============ */
  const chips = $$('.chip');
  const carta = $('.carta__lista');
  function abrirChip(ch) {
    chips.forEach((c) => {
      const si = c === ch;
      c.classList.toggle('es-abierta', si);
      const b = $('.chip__boton', c);
      if (b) b.setAttribute('aria-expanded', String(si));
    });
  }
  chips.forEach((ch) => {
    const b = $('.chip__boton', ch);
    if (b) b.addEventListener('click', () => abrirChip(ch));
    ch.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse' && matchMedia('(min-width: 700px)').matches) abrirChip(ch); });
  });
  // en el móvil la carta desborda en horizontal: solo entonces es una parada del tabulador
  function cartaFoco() {
    if (!carta) return;
    const desborda = carta.scrollWidth > carta.clientWidth + 2;
    if (desborda) { carta.setAttribute('tabindex', '0'); carta.setAttribute('role', 'group'); carta.setAttribute('aria-label', 'Colores de las estancias (desliza en horizontal)'); }
    else { carta.removeAttribute('tabindex'); carta.removeAttribute('role'); carta.removeAttribute('aria-label'); }
  }
  cartaFoco();

  /* ============ 8. la casa por estancias: el índice marca la que se ve ============ */
  const indice = $$('.estancias__indice a');
  if (indice.length && 'IntersectionObserver' in window) {
    const marcar = (id) => indice.forEach((a) => {
      if (a.dataset.est === id) {
        a.setAttribute('aria-current', 'true');
        const ol = a.closest('.estancias__indice');
        if (ol && ol.scrollWidth > ol.clientWidth) ol.scrollTo({ left: a.offsetLeft - 16, behavior: quieto ? 'auto' : 'smooth' });
      } else a.removeAttribute('aria-current');
    });
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) marcar(e.target.id.replace('est-', '')); }), { rootMargin: '-35% 0px -60% 0px' });
    $$('.estancia').forEach((s) => io.observe(s));
  }

  /* ============ 9. cookies (y el mando se aparta mientras están) ============ */
  const ck = $('#cookies');
  const LLAVE = 'tanes-cookies';
  const leer = () => { try { return localStorage.getItem(LLAVE); } catch (e) { return null; } };
  const guardar = (v) => { try { localStorage.setItem(LLAVE, v); } catch (e) {} };
  const mando = $('#mando');
  const verMando = () => { if (mando && raiz.classList.contains('revision')) mando.hidden = !ck.hidden; };
  const cerrarCk = (v) => { guardar(v); ck.hidden = true; verMando(); };
  $('#ck-si').addEventListener('click', () => cerrarCk('si'));
  $('#ck-no').addEventListener('click', () => cerrarCk('no'));
  $('#abrir-cookies').addEventListener('click', () => { ck.hidden = false; verMando(); $('#ck-si').focus(); });
  if (!leer()) ck.hidden = false;
  verMando();

  /* ============ 10. mapa de Google solo al pedirlo (sin clave de API) ============ */
  $('#mapa-btn').addEventListener('click', () => {
    const marco = document.createElement('iframe');
    const q = $('#mapa').dataset.q || 'Apartamentos La Casa de Tanes, Tanes 9, 33994 Caso, Asturias';
    marco.src = 'https://www.google.com/maps?q=' + encodeURIComponent(q) + '&z=14&output=embed';
    marco.loading = 'lazy';
    marco.title = 'Mapa con La Casa de Tanes, en Tanes (Caso)';
    marco.referrerPolicy = 'no-referrer-when-downgrade';
    $('#mapa').appendChild(marco);
    $('#mapa-btn').remove();
  });

  /* ============ 11. visor de fotos: se abre por el NOMBRE de la foto (checklist 11) ============ */
  const visor = $('#visor');
  const vImg = $('#visor-img'), vPie = $('#visor-pie'), vN = $('#visor-n');
  function infoFoto(n) {
    const img = $('picture[data-foto="' + n + '"] img');
    let anchos = [800], ancho = 1600, alto = 1200, alt = '';
    if (img) {
      const a = (img.getAttribute('srcset') || '').split(',').map((x) => parseInt(x.trim().split(/\s+/)[1], 10)).filter(Boolean).sort((p, q) => p - q);
      if (a.length) anchos = a;
      ancho = +img.getAttribute('width') || ancho; alto = +img.getAttribute('height') || alto;
      alt = img.alt;
    }
    return { n, alt, anchos, ancho, alto };
  }
  let lista = [], actualV = 0, origen = null;
  function poner(i) {
    actualV = (i + lista.length) % lista.length;
    const f = lista[actualV];
    const peq = f.anchos.includes(800) ? 800 : f.anchos[0];
    const gran = f.anchos.filter((w) => w <= 1920).pop() || f.anchos[f.anchos.length - 1];
    // primero la de 800 (ya en caché o ligera) y la grande al cargar
    vImg.src = `img/fotos/${f.n}-${peq}.jpg`;
    vImg.dataset.nombre = f.n;
    vImg.alt = f.alt;
    vImg.width = f.ancho; vImg.height = f.alto;
    if (gran !== peq) {
      const grande = new Image();
      grande.onload = () => { if (vImg.dataset.nombre === f.n) vImg.src = grande.src; };
      grande.src = `img/fotos/${f.n}-${gran}.jpg`;
    }
    vPie.textContent = f.alt;
    vN.textContent = (actualV + 1) + ' / ' + lista.length;
  }
  function abrirVisor(nombres, nombre, desde) {
    if (!visor || typeof visor.showModal !== 'function') return;
    const vistos = new Set();
    lista = [];
    (nombres || []).forEach((n) => { if (!n || vistos.has(n)) return; vistos.add(n); lista.push(infoFoto(n)); });
    if (!lista.length) return;
    let i = lista.findIndex((f) => f.n === nombre);
    if (i < 0) i = 0;
    origen = desde || document.activeElement;
    poner(i);
    if (!visor.open) visor.showModal();
  }
  T.visor = { abrir: (l, n) => abrirVisor(l, n) };
  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || deModulo(e.target)) return;
    const b = e.target.closest('[data-visor]');
    if (!b) return;
    const g = b.getAttribute('data-grupo');
    const botones = g ? $$('[data-visor][data-grupo="' + g + '"]') : [b];
    abrirVisor(botones.map((x) => x.dataset.visor), b.dataset.visor, b);
  });
  if (visor) {
    $('#visor-ant').addEventListener('click', () => poner(actualV - 1));
    $('#visor-sig').addEventListener('click', () => poner(actualV + 1));
    $('#visor-cerrar').addEventListener('click', () => visor.close());
    visor.addEventListener('click', (e) => { if (e.target === visor || e.target.classList.contains('visor__fig')) visor.close(); });
    visor.addEventListener('keydown', (e) => { if (e.key === 'ArrowLeft') poner(actualV - 1); else if (e.key === 'ArrowRight') poner(actualV + 1); });
    visor.addEventListener('close', () => { if (origen && document.contains(origen)) origen.focus({ preventScroll: true }); });
  }

  /* ============ 12. el foco del teclado: contorno de 2 px + cuatro tornillos en las esquinas ============ */
  const marco = $('#foco-tornillos');
  let enfocado = null;
  function ponerMarco() {
    if (!marco) return;
    const el = enfocado;
    if (!el || !document.contains(el) || el.closest('dialog')) { marco.classList.remove('es-visible'); return; }
    const r = el.getBoundingClientRect();
    if (!r.width) { marco.classList.remove('es-visible'); return; }
    const fijo = !!el.closest('.cab, .cookies, .mando, .menu-movil, .saltar, .estancias__indice, .portada.es-viva .portada__fija');
    const m = 9;   // los tornillos, 9 px por fuera de cada esquina (el contorno va a 4 px)
    const w = Math.round(r.width + 2 * m), h = Math.round(r.height + 2 * m);
    marco.classList.toggle('es-fijo', fijo);
    marco.style.left = (r.left - m + (fijo ? 0 : scrollX)) + 'px';
    marco.style.top = (r.top - m + (fijo ? 0 : scrollY)) + 'px';
    marco.style.width = w + 'px'; marco.style.height = h + 'px';
    marco.setAttribute('viewBox', `0 0 ${w} ${h}`);
    const c = marco.querySelectorAll('circle');
    [[4, 4], [w - 4, 4], [w - 4, h - 4], [4, h - 4]].forEach(([x, y], i) => { c[i].setAttribute('cx', x); c[i].setAttribute('cy', y); c[i].setAttribute('r', 3.2); });
    marco.style.color = getComputedStyle(el).getPropertyValue('--foco').trim() || '#B4A380';
    marco.classList.add('es-visible');
  }
  let tFoco = 0;
  const mirarFoco = () => {
    clearTimeout(tFoco);
    tFoco = setTimeout(() => {
      const el = document.activeElement;
      let visible = false;
      try { visible = !!el && el !== document.body && el.matches(':focus-visible'); } catch (er) {}
      enfocado = visible ? el : null;
      ponerMarco();
    }, 0);
  };
  document.addEventListener('focusin', mirarFoco);
  document.addEventListener('focusout', mirarFoco);

  /* ============ 13. el pie: el rótulo se escribe entero al llegar (con movimiento reducido, ya escrito) ============ */
  const pieLetras = $('.pie__letras');
  if (pieLetras) {
    if (motion && !sobria() && 'IntersectionObserver' in window) {
      const io = new IntersectionObserver((es) => { if (es[0].isIntersecting) { pieLetras.classList.add('es-escrita'); io.disconnect(); } }, { rootMargin: '0px 0px -10% 0px' });
      io.observe(pieLetras);
    } else pieLetras.classList.add('es-escrita');
  }

  /* ============ 14. con el scroll (un rAF por fotograma, pasivo): cabecera, módulos que esperan y el foco fijo ============ */
  let pend = 0;
  function alScroll() {
    pend = 0;
    pintarCabecera();
    reintentar();
    if (enfocado && marco && marco.classList.contains('es-fijo')) ponerMarco();
  }
  addEventListener('scroll', () => { if (!pend) pend = requestAnimationFrame(alScroll); }, { passive: true });
  alScroll();

  /* ============ 15. MANDO DE MAQUETA (no viaja al cliente) ============ */
  if (mando && raiz.classList.contains('revision')) {
    const botones = $$('button[data-densidad]', mando);
    const pintarMando = () => botones.forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.densidad === 'sobria') === sobria())));
    botones.forEach((b) => b.addEventListener('click', () => {
      const antes = sobria();
      raiz.classList.toggle('densidad-sobria', b.dataset.densidad === 'sobria');
      const u = new URL(location.href);
      if (b.dataset.densidad === 'sobria') u.searchParams.set('densidad', 'sobria'); else u.searchParams.delete('densidad');
      history.replaceState(null, '', u);
      pintarMando();
      if (antes === sobria()) return;
      if (sobria() && pieLetras) pieLetras.classList.add('es-escrita');
      remontarTodos();
      if (!portada.classList.contains('es-viva')) raiz.classList.remove('rotulo-en-vuelo');
      alScroll();
      document.dispatchEvent(new CustomEvent('tanes:densidad', { detail: sobria() ? 'sobria' : 'la-casa' }));
    }));
    pintarMando();
    verMando();
  }
  /* fin del MANDO DE MAQUETA */

  /* ============ 16. resize de verdad (no el de la barra del móvil) ============ */
  let tRes = 0;
  addEventListener('resize', () => {
    if (esBarra()) return;
    clearTimeout(tRes);
    tRes = setTimeout(() => {
      anchoVista = innerWidth; altoVista = innerHeight;
      document.dispatchEvent(new CustomEvent('tanes:resize'));
      cartaFoco();
      alScroll();
      ponerMarco();
    }, 200);
  });

  // recargar a media página: se entra arriba (checklist 12; la portada va fijada un tramo)
  addEventListener('pageshow', () => { if (!location.hash && scrollY > 0) scrollTo(0, 0); });

  // lo que pueden usar los módulos y las pruebas
  Object.assign(T.web, { motion, quieto, sobria, irA, montados });
  document.dispatchEvent(new CustomEvent('tanes:web'));
})();
