/* Genera las páginas a partir de sus fuentes *.src.html (la arquitectura de Amaicha, Casa Benito y A Palleira):
   1. <!--parte:partes/archivo.html--> → el contenido de ese archivo (si falta, un comentario y la web sigue).
   2. Una sola fuente de datos, data/tanes.json (de ref/DATOS-TANES.md): <!--cifras-->, <!--colores-->, <!--servicios-->,
      <!--condiciones-->, <!--vistazo--> (solo en la versión sobria), <!--estancias-->, <!--resenas--> y {{RESERVA}}.
   3. <!--alrededor--> y <!--llegar-->: las distancias de ref/raw/rutas.json (OSRM, scripts/alrededor-rutas.mjs). Sin el
      fichero no se escribe ninguna cifra.
   4. La portada: <!--portada-escena--> (las tres capas de img/portada/ y el rótulo de marca/rotulo.json colocado según
      data/portada.json) y <!--precarga-portada--> (la capa «monte», que es el LCP). <!--rotulo-logo--> y <!--rotulo-pie-->.
   5. <img data-foto="nombre" ...> → <picture> con AVIF, WebP y JPG en todos los anchos de img/fotos/fotos.json (el alt,
      de scripts/fotos-lista.json si la etiqueta no trae uno).
   6. Los <link>/<script> de CSS/JS propios que no existen se quitan con un aviso, SALVO los del 3D (css/lugar.css y
      js/lugar.js, del agente Lugar 3D): esos se dejan siempre, para que en cuanto existan se carguen sin reconstruir.
   7. Ejecuta versionar.mjs (?v=<huella> en CSS y JS).
   Se edita SIEMPRE el *.src.html (o la parte); el .html generado se sobrescribe. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const RAIZ = path.dirname(fileURLToPath(import.meta.url));
const leerJson = (f) => JSON.parse(fs.readFileSync(path.join(RAIZ, f), 'utf8'));
const FOTOS = new Map(leerJson('img/fotos/fotos.json').map((f) => [f.nombre, f]));
const D = leerJson('data/tanes.json');
const P = leerJson('data/portada.json');
const R = leerJson('marca/rotulo.json');
const PI = leerJson('img/portada/portada.json');
const num = (n) => String(n).replace('.', ',');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const pct = (v) => (Math.round(v * 10000) / 100) + '%';

/* ---------- fotos ---------- */
function picture(atrs) {
  const nombre = /data-foto="([^"]+)"/.exec(atrs)[1];
  const f = FOTOS.get(nombre);
  if (!f) throw new Error('Foto desconocida: ' + nombre);
  const set = (ext) => f.anchos.map((w) => `img/fotos/${nombre}-${w}.${ext} ${w}w`).join(', ');
  const sizes = (/\bsizes="([^"]+)"/.exec(atrs) || [, '100vw'])[1];
  const base = f.anchos.includes(800) ? 800 : f.anchos[f.anchos.length - 1];
  let resto = atrs.replace(/\s*data-foto="[^"]+"/, '').replace(/\s*\bsizes="[^"]+"/, '');
  if (!/\balt=/.test(resto)) resto = ` alt="${esc(f.alt)}"` + resto;
  if (!/\bloading=/.test(resto) && !/fetchpriority="high"/.test(resto)) resto += ' loading="lazy"';
  if (!/\bdecoding=/.test(resto)) resto += ' decoding="async"';
  return `<picture data-foto="${nombre}">`
    + `<source type="image/avif" srcset="${set('avif')}" sizes="${sizes}">`
    + `<source type="image/webp" srcset="${set('webp')}" sizes="${sizes}">`
    + `<img src="img/fotos/${nombre}-${base}.jpg" srcset="${set('jpg')}" sizes="${sizes}" width="${f.ancho}" height="${f.alto}"${resto}>`
    + `</picture>`;
}
const razon = (n) => { const f = FOTOS.get(n); if (!f) throw new Error('Foto desconocida: ' + n); return (f.ancho / f.alto).toFixed(3); };
const altDe = (n) => FOTOS.get(n).alt;

