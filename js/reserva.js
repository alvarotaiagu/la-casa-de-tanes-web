/* =====================================================================
   La Casa de Tanes · reserva.js: el SIMULADOR de fechas (no tienen motor propio; venden por Booking y Airbnb).
   - Marcado como simulado: no reserva, no envía ni guarda NADA (ni localStorage) y no pide datos personales.
   - Calendario propio (dos meses en escritorio, uno en el móvil) con días libres y OCUPADOS INVENTADOS (siempre los
     mismos para una fecha: salen de una cuenta con la fecha, no de su calendario real), personas (1-14) y un resumen
     con el precio orientativo. Supuestos (precio 68/75 €, temporada alta, mínimo de noches) de data/tanes.json, en
     #datos-reserva, y en PENDIENTES.md.
   - La alternativa real, a la vista: llamar al 609 05 34 98 (o buscarla en Booking).
   - Tanes.reserva: { estado, fechas(a, b), ocupado(fecha), cuenta() } para las pruebas.
   ===================================================================== */
(function () {
  'use strict';
  const T = (window.Tanes = window.Tanes || {});
  const $ = (s, c) => (c || document).querySelector(s);
  const $$ = (s, c) => Array.from((c || document).querySelectorAll(s));
  let S = { precioBaja: 68, precioAlta: 75, altaMeses: [6, 7], minNoches: 2, maxPersonas: 14 };
  try { S = Object.assign(S, JSON.parse($('#datos-reserva').textContent)); } catch (e) {}
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const SEM = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  const DIAS_L = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const DIAS_C = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

  const simu = $('#simu');
  const calEl = $('#cal');
  if (!simu || !calEl) return;

  const hoy = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
  const mas = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const igual = (a, b) => !!a && !!b && a.getTime() === b.getTime();
  const noches = (a, b) => Math.round((b - a) / 864e5);
  const dd = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${dd(d.getMonth() + 1)}-${dd(d.getDate())}`;
  const corto = (d) => `${DIAS_C[d.getDay()]} ${d.getDate()} ${MESES[d.getMonth()].slice(0, 3)}`;
  const largo = (d) => `${DIAS_L[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]}`;
  const euros = (n) => n.toLocaleString('es-ES') + ' €';

  // ocupación INVENTADA: una cuenta con la fecha (más ocupado en fin de semana y en temporada alta), siempre igual
  function ocupado(d) {
    let h = (d.getFullYear() * 400 + d.getMonth() * 32 + d.getDate()) >>> 0;
    h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0; h = Math.imul(h ^ (h >>> 13), 3266489909) >>> 0; h = (h ^ (h >>> 16)) >>> 0;
    const finde = d.getDay() === 5 || d.getDay() === 6;
    const umbral = (alta(d) ? 46 : 22) + (finde ? 18 : 0);
    return (h % 100) < umbral;
  }
  const alta = (d) => S.altaMeses.includes(d.getMonth());
  const precio = (d) => (alta(d) ? S.precioAlta : S.precioBaja);

  const estado = { entrada: null, salida: null, espera: 'entrada', sobre: null, personas: 2, aviso: '' };
  const h0 = hoy();
  let ver = new Date(h0.getFullYear(), h0.getMonth(), 1);
  let foco = null;
  const nMeses = () => (matchMedia('(min-width: 700px)').matches ? 2 : 1);
  const libreEntre = (a, b) => { for (let d = new Date(a); d < b; d = mas(d, 1)) if (ocupado(d)) return false; return true; };

  /* ---------------- calendario ---------------- */
  function pintar(enfocar) {
    const h = hoy(), n = nMeses();
    const min = new Date(h.getFullYear(), h.getMonth(), 1);
    const max = new Date(h.getFullYear() + 1, h.getMonth(), 1);
    let html = `<div class="cal__nav"><button type="button" class="cal__flecha" data-nav="-1" aria-label="Mes anterior"${ver <= min ? ' disabled' : ''}><svg class="ico" aria-hidden="true"><use href="#i-flecha-izq"/></svg></button>`
      + `<button type="button" class="cal__flecha" data-nav="1" aria-label="Mes siguiente"${new Date(ver.getFullYear(), ver.getMonth() + n, 1) > max ? ' disabled' : ''}><svg class="ico" aria-hidden="true"><use href="#i-flecha-der"/></svg></button></div>`;
    html += `<div class="cal__meses" style="--meses:${n}">`;
    const f0 = foco || estado.entrada || h;
    for (let m = 0; m < n; m++) {
      const ini = new Date(ver.getFullYear(), ver.getMonth() + m, 1);
      const dias = new Date(ini.getFullYear(), ini.getMonth() + 1, 0).getDate();
      const hueco = (ini.getDay() + 6) % 7;
      html += `<div class="cal__mes"><p class="cal__tit">${MESES[ini.getMonth()]} ${ini.getFullYear()}</p><div class="cal__sem" aria-hidden="true">${SEM.map((x) => `<span>${x}</span>`).join('')}</div><div class="cal__dias">`;
      for (let i = 0; i < hueco; i++) html += '<span></span>';
      for (let i = 1; i <= dias; i++) {
        const d = new Date(ini.getFullYear(), ini.getMonth(), i);
        const pasado = d < h, oc = !pasado && ocupado(d);
        const cl = [igual(d, h) ? 'es-hoy' : '', oc ? 'es-ocupado' : '', !pasado && alta(d) ? 'es-alta' : ''].filter(Boolean).join(' ');
        html += `<button type="button" data-d="${d.getTime()}" data-k="${iso(d)}" tabindex="${igual(d, f0) ? 0 : -1}"${pasado ? ' disabled' : ''}${cl ? ` class="${cl}"` : ''} aria-label="${largo(d)}${igual(d, h) ? ', hoy' : ''}${oc ? ', ocupado (simulado)' : ''}${!pasado && alta(d) ? ', temporada alta' : ''}">${i}</button>`;
      }
      html += '</div></div>';
    }
    html += '</div>';
    calEl.innerHTML = html;
    if (!calEl.querySelector('button[data-d][tabindex="0"]')) { const p = calEl.querySelector('button[data-d]:not([disabled])'); if (p) p.tabIndex = 0; }
    marcar();
    if (enfocar && foco) { const b = calEl.querySelector(`button[data-d="${foco.getTime()}"]`); if (b) { $$('button[data-d]', calEl).forEach((x) => (x.tabIndex = -1)); b.tabIndex = 0; b.focus(); } }
  }
  function marcar() {
    const { entrada, salida, sobre } = estado;
    const fin = salida || (sobre && entrada && sobre > entrada ? sobre : null);
    $$('button[data-d]', calEl).forEach((b) => {
      const d = new Date(+b.dataset.d);
      const ini = igual(d, entrada), ult = igual(d, salida);
      b.classList.toggle('es-ini', ini);
      b.classList.toggle('es-fin', ult || (!salida && igual(d, fin)));
      b.classList.toggle('es-entre', !!(entrada && fin && d > entrada && d < fin));
      b.setAttribute('aria-pressed', String(ini || ult));
    });
  }
  function mover(n, enfocar) {
    const h = hoy();
    const v = new Date(ver.getFullYear(), ver.getMonth() + n, 1);
    if (v < new Date(h.getFullYear(), h.getMonth(), 1) || v > new Date(h.getFullYear() + 1, h.getMonth(), 1)) return;
    ver = v; pintar(enfocar);
  }
  calEl.addEventListener('click', (e) => {
    const nav = e.target.closest('[data-nav]');
    if (nav && !nav.disabled) { mover(+nav.dataset.nav); return; }
    const b = e.target.closest('button[data-d]');
    if (b && !b.disabled) elegir(new Date(+b.dataset.d));
  });
  calEl.addEventListener('pointerover', (e) => {
    const b = e.target.closest('button[data-d]');
    if (!b || estado.espera !== 'salida' || !estado.entrada) return;
    estado.sobre = new Date(+b.dataset.d); marcar();
  });
  calEl.addEventListener('pointerleave', () => { estado.sobre = null; marcar(); });
  calEl.addEventListener('keydown', (e) => {
    const b = e.target.closest('button[data-d]');
    if (!b) return;
    const salto = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
    if (!salto) return;
    e.preventDefault();
    let d = mas(new Date(+b.dataset.d), salto);
    if (d < hoy()) d = hoy();
    foco = d;
    const ultimoVisible = new Date(ver.getFullYear(), ver.getMonth() + nMeses(), 0);
    if (d > ultimoVisible) mover(1, true); else if (d < ver) mover(-1, true); else pintar(true);
  });
  function elegir(d) {
    estado.aviso = '';
    const tocaEntrada = estado.espera === 'entrada' || !estado.entrada || d <= estado.entrada;
    if (tocaEntrada) {
      if (ocupado(d)) { estado.aviso = 'Ese día está ocupado (simulado). Elige otro para llegar.'; foco = d; actualizar(); return; }
      estado.entrada = d; estado.salida = null; estado.espera = 'salida';
    } else {
      // la salida puede ser un día ocupado (se sale por la mañana), pero las noches de en medio tienen que estar libres
      if (!libreEntre(estado.entrada, d)) { estado.aviso = 'Hay noches ocupadas (simuladas) en medio. Elige una salida antes o empieza de nuevo.'; foco = d; actualizar(); return; }
      if (noches(estado.entrada, d) < S.minNoches) { estado.aviso = `Mínimo ${S.minNoches} noches (supuesto). Elige una salida más tarde.`; foco = d; actualizar(); return; }
      estado.salida = d; estado.espera = 'entrada';
    }
    estado.sobre = null; foco = d;
    actualizar();
  }

  /* ---------------- personas ---------------- */
  const paso = $('.paso', simu);
  paso.addEventListener('click', (e) => {
    const b = e.target.closest('[data-acc]');
    if (!b) return;
    estado.personas = Math.min(S.maxPersonas, Math.max(1, estado.personas + (b.dataset.acc === 'mas' ? 1 : -1)));
    actualizar();
  });

  /* ---------------- las cuentas ---------------- */
  function cuenta() {
    const { entrada, salida } = estado;
    if (!(entrada && salida)) return null;
    let total = 0, nAlta = 0;
    for (let d = new Date(entrada); d < salida; d = mas(d, 1)) { total += precio(d); if (alta(d)) nAlta++; }
    const n = noches(entrada, salida);
    return { noches: n, total, nAlta, porNoche: n ? total / n : 0 };
  }
  function actualizar() {
    const { entrada, salida } = estado;
    $$('[data-fecha="entrada"]', simu).forEach((e) => (e.textContent = entrada ? corto(entrada) : 'Elige día'));
    $$('[data-fecha="salida"]', simu).forEach((e) => (e.textContent = salida ? corto(salida) : 'Elige día'));
    const c = cuenta();
    $('[data-noches]', simu).textContent = c ? `${c.noches} ${c.noches === 1 ? 'noche' : 'noches'}` : '';
    let r;
    if (estado.aviso) r = estado.aviso;
    else if (!entrada) r = 'Elige el día de llegada.';
    else if (!salida) r = `Llegada el ${largo(entrada)}. Ahora, el día de salida (mínimo ${S.minNoches} noches).`;
    else r = `Del ${largo(entrada)} al ${largo(salida)}, ${estado.personas} ${estado.personas === 1 ? 'persona' : 'personas'}. En un motor real, aquí se confirmaría la reserva.`;
    $('[data-resumen]', simu).textContent = r;
    $('[data-n-noches]', simu).textContent = c ? String(c.noches) : '0';
    $('[data-precio]', simu).textContent = c ? (c.nAlta && c.nAlta < c.noches ? `de ${S.precioBaja} a ${S.precioAlta} €` : euros(c.nAlta ? S.precioAlta : S.precioBaja)) : `de ${S.precioBaja} a ${S.precioAlta} €`;
    $('[data-total]', simu).textContent = c ? euros(c.total) : 'elige fechas';
    $('[data-valor]', paso).textContent = estado.personas;
    $('[data-acc="menos"]', paso).disabled = estado.personas <= 1;
    $('[data-acc="mas"]', paso).disabled = estado.personas >= S.maxPersonas;
    $('[data-pista]', simu).textContent = estado.personas > 2
      ? `Sois ${estado.personas}. Cuántos caben en cada estudio o apartamento está por confirmar: la casa te dirá cuál encaja (en total, hasta 14).`
      : 'Precio orientativo por estancia y noche.';
    marcar();
  }
  $('[data-supuestos]', simu).textContent = `Supuestos del simulador, por confirmar con la casa: ${S.precioBaja} € la noche en temporada baja y ${S.precioAlta} € en ${S.altaMeses.map((m) => MESES[m]).join(' y ')} (un resumen de Google habla de «alrededor de 68 a 75 € por noche según temporada»), mínimo ${S.minNoches} noches y días ocupados inventados.`;

  let anchoVista = innerWidth;
  addEventListener('resize', () => { if (innerWidth === anchoVista) return; anchoVista = innerWidth; pintar(); });   // la barra del móvil no rehace nada
  pintar();
  actualizar();

  T.reserva = {
    estado, ocupado, cuenta,
    fechas(a, b) { estado.entrada = a ? new Date(a + 'T00:00') : null; estado.salida = b ? new Date(b + 'T00:00') : null; estado.espera = 'entrada'; estado.aviso = ''; if (estado.entrada) ver = new Date(estado.entrada.getFullYear(), estado.entrada.getMonth(), 1); pintar(); actualizar(); },
  };
})();
