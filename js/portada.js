/* =====================================================================
   La Casa de Tanes · portada «La Casa» (Tanes.portada)
   Contrato: Tanes.portada.montar(el, { movimiento, densidad, webgl }) → { destruir() }. El HTML de `el` (la escena quieta
   con el rótulo detrás de la casa) es el respaldo: sin JS, con movimiento reducido y en la versión sobria se queda así.
   Con movimiento (y pantalla con alto suficiente):
   - la portada se fija un tramo (--recorrido) y, al bajar, las capas se SEPARAN: cada una escala más que la de detrás
     desde la base de la casa (monte 1 → 1,05; agua → 1,11; casa → 1,2). Como crecen desde ahí, cada capa tapa su propio
     fantasma en la de detrás: no hace falta rellenar nada (ver scripts/portada-capas.py);
   - el rótulo gigante se ENCOGE y viaja hasta el logo de la cabecera; al llegar, se cruza con él (el logo aparece).
   Siempre (también con movimiento reducido): el GESTO de la portada (§5 bis). Arrastrar en horizontal (dedo o ratón)
   desliza el rótulo por detrás del tejado; al soltar vuelve con un muelle (sin muelle si se pide menos movimiento).
   touch-action: pan-y en el marco: el scroll vertical sigue siendo de la página.
   ===================================================================== */