/* ---------- la portada: tres capas + el rótulo ---------- */
// móvil y vertical: el marco mide 56svh de alto → la escena, 84vh de ancho; si no, la escena cubre la pantalla
const SIZES_PORTADA = '(max-width: 699px) 84vh, (max-aspect-ratio: 1/1) 84vh, (max-aspect-ratio: 3/2) 150vh, 100vw';
const setCapa = (c, ext) => PI.anchos.slice().sort((a, b) => a - b).map((w) => `img/portada/${c}-${w}.${ext} ${w}w`).join(', ');
function capa(c, alt, lcp) {
  const img = lcp
    ? `<img src="img/portada/${c}-1500.jpg" srcset="${setCapa(c, 'jpg')}" sizes="${SIZES_PORTADA}" width="${PI.ancho}" height="${PI.alto}" alt="${esc(alt)}" fetchpriority="high" loading="eager">`
    : `<img src="img/portada/${c}-1500.webp" sizes="${SIZES_PORTADA}" width="${PI.ancho}" height="${PI.alto}" alt="" loading="eager" decoding="async">`;
  return `        <picture class="capa capa--${c}"${lcp ? '' : ' aria-hidden="true"'}>`
    + `<source type="image/avif" srcset="${setCapa(c, 'avif')}" sizes="${SIZES_PORTADA}">`
    + `<source type="image/webp" srcset="${setCapa(c, 'webp')}" sizes="${SIZES_PORTADA}">`
    + (lcp ? img : img.replace('src=', `srcset="${setCapa(c, 'webp')}" src=`)) + `</picture>`;
}
const D_ROTULO = R.glifos.map((g) => g.d).join('');
function rotuloPortada() {
  const pos = (r) => [pct(r.x / P.foto.ancho), pct(r.y / P.foto.alto), pct(r.ancho / P.foto.ancho)];
  const [x, y, w] = pos(P.escritorio.rotulo), [xm, ym, wm] = pos(P.movil.rotulo);
  const k = P.escritorio.rotulo.ancho / R.ancho;
  const canto = (Math.max(3, P.escritorio.rotulo.ancho * 0.0045) / k).toFixed(1);   // grosor del metal (unidades del rótulo)
  return `        <svg class="rotulo" viewBox="${R.viewBox}" style="--x:${x};--y:${y};--w:${w};--xm:${xm};--ym:${ym};--wm:${wm}" aria-hidden="true" focusable="false">`
    + `<defs><linearGradient id="g-laton" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${P.laton.luz}"/><stop offset=".55" stop-color="${P.laton.medio}"/><stop offset="1" stop-color="${P.laton.canto}"/></linearGradient></defs>`
    + `<path class="rotulo__canto" fill="${P.laton.canto}" transform="translate(${canto} ${canto})" d="${D_ROTULO}"/>`
    + `<path class="rotulo__cara" fill="url(#g-laton)" d="${D_ROTULO}"/></svg>`;
}
function portadaEscena() {
  const e = P.escritorio, m = P.movil;
  const [ox, oy] = P.origen;
  return `      <div class="escena" style="--fx:${e.fx};--fy:${e.fy};--fxm:${m.fx};--fym:${m.fy};--ox:${pct(ox / P.foto.ancho)};--oy:${pct(oy / P.foto.alto)}">\n`
    + capa('monte', 'La casona de piedra de La Casa de Tanes, con su galería de madera y su jardín, sobre el embalse y con las peñas de Redes detrás', true) + '\n'
    + rotuloPortada() + '\n'
    + capa('agua') + '\n'
    + capa('casa') + '\n'
    + `      </div>`;
}
const precarga = () => `<link rel="preload" as="image" type="image/avif" imagesrcset="${setCapa('monte', 'avif')}" imagesizes="${SIZES_PORTADA}" fetchpriority="high">`;
const rotuloLogo = () => `<svg class="marca__rotulo" viewBox="${R.viewBox}" aria-hidden="true" focusable="false"><path fill="currentColor" d="${D_ROTULO}"/></svg>`;
const rotuloPie = () => `      <svg class="pie__letras" viewBox="${R.viewBox}" aria-hidden="true" focusable="false">`
  + `<defs><linearGradient id="g-laton-pie" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${P.laton.luz}"/><stop offset=".6" stop-color="${P.laton.medio}"/><stop offset="1" stop-color="${P.laton.canto}"/></linearGradient></defs>`
  + R.glifos.map((g, i) => `<path class="pl" style="--i:${i}" pathLength="1" d="${g.d}"/>`).join('') + `</svg>`;

/* ---------- cada una con su color ---------- */
const cifras = () => `    <dl class="cifras">
${D.cifras.map((c) => `      <div class="cifras__i"><dt>${esc(c.t)}</dt><dd class="cifra">${esc(c.n)}</dd></div>`).join('\n')}
    </dl>
    <p class="cifras__nota">Viajeros y dormitorios, según su ficha de Airbnb (por confirmar con la casa). Todas las estancias, orientadas al sur.</p>`;
function colores() {
  return `    <div class="carta" role="group" aria-label="Los colores de las estancias">
      <ul class="carta__lista">
${D.colores.map((c, i) => `        <li class="chip${i === 0 ? ' es-abierta' : ''}" style="--c:${c.hex}" data-color="${c.id}">
          <button type="button" class="chip__boton" aria-expanded="${i === 0}" aria-controls="chip-${c.id}"><span class="chip__muestra" aria-hidden="true"></span><span class="chip__nombre">${esc(c.nombre)}</span><span class="chip__hex cifra">${c.hex}</span></button>
          <div class="chip__cuerpo" id="chip-${c.id}">
            <button type="button" class="foto-btn chip__f" data-visor="${c.foto}" data-grupo="colores" aria-label="Ver más grande: ${esc(altDe(c.foto))}"><img data-foto="${c.foto}" sizes="(max-width: 699px) 80vw, 40vw"></button>
            <p class="chip__txt">${esc(c.texto)}</p>
          </div>
        </li>`).join('\n')}
      </ul>
    </div>
    <p class="carta__nota">Cada estancia tiene su color. Cuál es cuál, y cómo se llama cada una, por confirmar con la casa.</p>`;
}
const servicios = () => `      <div class="servicios">
${D.servicios.map((g) => `        <section class="servicios__g" aria-labelledby="sv-${g.grupo.toLowerCase().replace(/[^a-z]+/g, '-')}">
          <h3 class="ficha__h" id="sv-${g.grupo.toLowerCase().replace(/[^a-z]+/g, '-')}">${esc(g.grupo)}</h3>
          <ul class="servicios__lista">
${g.lista.map((s) => `            <li><svg class="ico" aria-hidden="true"><use href="#i-${s.icono}"/></svg><b>${esc(s.nombre)}</b>${s.detalle ? `<span>${esc(s.detalle)}</span>` : ''}</li>`).join('\n')}
          </ul>
        </section>`).join('\n')}
      </div>`;
const condiciones = () => `      <aside class="condiciones" aria-labelledby="t-condiciones">
        <h3 class="ficha__h" id="t-condiciones">Condiciones</h3>
        <dl>
${D.condiciones.map((c) => `          <div><dt>${esc(c.t)}</dt><dd><b class="${c.t === 'Registro' ? 'cifra' : ''}">${esc(c.v)}</b>${c.d ? `<span>${esc(c.d)}</span>` : ''}</dd></div>`).join('\n')}
        </dl>
        <p><a class="btn btn--acento" href="#reservar">Ver fechas</a></p>
      </aside>`;
function vistazo() {
  const filas = [
    ['Viajeros', '14, según Airbnb (por confirmar)'], ['Dormitorios', '5, según Airbnb (por confirmar)'],
    ['Estancias', 'Estudios y apartamentos (cuántos, por confirmar)'], ['Cocina', 'Equipada, en cada estancia'],
    ['Baño', 'Propio, con ducha, en cada estancia'], ['Orientación', 'Al sur, con vistas a la montaña y al embalse'],
    ['Entrada', 'De 15:00 a 21:00, autónoma'], ['Salida', 'De 08:00 a 11:00'], ['Mascotas', 'Se admiten'],
    ['Wi-Fi y aparcamiento', 'Gratis'], ['Registro', 'AT 1490 AS'],
  ];
  return `    <div class="vistazo" id="vistazo">
      <h3 class="vistazo__tit">La casa, de un vistazo</h3>
      <table class="vistazo__tabla">
        <caption class="vh">Datos de La Casa de Tanes</caption>
        <tbody>
${filas.map(([h, v]) => `          <tr><th scope="row">${h}</th><td>${esc(v)}</td></tr>`).join('\n')}
        </tbody>
      </table>
    </div>`;
}

/* ---------- todo mira al sur: estancias ---------- */
function estancias() {
  const ind = `    <nav class="estancias__indice" aria-label="Estancias de la casa">
      <ol>
${D.estancias.map((e, i) => `        <li><a href="#est-${e.id}" data-est="${e.id}"${i === 0 ? ' aria-current="true"' : ''}><span class="estancias__largo">${esc(e.nombre)}</span><span class="estancias__corto" aria-hidden="true">${esc(e.corto)}</span><span class="estancias__n cifra" aria-hidden="true">${e.fotos.length}</span></a></li>`).join('\n')}
      </ol>
    </nav>`;
  const grupos = D.estancias.map((e) => `      <section class="estancia estancia--${e.id}" id="est-${e.id}" aria-labelledby="t-est-${e.id}">
        <h3 class="estancia__tit" id="t-est-${e.id}">${esc(e.nombre)}</h3>
        <p class="estancia__txt">${esc(e.texto)}</p>
        <div class="filas">
${e.fotos.map((f) => `          <figure class="foto" style="--r:${razon(f)}"><button type="button" class="foto-btn" data-visor="${f}" data-grupo="casa" aria-label="Ver más grande: ${esc(altDe(f))}"><img data-foto="${f}" sizes="(max-width: 699px) 92vw, (max-width: 1099px) 46vw, 30vw"></button></figure>`).join('\n')}
        </div>
      </section>`).join('\n');
  return `    <div class="estancias-casa">\n${ind}\n      <div class="estancias__grupos">\n${grupos}\n      </div>\n    </div>`;
}