(function () {
  'use strict';
  const T = (window.Tanes = window.Tanes || {});
  const raiz = document.documentElement;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const suave = (t) => t * t * (3 - 2 * t);                 // smoothstep
  const sale = (t) => 1 - Math.pow(1 - t, 3);                 // ease-out cúbica
  const ESCALA = { monte: 0.05, agua: 0.11, casa: 0.2 };

  function montar(el, op) {
    op = op || {};
    const sec = el.closest('.portada');
    const fija = el.closest('.portada__fija');
    const rotulo = el.querySelector('.rotulo');
    const capas = {};
    ['monte', 'agua', 'casa'].forEach((c) => { capas[c] = el.querySelector('.capa--' + c); });
    const logo = document.querySelector('.marca__rotulo');
    if (!sec || !fija || !rotulo || !capas.monte) throw new Error('portada: falta la escena');

    const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const altoOk = () => (innerWidth >= 700 && innerHeight >= 560) || innerHeight >= 700;
    let viva = !!op.movimiento && !quieto && altoOk();
    let recorrido = 0, p = -1, arrastre = 0, base = null, destino = null;
    let rafScroll = 0, rafMuelle = 0;

    /* ---------- medir: dónde está el rótulo sin mover y dónde está el logo ---------- */
    function medir() {
      if (!viva) return;
      recorrido = Math.round((T.web ? T.web.altoVista : innerHeight) * 0.7);
      sec.style.setProperty('--recorrido', recorrido + 'px');
      const t = rotulo.style.transform;
      rotulo.style.transform = 'none';
      const r = rotulo.getBoundingClientRect(), f = fija.getBoundingClientRect();
      rotulo.style.transform = t;
      base = { left: r.left, top: r.top - f.top, width: r.width, height: r.height };
      const l = logo ? logo.getBoundingClientRect() : null;
      destino = l && l.width ? { left: l.left, top: l.top, width: l.width } : null;
      p = -1;
      pintar();
    }

    /* ---------- pintar un fotograma (solo si cambia algo) ---------- */
    function pintar() {
      const q = viva ? clamp(scrollY / Math.max(1, recorrido), 0, 1) : 0;
      const cambio = q !== p;
      p = q;
      if (viva && cambio) {
        const e1 = sale(p);
        for (const c in capas) if (capas[c]) capas[c].style.transform = p > 0 ? `scale(${(1 + ESCALA[c] * e1).toFixed(4)})` : '';
      }
      let tx = arrastre, ty = 0, s = 1, opRot = 1, opLogo = 1;
      if (viva && base && destino) {
        const e = suave(clamp((p - 0.12) / 0.88, 0, 1));
        s = 1 + (destino.width / base.width - 1) * e;
        tx += (destino.left - base.left) * e;
        ty = (destino.top - base.top) * e;
        const k = clamp((p - 0.9) / 0.1, 0, 1);
        opRot = 1 - k; opLogo = k;
      }
      rotulo.style.transform = (tx || ty || s !== 1) ? `translate3d(${tx.toFixed(2)}px, ${ty.toFixed(2)}px, 0) scale(${s.toFixed(4)})` : '';
      rotulo.style.opacity = opRot < 1 ? opRot.toFixed(3) : '';
      if (logo && viva) logo.style.opacity = opLogo.toFixed(3);
    }
    const alScroll = () => { if (!rafScroll) rafScroll = requestAnimationFrame(() => { rafScroll = 0; pintar(); }); };

    /* ---------- el gesto: arrastrar el rótulo por detrás del tejado ---------- */
    let x0 = null, y0 = null, idPuntero = null, horizontal = null;
    const tope = () => (base ? base.width : rotulo.getBoundingClientRect().width) * 0.16;
    function abajo(e) {
      if (e.button !== undefined && e.button !== 0) return;
      if (viva && p > 0.02) return;
      cancelAnimationFrame(rafMuelle);
      x0 = e.clientX - arrastre / 0.7; y0 = e.clientY; idPuntero = e.pointerId; horizontal = null;
    }
    function mueve(e) {
      if (x0 === null || e.pointerId !== idPuntero) return;
      const dx = e.clientX - x0, dy = e.clientY - y0;
      if (horizontal === null && Math.abs(dx - arrastre / 0.7) + Math.abs(dy) > 6) {
        horizontal = Math.abs(dx - arrastre / 0.7) > Math.abs(dy);
        if (horizontal) { try { el.setPointerCapture(e.pointerId); } catch (er) {} el.classList.add('es-arrastre'); }
      }
      if (!horizontal) return;
      const t = tope();
      const v = dx * 0.7;
      arrastre = Math.abs(v) > t ? Math.sign(v) * (t + (Math.abs(v) - t) * 0.25) : v;   // goma al pasar del tope
      pintar();
    }
    function suelta(e) {
      if (x0 === null || (e && e.pointerId !== idPuntero)) return;
      x0 = null; idPuntero = null; el.classList.remove('es-arrastre');
      if (quieto || !op.movimiento) { arrastre = 0; pintar(); return; }
      // muelle con amortiguación crítica de vuelta al sitio
      let v = 0, ult = performance.now();
      const paso = (ahora) => {
        const dt = Math.min(0.05, (ahora - ult) / 1000); ult = ahora;
        const k = 170, c = 2 * Math.sqrt(k) * 0.9;
        v += (-k * arrastre - c * v) * dt;
        arrastre += v * dt;
        if (Math.abs(arrastre) < 0.3 && Math.abs(v) < 2) { arrastre = 0; pintar(); return; }
        pintar();
        rafMuelle = requestAnimationFrame(paso);
      };
      rafMuelle = requestAnimationFrame(paso);
    }
    el.addEventListener('pointerdown', abajo);
    el.addEventListener('pointermove', mueve);
    el.addEventListener('pointerup', suelta);
    el.addEventListener('pointercancel', suelta);
    el.addEventListener('dragstart', (e) => e.preventDefault());

    /* ---------- arrancar ---------- */
    function encender() {
      if (viva) { sec.classList.add('es-viva'); raiz.classList.add('rotulo-en-vuelo'); }
      else { sec.classList.remove('es-viva'); raiz.classList.remove('rotulo-en-vuelo'); if (logo) logo.style.opacity = ''; }
      medir();
      pintar();
    }
    const alResize = () => {
      const antes = viva;
      viva = !!op.movimiento && !quieto && altoOk();
      if (antes !== viva) { for (const c in capas) if (capas[c]) capas[c].style.transform = ''; rotulo.style.transform = ''; rotulo.style.opacity = ''; }
      encender();
    };
    encender();
    addEventListener('scroll', alScroll, { passive: true });
    document.addEventListener('tanes:resize', alResize);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => medir());   // la cabecera cambia de ancho al llegar las letras
    addEventListener('load', medir, { once: true });
    el.dataset.montado = '1';
    sec.dataset.portada = viva ? 'viva' : 'quieta';

    return {
      get progreso() { return p; },
      get viva() { return viva; },
      destruir() {
        removeEventListener('scroll', alScroll);
        document.removeEventListener('tanes:resize', alResize);
        el.removeEventListener('pointerdown', abajo); el.removeEventListener('pointermove', mueve);
        el.removeEventListener('pointerup', suelta); el.removeEventListener('pointercancel', suelta);
        cancelAnimationFrame(rafScroll); cancelAnimationFrame(rafMuelle);
        sec.classList.remove('es-viva'); sec.style.removeProperty('--recorrido'); delete sec.dataset.portada;
        raiz.classList.remove('rotulo-en-vuelo');
        if (logo) logo.style.opacity = '';
        for (const c in capas) if (capas[c]) capas[c].style.transform = '';
        rotulo.style.transform = ''; rotulo.style.opacity = '';
        delete el.dataset.montado;
      },
    };
  }

  T.portada = { montar };
})();