/* ---------- reseñas ---------- */
function resenas() {
  const n = (r) => `      <div class="nota">
        <p class="nota__n" aria-hidden="true"><span class="cifra">${r.nota}</span><span class="nota__sobre">/ ${r.sobre}</span></p>
        <p class="nota__dato"><span class="vh">${r.nota} sobre ${r.sobre}, </span>con <span class="cifra">${r.recuento}</span> reseñas en ${r.etiqueta}</p>
        <p><a class="enlace-flecha" href="${esc(r.url)}" target="_blank" rel="noopener">Leerlas en ${r.etiqueta}<span class="vh"> (se abre en otra pestaña)</span><svg class="ico" aria-hidden="true"><use href="#i-flecha-der"/></svg></a></p>
      </div>`;
  return `    <h2 id="t-resenas" class="sec-tit resenas__tit" data-aparece>Lo que dicen quienes han estado</h2>
    <div class="notas">
${n(D.resenas.booking)}
${n(D.resenas.google)}
    </div>`;
}

/* ---------- alrededor (ref/raw/rutas.json) ---------- */
function leerRutas() { const f = path.join(RAIZ, 'ref/raw/rutas.json'); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null; }
const tiempo = (m) => (m >= 60 ? Math.floor(m / 60) + ' h ' + String(m % 60).padStart(2, '0') + ' min' : m + ' min');
const km = (v) => (v < 1 ? Math.round(v * 1000) + ' m' : num(Math.round(v * 10) / 10) + ' km');
const GRUPOS = [['cerca', 'En el valle'], ['redes', 'Por Redes'], ['lejos', 'Para llegar']];
function alrededor() {
  const R2 = leerRutas();
  if (!R2) { console.warn('  (sin ref/raw/rutas.json: «Redes alrededor» va sin distancias)'); return '    <p class="alrededor__fino" data-sin-rutas>Las distancias por carretera están por calcular.</p>'; }
  const fecha = new Date(R2.fecha).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
  const cols = GRUPOS.map(([g, tit]) => {
    const ids = R2.llegar.filter((id) => R2.destinos[id].grupo === g);
    return `        <section class="tramo" aria-labelledby="t-tramo-${g}">
          <h3 class="tramo__tit" id="t-tramo-${g}">${tit}</h3>
          <ol class="tramo__lista">
${ids.map((id) => { const d = R2.destinos[id]; const c = d.desde_casa; const p = d.a_pie; return `            <li data-ruta="${id}"><span class="parada__min cifra">${tiempo(c.minutos)}</span><span class="parada__que"><b>${esc(d.nombre)}</b><small>${esc(d.donde)}</small></span><span class="parada__km"><svg class="ico" aria-hidden="true"><use href="#i-coche"/></svg><span class="vh">En coche: </span><span class="cifra">${km(c.km)}</span>${p ? `<span class="parada__pie"><svg class="ico" aria-hidden="true"><use href="#i-pie"/></svg><span class="vh">A pie: </span><span class="cifra">${km(p.km)}, ${tiempo(p.minutos)}</span></span>` : ''}</span></li>`; }).join('\n')}
          </ol>
        </section>`;
  }).join('\n');
  return `    <div class="alrededor__in">
      <figure class="alrededor__f"><button type="button" class="foto-btn" data-visor="arco-iris-valle" data-grupo="alrededor" aria-label="Ver más grande: ${esc(altDe('arco-iris-valle'))}"><img data-foto="arco-iris-valle" sizes="(max-width: 899px) 92vw, 36vw"></button></figure>
      <div class="trayecto">
${cols}
      </div>
    </div>
    <p class="alrededor__fino">Tiempos en coche desde la casa, por carretera, calculados con OSRM sobre datos de © colaboradores de OpenStreetMap el ${fecha}: sin tráfico ni paradas, orientativos. La Casa del Agua está en Rioseco (el tiempo es hasta el pueblo); conviene mirar su horario antes de ir.</p>`;
}
function llegar() {
  const R2 = leerRutas();
  if (!R2) return '';
  const d = R2.destinos;
  return `      <p class="contacto__ruta">Desde Oviedo, <span class="cifra">${km(d.oviedo.desde_casa.km)}</span> por la AS-17 y la AS-117 (unos <span class="cifra">${tiempo(d.oviedo.desde_casa.minutos)}</span> sin tráfico). Desde el aeropuerto de Asturias, <span class="cifra">${km(d.aeropuerto.desde_casa.km)}</span> (<span class="cifra">${tiempo(d.aeropuerto.desde_casa.minutos)}</span>).</p>`;
}

/* ---------- partes y ausentes ---------- */
const partes = (html, prof = 0) => html.replace(/<!--parte:([^\s>]+)\s*-->/g, (m, ruta) => {
  const f = path.join(RAIZ, ruta);
  if (!fs.existsSync(f)) { console.warn('  (falta ' + ruta + ')'); return `<!-- sin ${ruta} -->`; }
  if (prof > 3) throw new Error('Partes anidadas de más: ' + ruta);
  return partes(fs.readFileSync(f, 'utf8').trim(), prof + 1);
});
const DEL_3D = new Set(['css/lugar.css', 'js/lugar.js']);
const quitarAusentes = (html) => html
  .replace(/[ \t]*<link rel="stylesheet" href="(css\/[^"?]+)"[^>]*>\r?\n?/g, (m, r) => (DEL_3D.has(r) || fs.existsSync(path.join(RAIZ, r)) ? m : (console.warn('  (sin ' + r + ': se quita su <link>)'), '')))
  .replace(/[ \t]*<script (?:type="module" )?src="(js\/[^"?]+)"[^>]*><\/script>\r?\n?/g, (m, r) => (DEL_3D.has(r) || fs.existsSync(path.join(RAIZ, r)) ? m : (console.warn('  (sin ' + r + ': se quita su <script>)'), '')));
for (const r of DEL_3D) if (!fs.existsSync(path.join(RAIZ, r))) console.warn(`  (aún no está ${r}, del agente Lugar 3D: la etiqueta se queda y la página usa el respaldo)`);

const reservaJson = () => JSON.stringify({ ...D.reserva, telefono: D.contacto.telefono, telefonoTexto: D.contacto.telefonoTexto }).replace(/</g, '\\u003c');
const enlaceBooking = () => `<a class="btn btn--linea" href="${esc(D.resenas.booking.url)}" target="_blank" rel="noopener">Buscarla en Booking<span class="vh"> (se abre en otra pestaña)</span></a>`;

const fuentes = fs.readdirSync(RAIZ).filter((f) => f.endsWith('.src.html'));
for (const src of fuentes) {
  let html = quitarAusentes(partes(fs.readFileSync(path.join(RAIZ, src), 'utf8')));
  html = html.replace('{{RESERVA}}', reservaJson)
    .replace('<!--portada-escena-->', portadaEscena)
    .replace('<!--precarga-portada-->', precarga)
    .replace('<!--rotulo-logo-->', rotuloLogo)
    .replace('<!--rotulo-pie-->', rotuloPie)
    .replace('<!--cifras-->', cifras)
    .replace('<!--colores-->', colores)
    .replace('<!--servicios-->', servicios)
    .replace('<!--condiciones-->', condiciones)
    .replace('<!--vistazo-->', vistazo)
    .replace('<!--estancias-->', estancias)
    .replace('<!--resenas-->', resenas)
    .replace('<!--alrededor-->', alrededor)
    .replace('<!--llegar-->', llegar)
    .replace('<!--enlace-booking-->', enlaceBooking);
  if (html.includes('<div class="mapa" id="mapa">')) html = html.replace('<div class="mapa" id="mapa">', `<div class="mapa" id="mapa" data-q="${esc(D.contacto.mapa)}">`);
  html = html.replace(/<img\b([^>]*\bdata-foto="[^"]+"[^>]*)>/g, (m, a) => picture(a.replace(/\s*\/$/, '')));
  const destino = src.replace('.src.html', '.html');
  fs.writeFileSync(path.join(RAIZ, destino), html);
  console.log(`${src} → ${destino} (${(html.length / 1024).toFixed(0)} KB)`);
}
execFileSync(process.execPath, [path.join(RAIZ, 'versionar.mjs')], { stdio: 'inherit' });
