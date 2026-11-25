/* Verificación de la web de La Casa de Tanes (Playwright, UN navegador, ventanas pequeñas, escala 1).
   Uso: node verificar.mjs            (puerto 8951; todo)
        node verificar.mjs 3 4        (solo esos bloques, para depurar)
   Sin capturas para mirar: lo que hay que ver a ojo va en el README. El 3D NO se pinta: el navegador arranca con
   --disable-3d-apis, la página se abre con ?sin-webgl y js/lugar.js y vendor/ se bloquean (del 3D solo se comprueba
   que existe su contenedor y que se ve el respaldo; en el bloque 11, el plan B 2D de Lugar). Google Maps y las letras
   se sirven falsos: ninguna petición de verdad a terceros. Todo va con movimiento reducido salvo el bloque 12, una vez
   y al final; el 13 mide el LCP en un móvil de gama media emulado. Mide comportamiento, no aspecto. */
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const require = createRequire('C:/Users/alvar/Desktop/WEBS NEGOCIOS/alvarotaiagu.github.io/');
const { chromium } = require('playwright');
const sharp = require('sharp');

const RAIZ = path.dirname(fileURLToPath(import.meta.url));
const PUERTO = 8951;
const SOLO = process.argv.slice(2).map(Number).filter(Boolean);
const toca = (n) => !SOLO.length || SOLO.includes(n);
const TIPOS = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json',
  '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.avif': 'image/avif', '.bin': 'application/octet-stream' };
const servidor = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const f = path.join(RAIZ, p);
  if (!f.startsWith(RAIZ) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('no'); return; }
  res.writeHead(200, { 'Content-Type': TIPOS[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
servidor.on('error', (e) => { console.error(`El puerto ${PUERTO} está ocupado (¿otra sesión?): ${e.message}`); process.exit(2); });
await new Promise((r) => servidor.listen(PUERTO, r));
const BASE = `http://localhost:${PUERTO}/`;
const PAG = BASE + 'index.html?sin-webgl';

const fallos = [];
let nOk = 0;
const comprobar = (cond, m, detalle) => { if (cond) { nOk++; console.log('  ok     ' + m); } else { fallos.push(m); console.log('  FALLO  ' + m + (detalle !== undefined ? ' → ' + JSON.stringify(detalle).slice(0, 700) : '')); } };
const nota = (m) => console.log('  ·      ' + m);
const LLAVE = 'tanes-cookies';
const sinCookies = `try { localStorage.setItem('${LLAVE}', 'si'); } catch (e) {}`;
const existe = (f) => fs.existsSync(path.join(RAIZ, f));
const leer = (f) => fs.readFileSync(path.join(RAIZ, f), 'utf8');
const D = JSON.parse(leer('data/tanes.json'));
const RUTAS = existe('ref/raw/rutas.json') ? JSON.parse(leer('ref/raw/rutas.json')) : null;
const kmTxt = (v) => (v < 1 ? Math.round(v * 1000) + ' m' : String(Math.round(v * 10) / 10).replace('.', ',') + ' km');
const minTxt = (m) => (m >= 60 ? Math.floor(m / 60) + ' h ' + String(m % 60).padStart(2, '0') + ' min' : m + ' min');

/* ================= 1. archivos (sin navegador) ================= */
if (toca(1)) {
console.log('\n1. Archivos, textos y contrato');
const htmls = fs.readdirSync(RAIZ).filter((f) => f.endsWith('.html') && !f.endsWith('.src.html'));
comprobar(['index.html', '404.html', 'aviso-legal.html', 'privacidad.html', 'cookies.html', 'accesibilidad.html'].every((f) => htmls.includes(f)), `están las 6 páginas (${htmls.join(', ')})`);
for (const f of htmls) {
  const s = leer(f);
  comprobar(/^<!DOCTYPE html>\s*<html lang="es">\s*<head>\s*<meta charset="utf-8">\s*<meta name="robots" content="noindex, nofollow">/.test(s), `${f}: charset lo primero y noindex, nofollow justo detrás`);
  const ids = [...s.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  const rep = ids.filter((x, i) => ids.indexOf(x) !== i);
  comprobar(rep.length === 0 && !/<!--parte:|<!-- sin partes\/|\{\{[A-Z]+\}\}|<!--(cifras|colores|servicios|condiciones|vistazo|estancias|alrededor|resenas|llegar|portada-escena|precarga-portada|rotulo-[a-z]+|enlace-booking)-->/.test(s) && !/[ÃÂ][\u0080-\u00BF]|\uFFFD/.test(s), `${f}: ids únicos, partes y datos incluidos, sin caracteres rotos`, [...new Set(rep)]);
  // enlaces locales: todo lo que enlaza existe (lugar.css/js del otro agente pueden faltar) y cada #ancla tiene destino
  const rutas = new Set();
  for (const m of s.matchAll(/(src|srcset|href|imagesrcset)="([^"]+)"/g)) for (const parte of (/srcset/.test(m[1]) ? m[2].split(',') : [m[2]])) {
    const r = parte.trim().split(/\s+/)[0].split('?')[0].split('#')[0];
    if (r && r !== './' && !/^(https?:|mailto:|tel:|data:)/.test(r) && !/^#/.test(parte.trim())) rutas.add(r);
  }
  const faltan = [...rutas].filter((r) => !existe(r) && !/^(css\/lugar\.css|js\/lugar\.js)$/.test(r));
  const anclas = [...s.matchAll(/href="(?:\.\/)?#([^"]+)"/g)].map((m) => m[1]).filter((a) => f === 'index.html' || !/^(reservar)$/.test(a));
  const sinDestino = f === 'index.html' ? anclas.filter((a) => !ids.includes(a)) : [];
  comprobar(faltan.length === 0 && sinDestino.length === 0, `${f}: existen los ${rutas.size} archivos que enlaza y las anclas tienen destino`, { faltan, sinDestino });
}
comprobar(['.nojekyll', '404.html', 'manifest.json', 'img/og.jpg', 'marca/favicon.svg', 'marca/favicon-32.png', 'marca/apple-touch-icon.png', 'marca/icono-512.png', 'marca/rotulo.svg', 'marca/rotulo.json'].every(existe), 'están .nojekyll, 404, manifest, og, favicons y el rótulo como trazado');
const html = leer('index.html');
const R = JSON.parse(leer('marca/rotulo.json'));
comprobar(R.glifos.length === 6 && R.glifos.every((g) => /^M[\d\s.,MLHVQCZ-]+$/i.test(g.d)) && !/<text/.test(html.match(/<svg class="rotulo"[\s\S]*?<\/svg>/)[0]), 'el rótulo «La Casa» va como TRAZADO SVG (seis glifos de Imperial Script, sin <text>): no es candidato a LCP ni depende de la letra');
/* fotos */
const fotosJson = JSON.parse(leer('img/fotos/fotos.json'));
const pedidas = [...new Set([...html.matchAll(/<picture data-foto="([^"]+)"/g)].map((m) => m[1]))];
comprobar(pedidas.length >= 40 && pedidas.every((n) => fotosJson.some((f) => f.nombre === n)), `las ${pedidas.length} fotos de la página existen en img/fotos/fotos.json`);
const faltanFotos = [];
for (const f of fotosJson) for (const w of f.anchos) for (const e of ['avif', 'webp', 'jpg']) if (!existe(`img/fotos/${f.nombre}-${w}.${e}`)) faltanFotos.push(`${f.nombre}-${w}.${e}`);
comprobar(faltanFotos.length === 0, 'cada foto existe en todos sus anchos y en AVIF, WebP y JPG', faltanFotos.slice(0, 5));
const nit = JSON.parse(leer('ref/raw/nitidez.json'));
const amplia = fotosJson.filter((f) => { const o = nit[f.origen]; return !o || Math.max(...f.anchos) > o.ancho; });
comprobar(amplia.length === 0, 'ninguna foto se amplía: ningún ancho pasa del de su original (ref/raw/nitidez.json)', amplia.map((f) => f.nombre));
const blandas = fotosJson.filter((f) => { const o = nit[f.origen]; return o && o.cociente < 0.5 && f.ancho > o.ancho * 0.72; });
comprobar(blandas.length === 0, 'las fotos blandas en origen (nitidez < 0,5) se sirven rebajadas a lo que tienen de verdad', blandas.map((f) => f.nombre));
const n01 = nit['origen/01.jpg'];
const PI = JSON.parse(leer('img/portada/portada.json'));
comprobar(n01.cociente >= 0.6 && Math.max(...PI.anchos) === n01.ancho && ['monte', 'agua', 'casa'].every((c) => PI.anchos.every((w) => existe(`img/portada/${c}-${w}.avif`) && existe(`img/portada/${c}-${w}.webp`))), `la portada (foto 01) tiene resolución real: nitidez ${n01.cociente} a ${n01.ancho} px, sin ampliar, y sus tres capas en AVIF y WebP`);
comprobar(/<link rel="preload" as="image" type="image\/avif" imagesrcset="img\/portada\/monte-/.test(html) && /capa--monte"><source[^>]*><source[^>]*><img [^>]*fetchpriority="high"/.test(html), 'la capa «monte» (el LCP) se precarga y lleva fetchpriority="high"');
/* la portada: capas y rótulo en orden, el rótulo DETRÁS del tejado */
const esc = html.match(/<div class="escena"[\s\S]*?\n      <\/div>/)[0];
const orden = ['capa--monte', 'class="rotulo"', 'capa--agua', 'capa--casa'].map((k) => esc.indexOf(k));
comprobar(orden.every((v, i) => v > 0 && (i === 0 || v > orden[i - 1])), 'la escena: monte, rótulo, agua y casa, en ese orden (el rótulo va entre el monte y el pueblo, detrás de la casa)', orden);
{
  const P = JSON.parse(leer('data/portada.json')), M = JSON.parse(leer('ref/portada/mascaras.json'));
  const tapado = (cfg) => {
    const { x, y, ancho } = cfg.rotulo, alto = ancho * R.alto / R.ancho;
    return Object.entries(M.tejado).filter(([cx, ty]) => +cx >= x && +cx <= x + ancho && ty < y + alto * R.base).length;
  };
  const te = tapado(P.escritorio), tm = tapado(P.movil);
  comprobar(te >= 5 && tm >= 5, `el rótulo queda en parte DETRÁS del tejado (columnas de la casa que lo tapan: ${te} en escritorio, ${tm} en móvil)`);
}
/* textos: nada inventado, solo castellano, sin rayas */
const texto = html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '').replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const alts = [...html.matchAll(/(?:alt|aria-label|title)="([^"]*)"/g)].map((m) => m[1]).join(' ');
const jsTodo = ['js/main.js', 'js/reserva.js', 'js/portada.js'].map(leer).join('\n');
const textosJs = [...jsTodo.matchAll(/(['`])((?:(?!\1).)*[a-záéíóúñ]{3,}(?:(?!\1).)*)\1/gi)].map((m) => m[2]).join(' ');
comprobar(!/[—–]/.test(texto + alts + textosJs), 'ni una raya (— ni –) en el texto visible, los alt, las etiquetas ni los textos del JS');
comprobar(/609 05 34 98/.test(texto) && /tel:\+34609053498/.test(html) && /Tanes 9/.test(texto) && /33994/.test(texto) && /AT 1490 AS/.test(texto), 'contacto y registro de DATOS: teléfono, Tanes 9, 33994 y AT 1490 AS');
comprobar(!/Oviedo[^.]{0,30}30 min|30 min[^.]{0,30}Oviedo/i.test(texto) && !/siglo|centenari|pet friendly|mejor precio|piscina|desayuno incluido/i.test(texto + alts), 'nada que no esté en DATOS: ni «Oviedo a 30 min», ni siglos, ni «mejor precio», ni piscina, ni desayuno');
comprobar(!/"[^"]*(Apartamento|Estudio) (El|La|Los|Las) [A-ZÁÉÍÓÚ]/.test(html) && /Cuál es cuál, y cómo se llama cada una, por confirmar/.test(texto), 'sin nombres de apartamento inventados: la carta de colores dice que cuál es cuál está por confirmar');
comprobar(!/<blockquote|«[^»]{20,}»\s*(?:<\/p>)?\s*<(?:footer|cite)/.test(html) && /<span class="cifra">9,2<\/span>/.test(html) && /<span class="cifra">205<\/span> reseñas en Booking/.test(html) && /<span class="cifra">4,6<\/span>/.test(html) && /<span class="cifra">18<\/span> reseñas en Google/.test(html), 'reseñas: 9,2 con 205 en Booking y 4,6 con 18 en Google, sin citas inventadas');
comprobar(!/\b(1|una)( sola| única)? reseña\b/i.test(texto) && !/clientes satisfechos|cientos de/i.test(texto), 'sin prueba social inventada');
comprobar(/booking\.com\/searchresults[^"]*La\+Casa\+de\+Tanes/.test(html) && /google\.com\/maps\/search\/\?api=1&amp;query=Apartamentos\+La\+Casa\+de\+Tanes/.test(html), 'enlaces a las fichas (Booking: búsqueda por nombre; URL exacta, pendiente)');
comprobar(/14<\/dd>/.test(html) && /5<\/dd>/.test(html) && /según su ficha de Airbnb \(por confirmar/.test(texto), 'cifras del conjunto: 14 viajeros y 5 dormitorios, con su fuente y «por confirmar»');
comprobar(/<b>Simulador<\/b> Así funcionaría un motor de reservas propio\. No reserva, no envía ni guarda nada y no pide datos\./.test(html) && !/<form/.test(html) && !/<input[^>]+type="(text|email|tel)"/.test(html), 'el simulador está marcado como simulado y no hay formularios ni campos de datos personales');
comprobar(!/<iframe/.test(html), 'ningún iframe en el HTML (el mapa se crea al pedirlo)');
const iconos = new Set([...html.matchAll(/use href="#(i-[a-z-]+)"/g)].map((m) => m[1]));
comprobar([...iconos].every((i) => new RegExp(`<symbol id="${i}"`).test(html)) && (html.match(/servicios__lista[\s\S]*?<\/ul>/g) || []).join('').split('<use href="#i-').length - 1 >= 13 && !/<li>\s*•/.test(html), `servicios con icono propio (${iconos.size} iconos del sprite, todos definidos), sin viñetas`);
if (RUTAS) {
  const tray = html.match(/<div class="trayecto">([\s\S]*?)\n      <\/div>/)[1];
  const ok = RUTAS.llegar.every((id) => { const d = RUTAS.destinos[id].desde_casa; return new RegExp(`data-ruta="${id}"><span class="parada__min cifra">${minTxt(d.minutos)}</span>[\\s\\S]*?${kmTxt(d.km)}`).test(tray); });
  comprobar(ok && (tray.match(/data-ruta=/g) || []).length === RUTAS.llegar.length, `Redes alrededor: los ${RUTAS.llegar.length} destinos con minutos y km de ref/raw/rutas.json (OSRM), ninguno a ojo`);
  comprobar(RUTAS.casa.lat.toFixed(4) === '43.2054' && /Catastro/.test(RUTAS.casa.fuente) && RUTAS.contraste.oviedo.veredicto.includes('falso') && new RegExp(kmTxt(RUTAS.destinos.oviedo.desde_casa.km)).test(texto), `la casa sale del Catastro (Tanes 9) y Oviedo está a ${kmTxt(RUTAS.destinos.oviedo.desde_casa.km)} y ${minTxt(RUTAS.destinos.oviedo.desde_casa.minutos)} (OSRM), no a 30 min`);
} else nota('sin ref/raw/rutas.json');
/* contrato web ↔ módulos */
const sitios = [...html.replace(/<!--[\s\S]*?-->/g, '').matchAll(/data-modulo="([^"]+)"/g)].map((m) => m[1]);
comprobar(JSON.stringify(sitios) === JSON.stringify(['portada', 'lugar']), 'los huecos de los módulos: portada y lugar', sitios);
comprobar(/<section id="lugar"[^>]*aria-labelledby="t-lugar">[\s\S]*?<div data-modulo="lugar">\s*<figure class="espejo__respaldo">[\s\S]*?reflejo-montanas[\s\S]*?<figcaption>[^<]+<\/figcaption>\s*<\/figure>\s*<\/div>/.test(html) && leer('scripts/fotos-lista.json').includes('"origen/45.jpg"'), '#lugar: <div data-modulo="lugar"> con el respaldo (foto 45, el reflejo, y texto)');
const cabeza = html.split('</head>')[0];
comprobar(/<link rel="stylesheet" href="css\/lugar\.css/.test(cabeza) && /<script src="js\/lugar\.js[^"]*" defer><\/script>/.test(html) && html.indexOf('js/lugar.js') < html.indexOf('js/main.js') && html.indexOf('js/portada.js') < html.indexOf('js/main.js'), 'carga css/lugar.css (en el <head>) y js/lugar.js (defer, antes de main.js)');
comprobar(['js/portada.js', 'js/reserva.js', 'js/main.js'].every((s) => new RegExp(`<script src="${s}\\?v=[0-9a-f]+" defer>`).test(html)) && /href="css\/estilos\.css\?v=[0-9a-f]+"/.test(html), 'CSS y JS propios con ?v=<huella> (versionar.mjs) y los JS con defer');
comprobar(!/data-(partir|split|letras|chars?)\b/.test(html) && !/class="[^"]*\bcortina\b|id="cortina"/.test(html), 'ni letra a letra ni cortina');
/* CSS y JS: lo que no se negocia */
const base = leer('css/base.css'), css = leer('css/estilos.css');
const rootBase = base.split('}')[0];
comprobar(['--fondo', '--superficie', '--texto', '--texto-suave', '--marca', '--acento', '--agua', '--linea', '--letra-titular', '--letra-texto', '--letra-script', '--letra-cifras'].every((v) => new RegExp(`\\s${v}:`).test(rootBase)), 'las doce variables comunes del contrato, en :root de css/base.css');
{
  const pal = JSON.parse(leer('ref/raw/paleta.json'));
  const m = { laton: pal.laton.hex, arenisca: pal.arenisca_luz.hex, castano: pal.castano.hex, embalse: pal.embalse_21.hex, almagre: pal.almagre_13.hex };
  const ok = Object.entries(m).every(([k, v]) => new RegExp(`--${k}: ${v};`, 'i').test(rootBase));
  comprobar(ok, `la paleta es la MEDIDA en las fotos (latón ${m.laton}, arenisca ${m.arenisca}, castaño ${m.castano}, embalse ${m.embalse}, almagre ${m.almagre})`, m);
  const colores = D.colores.every((c) => { const k = { almagre: 'almagre_13', botella: 'verde_botella', cuadros: 'azulejo_rojo', ocre: 'ocre', azul: 'azul', amarillo: 'amarillo' }[c.id]; return pal[k] && pal[k].hex === c.hex && new RegExp(`style="--c:${c.hex}"`).test(html); });
  comprobar(colores, 'la carta de colores usa los colores medidos en las fotos de cada estancia (ref/raw/paleta.json)');
}
comprobar(/\.cookies:not\(\[hidden\]\)\s*\{\s*display:\s*flex/.test(css) && !/\.cookies\s*\{[^}]*display:/.test(css) && /\.mando:not\(\[hidden\]\)/.test(css) && !/\.mando\s*\{[^}]*display:/.test(css) && /\[hidden\]\s*\{\s*display:\s*none\s*!important/.test(base), 'cookies y mando: display solo en :not([hidden]); [hidden] siempre oculta');
comprobar(/\.menu-movil\s*\{[^}]*height:\s*calc\(100dvh/.test(css) && !/\.menu-movil\s*\{[^}]*inset:\s*0/.test(css), 'menú móvil: altura con 100dvh, nunca inset:0 (la cabecera lleva backdrop-filter)');
comprobar(!/\ddvh/.test(css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\.menu-movil\s*\{[^}]*\}/, '').replace(/\.visor\s*\{[^}]*\}/, '')), 'fuera de las capas fijas (menú y visor), ningún dvh (la barra del móvil no mueve nada)');
comprobar(!/cursor:\s*none/.test(base + css + jsTodo) && !/marquee|marquesina/i.test(css + html) && !/li\s*\{[^}]*position:\s*sticky/.test(css), 'sin cursor propio, sin marquesina y sin pila sticky de tarjetas');
comprobar(/:focus-visible\s*\{\s*outline:\s*2px solid/.test(base) && /\.foco-tornillos circle/.test(base) && /id="foco-tornillos"/.test(html), 'foco: contorno de 2 px y cuatro tornillos en las esquinas (#foco-tornillos)');
const mainJs = leer('js/main.js');
comprobar(/raiz\.classList\.add\('con-movimiento'\)/.test(mainJs) && /const motion = !quieto;/.test(mainJs), '«con-movimiento» solo sin movimiento reducido');
comprobar(/if \(esBarra\(\)\) return;/.test(mainJs) && /if \(innerWidth === anchoVista\) return;/.test(leer('js/reserva.js')), 'el resize de la barra del móvil no rehace nada (main y el calendario)');
comprobar(/history\.scrollRestoration = 'manual'/.test(leer('partes/cabeza.html')) && /scrollTo\(0, 0\)/.test(mainJs), 'recargar a media página: scrollRestoration manual y vuelta arriba');
comprobar(!/(cdnjs|jsdelivr|unpkg|gsap|lenis)/i.test(html.replace(/<!--[\s\S]*?-->/g, '')), 'ninguna librería de CDN en la página (sin GSAP ni Lenis): solo las letras de Google');
comprobar(!/localStorage\.setItem/.test(leer('js/reserva.js')) && !/fetch\(|XMLHttpRequest|sendBeacon/.test(leer('js/reserva.js')), 'el simulador no guarda (localStorage) ni envía (fetch/XHR/beacon) nada');
const fuentes = html.match(/fonts\.googleapis\.com\/css2\?[^"]+/)[0];
const familias = [...fuentes.matchAll(/family=([A-Za-z+]+)/g)].map((m) => m[1]);
comprobar(JSON.stringify(familias) === '["Imperial+Script","Sofia+Sans+Condensed","Ubuntu+Sans","Google+Sans+Code"]' && /display=swap/.test(fuentes), 'Google Fonts: Imperial Script, Sofia Sans Condensed, Ubuntu Sans y Google Sans Code, display=swap');
{
  const otras = [];
  for (const d of fs.readdirSync(path.join(RAIZ, '..'))) {
    if (!/-web$/.test(d) || d === path.basename(RAIZ)) continue;
    const dir = path.join(RAIZ, '..', d);
    let fich = [];
    try { fich = [...fs.readdirSync(dir).filter((f) => f.endsWith('.html')).map((f) => path.join(dir, f)), ...(fs.existsSync(path.join(dir, 'css')) ? fs.readdirSync(path.join(dir, 'css')).filter((f) => f.endsWith('.css')).map((f) => path.join(dir, 'css', f)) : [])]; } catch (e) { continue; }
    for (const f of fich) { const s = fs.readFileSync(f, 'utf8'); for (const fam of familias) if (s.includes('family=' + fam) || new RegExp(`['"]${fam.replace(/\+/g, ' ')}['"]`).test(s)) otras.push(fam + ' en ' + d); }
  }
  comprobar(otras.length === 0, 'ninguna de las cuatro letras está ya en otra web de la cartera (grep en ../*-web)', [...new Set(otras)]);
}
// receta de borrado del mando (README), comprobada sobre copias en memoria
{
  const quitar = (s, re) => (re.test(s) ? s.replace(re, '') : null);
  const cab = quitar(leer('partes/cabeza.html').split('\r\n').join('\n'), /\s*\/\/ MANDO DE MAQUETA[^\n]*\n\s*if \(q\.has\('revision'\)\) \{[\s\S]*?\n    \}\n/);
  const pie = quitar(leer('partes/pie.html').split('\r\n').join('\n'), /<!-- MANDO DE MAQUETA[\s\S]*?<!-- fin del MANDO DE MAQUETA -->\n?/);
  const mj = quitar(mainJs.split('\r\n').join('\n'), /\s*\/\* =+ \d+\. MANDO DE MAQUETA[\s\S]*?\/\* fin del MANDO DE MAQUETA \*\//);
  const cs = quitar(css.split('\r\n').join('\n'), /\/\* =+ MANDO DE MAQUETA[\s\S]*?\/\* fin del MANDO DE MAQUETA \*\//);
  let ok = !!(cab && pie && mj && cs) && !/revision|densidad-sobria/.test(cab) && !/id="mando"|data-densidad/.test(pie) && !/data-densidad|pintarMando/.test(mj) && !/\.mando|densidad-sobria/.test(cs);
  try { new vm.Script(mj); new vm.Script(cab.match(/<script>([\s\S]*?)<\/script>/)[1]); } catch (e) { ok = false; }
  comprobar(ok, 'la receta de borrado del mando (README) quita los cuatro bloques y el JS sigue siendo válido');
}
}

/* ================= navegador: uno solo, sin WebGL ================= */
if (SOLO.length && SOLO.every((n) => n === 1)) { servidor.close(); console.log(`\n${nOk} comprobaciones bien, ${fallos.length} mal`); if (fallos.length) { console.log('FALLOS:\n - ' + fallos.join('\n - ')); } process.exit(fallos.length ? 1 : 0); }
const browser = await chromium.launch({ headless: true, args: ['--disable-3d-apis'] });
try {
  async function nueva(op = {}, { script, abortar, con3d } = {}) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, reducedMotion: 'reduce', ...op });
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    await ctx.route(/google\.com\/maps/, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<p>mapa</p>' }));
    await ctx.route(/booking\.com|googletagmanager|google-analytics/, (r) => r.abort());
    if (!con3d) {
      await ctx.route(/\/js\/lugar\.js|\/vendor\//, (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: '/* sin 3D en las pruebas */' }));
      await ctx.route(/\/css\/lugar\.css/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    }
    if (abortar) await ctx.route(abortar, (r) => r.abort());
    if (script) await ctx.addInitScript(script);
    const page = await ctx.newPage();
    page._errores = []; page._noGet = []; page._fuera = [];
    page.on('pageerror', (e) => page._errores.push('pageerror: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/ERR_FAILED|net::|WebGL|webgl/.test(m.text())) page._errores.push('consola: ' + m.text()); });
    page.on('response', (r) => { if (r.status() >= 400) page._errores.push(r.status() + ' ' + r.url()); });
    page.on('request', (r) => { if (r.method() !== 'GET') page._noGet.push(r.method() + ' ' + r.url()); if (!r.url().startsWith(BASE) && !/fonts\.(googleapis|gstatic)|^data:/.test(r.url())) page._fuera.push(r.url()); });
    return { ctx, page };
  }
  const contrastes = (page, sel) => page.evaluate((sel) => {
    const lz = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    const rgba = (c) => { lz.clearRect(0, 0, 1, 1); lz.fillStyle = '#000'; lz.fillStyle = c; lz.fillRect(0, 0, 1, 1); return [...lz.getImageData(0, 0, 1, 1).data]; };
    const L = (m) => { m = m.map((v) => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return .2126 * m[0] + .7152 * m[1] + .0722 * m[2]; };
    const fondo = (el) => { while (el) { const b = getComputedStyle(el).backgroundColor; if (b && !/rgba\(0, 0, 0, 0\)|transparent/.test(b) && !/[, /] ?0\)$/.test(b)) return rgba(b).slice(0, 3); el = el.parentElement; } return rgba(getComputedStyle(document.body).backgroundColor).slice(0, 3); };
    return sel.map((s) => {
      const el = document.querySelector(s); if (!el) return [s, 'falta'];
      const f = fondo(el), c = rgba(getComputedStyle(el).color), a = c[3] / 255;
      const t = [0, 1, 2].map((i) => c[i] * a + f[i] * (1 - a));
      const x = L(t), y = L(f); return [s, Math.round(((Math.max(x, y) + .05) / (Math.min(x, y) + .05)) * 100) / 100];
    });
  }, sel);
  const lum = (r, g, b) => { const f = (v) => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); };
  // contraste de un texto SOBRE LA FOTO: se oculta el texto, se recorta su caja y se compara su color con el píxel de fondo
  // más claro (percentil 95) de esa caja. Un fotograma de espera tras ocultarlo (screenshot ignora el estilo recién puesto).
  async function contrasteSobreFoto(page, sel) {
    const caja = await page.evaluate((sel) => { const el = document.querySelector(sel); const r = el.getBoundingClientRect(); const c = getComputedStyle(el).color; el.style.visibility = 'hidden'; return { x: Math.max(0, r.left), y: Math.max(0, r.top), w: Math.min(innerWidth - Math.max(0, r.left), r.width), h: r.height, c }; }, sel);
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const png = await page.screenshot({ clip: { x: caja.x, y: caja.y, width: caja.w, height: caja.h } });
    await page.evaluate((sel) => { document.querySelector(sel).style.visibility = ''; }, sel);
    const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
    const ls = [];
    for (let i = 0; i < data.length; i += info.channels) ls.push(lum(data[i], data[i + 1], data[i + 2]));
    ls.sort((a, b) => a - b);
    const fondoL = ls[Math.floor(ls.length * 0.95)];
    const m = caja.c.match(/\d+/g).map(Number);
    const tl = lum(m[0], m[1], m[2]);
    return Math.round(((Math.max(tl, fondoL) + .05) / (Math.min(tl, fondoL) + .05)) * 100) / 100;
  }

  /* ---------- 2. portada (respaldo) a cinco tamaños ---------- */
  if (toca(2)) {
  console.log('\n2. Portada (respaldo, movimiento reducido) a 360×640, 375×667, 390×844, 768×1024 y 1280×800');
  for (const [w, h] of [[360, 640], [375, 667], [390, 844], [768, 1024], [1280, 800]]) {
    const movil = w < 1000;
    const { ctx, page } = await nueva({ viewport: { width: w, height: h }, isMobile: movil, hasTouch: movil }, { script: sinCookies });
    await page.goto(PAG);
    await page.waitForFunction(() => [...document.querySelectorAll('#portada .capa img')].every((i) => i.complete && i.naturalWidth > 0), null, { timeout: 10000 }).catch(() => {});
    const r = await page.evaluate(() => {
      const q = (s) => document.querySelector(s).getBoundingClientRect();
      const cab = q('#cab'), h1 = q('#portada h1'), marco = q('.portada__marco'), esc = q('.escena'), rot = q('.rotulo');
      const b = [...document.querySelectorAll('#portada .btn')].map((x) => x.getBoundingClientRect());
      const capas = [...document.querySelectorAll('#portada .capa img')];
      const z = ['.capa--monte', '.rotulo', '.capa--agua', '.capa--casa'].map((s) => +getComputedStyle(document.querySelector(s)).zIndex);
      return {
        capas: capas.length === 3 && capas.every((i) => i.complete && i.naturalWidth > 0),
        cubre: esc.left <= marco.left + 1 && esc.right >= marco.right - 1 && esc.top <= marco.top + 1 && esc.bottom >= marco.bottom - 1,
        zOrden: z.every((v, i) => i === 0 || v > z[i - 1]),
        rotuloDentro: rot.width > innerWidth * 0.45 && rot.left >= -2 && rot.right <= innerWidth + 2 && rot.top >= cab.bottom - 4,
        h1BajoCab: h1.top >= cab.bottom - 1,
        botones: b.every((x) => x.right <= innerWidth + 1 && x.height >= 44),
        sinScroll: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
        ctaVisible: b[0].bottom <= innerHeight || innerHeight < 700,
        quieta: !document.getElementById('portada').classList.contains('es-viva') && !document.documentElement.classList.contains('rotulo-en-vuelo'),
        logo: getComputedStyle(document.querySelector('.marca__rotulo')).opacity === '1',
      };
    });
    comprobar(Object.values(r).every(Boolean), `${w}×${h}: las tres capas cargadas cubren la portada, monte < rótulo < agua < casa, el rótulo entero y bajo la cabecera, titular bajo la cabecera, botones ≥ 44 px, sin scroll lateral y el logo a la vista`, r);
    if (w === 1280 || w === 390) {
      const sel = w === 1280 ? ['#portada h1', '.portada__sub'] : [];
      for (const s of sel) { const c = await contrasteSobreFoto(page, s); comprobar(c >= (s.endsWith('h1') ? 3 : 4.5), `${w}×${h}: contraste de «${s}» sobre la foto con su velo: ${c}:1`); }
    }
    comprobar(page._errores.length === 0, `${w}×${h}: sin errores`, page._errores.slice(0, 3));
    await ctx.close();
  }
  }

  /* ---------- 3. contraste y foco (escritorio) ---------- */
  if (toca(3)) {
  console.log('\n3. Contraste y foco (escritorio, movimiento reducido)');
  const { ctx, page } = await nueva({}, { script: sinCookies });
  await page.goto(PAG);
  await page.waitForTimeout(300);
  const sel = ['#t-estancias', '#estancias .sec-txt', '.cifras dd', '.cifras dt', '.cifras__nota', '.chip[data-color="almagre"] .chip__nombre', '.chip[data-color="almagre"] .chip__txt', '.chip[data-color="botella"] .chip__nombre', '.chip[data-color="cuadros"] .chip__nombre',
    '.chip[data-color="ocre"] .chip__nombre', '.chip[data-color="azul"] .chip__nombre', '.chip[data-color="amarillo"] .chip__nombre', '.carta__nota', '.ficha__h', '.servicios__lista b', '.servicios__lista span', '.condiciones dt', '.condiciones dd b', '.condiciones dd span', '.condiciones .btn--acento',
    '.estancias__indice a[aria-current]', '.estancias__indice a:not([aria-current])', '.estancia__tit', '.estancia__txt', '#t-lugar', '.espejo__cab .sec-txt', '.espejo__respaldo figcaption', '.tramo__tit', '.parada__min', '.parada__que b', '.parada__que small', '.parada__km', '.alrededor__fino',
    '.nota__n .cifra', '.nota__sobre', '.nota__dato', '.enlace-flecha', '.simu__aviso', '.simu__aviso b', '.simu__eti', '.simu__fechas b', '.cal__tit', '.cal__dias button:not(:disabled)', '.cal__ley', '.simu__pista', '.simu__cuentas dt', '.simu__total dd', '.simu__supuestos', '.simu__acc .btn--acento', '.simu__acc .btn--linea',
    '.contacto__dir', '.contacto__tel', '.contacto__ruta', '.map-consent b', '.map-consent span', '.contacto__f figcaption', '.pie__h', '.pie__cols p', '.pie__cols a', '.pie__legal p', '.pie__legal a'];
  const cs = await contrastes(page, sel);
  const grandes = new Set(['#t-estancias', '.cifras dd', '.chip[data-color="almagre"] .chip__nombre', '.chip[data-color="botella"] .chip__nombre', '.chip[data-color="cuadros"] .chip__nombre', '.chip[data-color="ocre"] .chip__nombre', '.chip[data-color="azul"] .chip__nombre', '.chip[data-color="amarillo"] .chip__nombre', '.ficha__h', '.estancia__tit', '#t-lugar', '.tramo__tit', '.nota__n .cifra', '.nota__sobre', '.cal__tit', '.contacto__dir']);
  const malos = cs.filter(([s, c]) => c === 'falta' || c < (grandes.has(s) ? 3 : 4.5));
  comprobar(malos.length === 0, `contraste WCAG ≥ 4,5:1 (3:1 en rótulos grandes) en ${cs.length} parejas de texto`, malos);
  nota('peores: ' + cs.filter(([, c]) => c !== 'falta').sort((a, b) => a[1] - b[1]).slice(0, 4).map(([s, c]) => `${s} ${c}`).join(' · '));
  // foco: los tornillos aparecen alrededor de lo enfocado con el teclado
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await page.waitForTimeout(80);
  const f = await page.evaluate(() => { const m = document.getElementById('foco-tornillos'); const a = document.activeElement.getBoundingClientRect(); const r = m.getBoundingClientRect(); return { visible: m.classList.contains('es-visible'), rodea: r.left < a.left && r.right > a.right && r.top < a.top && r.bottom > a.bottom, tornillos: [...m.querySelectorAll('circle')].filter((c) => +c.getAttribute('r') > 0).length, outline: getComputedStyle(document.activeElement).outlineStyle }; });
  comprobar(f.visible && f.rodea && f.tornillos === 4 && f.outline === 'solid', 'foco con forma propia: contorno de 2 px y cuatro tornillos alrededor del elemento enfocado', f);
  await page.evaluate(() => document.activeElement.blur());
  comprobar(page._errores.length === 0, 'sin errores', page._errores.slice(0, 3));
  await ctx.close();
  }

  /* ---------- 4. cada una con su color ---------- */
  if (toca(4)) {
  console.log('\n4. Cada una con su color: cifras, la carta de colores, servicios y condiciones');
  const { ctx, page } = await nueva({}, { script: sinCookies });
  await page.goto(PAG + '#estancias');
  await page.waitForTimeout(300);
  const a = await page.evaluate(() => ({ abiertas: [...document.querySelectorAll('.chip.es-abierta')].map((c) => c.dataset.color), anchos: [...document.querySelectorAll('.chip')].map((c) => Math.round(c.getBoundingClientRect().width)), chips: document.querySelectorAll('.chip').length, fotos: [...document.querySelectorAll('.chip img')].filter((i) => i.getBoundingClientRect().height > 100).length }));
  await page.click('.chip[data-color="ocre"] .chip__boton');
  await page.waitForTimeout(100);
  const b = await page.evaluate(() => ({ abiertas: [...document.querySelectorAll('.chip.es-abierta')].map((c) => c.dataset.color), exp: document.querySelector('.chip[data-color="ocre"] .chip__boton').getAttribute('aria-expanded'), otra: document.querySelector('.chip[data-color="almagre"] .chip__boton').getAttribute('aria-expanded'), ancho: Math.round(document.querySelector('.chip[data-color="ocre"]').getBoundingClientRect().width), anchoAlmagre: Math.round(document.querySelector('.chip[data-color="almagre"]').getBoundingClientRect().width) }));
  comprobar(a.chips === 6 && a.abiertas.join() === 'almagre' && a.anchos[0] > a.anchos[1] * 2 && a.fotos === 6, 'la carta: seis colores con su foto; empieza abierta la de almagre (más ancha)', a);
  comprobar(b.abiertas.join() === 'ocre' && b.exp === 'true' && b.otra === 'false' && b.ancho > b.anchoAlmagre * 2, 'pulsar «Ocre» la abre (aria-expanded) y cierra la anterior, también con movimiento reducido', b);
  const s = await page.evaluate(() => ({ grupos: document.querySelectorAll('.servicios__g').length, items: document.querySelectorAll('.servicios__lista li').length, iconos: [...document.querySelectorAll('.servicios__lista .ico')].filter((i) => i.getBoundingClientRect().width >= 24).length, cond: [...document.querySelectorAll('.condiciones dt')].map((d) => d.textContent), vistazo: getComputedStyle(document.getElementById('vistazo')).display }));
  comprobar(s.grupos === 3 && s.items === 13 && s.iconos === 13 && s.cond.join() === 'Entrada,Salida,Mascotas,Tabaco,Registro' && s.vistazo === 'none', 'ficha: 13 servicios en tres grupos, cada uno con su icono; condiciones aparte (entrada, salida, mascotas, tabaco y registro); la tabla de la sobria, oculta', s);
  comprobar(page._errores.length === 0, 'sin errores', page._errores.slice(0, 3));
  await ctx.close();
  }

  /* ---------- 5. todo mira al sur: índice, filas y visor por nombre ---------- */
  if (toca(5)) {
  console.log('\n5. Todo mira al sur: índice que marca, filas de la misma altura y visor por NOMBRE');
  const { ctx, page } = await nueva({}, { script: sinCookies });
  await page.goto(PAG);
  await page.waitForTimeout(200);
  const marcas = [];
  for (const id of D.estancias.map((e) => e.id)) {
    await page.evaluate((id) => { const el = document.getElementById('est-' + id); scrollTo(0, el.getBoundingClientRect().top + scrollY - innerHeight * 0.3); }, id);
    await page.waitForTimeout(250);
    marcas.push([id, await page.evaluate(() => (document.querySelector('.estancias__indice a[aria-current]') || {}).dataset?.est)]);
  }
  comprobar(marcas.every(([id, m]) => id === m), 'el índice fijo marca la estancia que se ve (las seis)', marcas);
  await page.evaluate(() => scrollTo(0, document.getElementById('casa').offsetTop));
  await page.waitForFunction(() => [...document.querySelectorAll('#casa .foto img')].slice(0, 12).every((i) => i.complete), null, { timeout: 8000 }).catch(() => {});
  const filas = await page.evaluate(() => [...document.querySelectorAll('.filas')].map((f) => { const por = new Map(); [...f.querySelectorAll('.foto')].forEach((x) => { const r = x.getBoundingClientRect(); const k = Math.round(r.top); if (!por.has(k)) por.set(k, []); por.get(k).push(r.height); }); return [...por.values()].map((h) => Math.max(...h) - Math.min(...h)); }).flat());
  comprobar(filas.every((d) => d <= 1.5), `filas de fotos con la misma altura (${filas.length} filas, diferencia máxima ${Math.max(...filas).toFixed(1)} px)`);
  // visor por NOMBRE: cada miniatura abre su propia foto
  const botones = await page.$$('[data-visor]');
  const malos = [];
  for (const b of botones) {
    const n = await b.getAttribute('data-visor');
    await b.scrollIntoViewIfNeeded();
    await b.click();
    await page.waitForFunction(() => document.getElementById('visor').open, null, { timeout: 2000 }).catch(() => {});
    const v = await page.evaluate(() => document.getElementById('visor-img').dataset.nombre);
    if (v !== n) malos.push([n, v]);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(40);
  }
  comprobar(botones.length >= 40 && malos.length === 0, `visor por NOMBRE: las ${botones.length} miniaturas abren su propia foto`, malos.slice(0, 5));
  await page.click('[data-visor="salon-ventana-abierta"]');
  await page.click('#visor-sig');
  const sig = await page.evaluate(() => document.getElementById('visor-img').dataset.nombre);
  await page.keyboard.press('Escape');
  comprobar(sig === 'cocina-ventana-embalse', 'en el visor, «siguiente» sigue el orden de la estancia', sig);
  comprobar(page._errores.length === 0, 'sin errores', page._errores.slice(0, 3));
  await ctx.close();
  }

  /* ---------- 6. el simulador ---------- */
  if (toca(6)) {
  console.log('\n6. El simulador de fechas (marcado como simulado, no envía ni guarda nada)');
  const { ctx, page } = await nueva({}, { script: sinCookies });
  await page.goto(PAG + '#reservar');
  await page.waitForTimeout(200);
  const ls0 = await page.evaluate(() => Object.keys(localStorage).sort().join());
  const r = await page.evaluate(() => {
    const R = window.Tanes.reserva;
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    // busca un tramo libre de 3 noches empezando dentro de 20 días, un día ocupado y una llegada libre con 1 noche libre
    const mas = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
    let libre = null, ocup = null;
    for (let i = 3; i < 60 && (!libre || !ocup); i++) {
      const d = mas(hoy, i);
      if (!ocup && R.ocupado(d)) ocup = d;
      if (!libre && [0, 1, 2].every((k) => !R.ocupado(mas(d, k)))) libre = d;
    }
    const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return { libre: libre && iso(libre), salida: libre && iso(mas(libre, 3)), una: libre && iso(mas(libre, 1)), ocup: ocup && iso(ocup) };
  });
  const clic = async (k) => { const b = page.locator(`#cal button[data-k="${k}"]`); for (let i = 0; i < 14 && !(await b.count()); i++) await page.click('#cal [data-nav="1"]'); await b.click(); };
  const leerS = () => page.evaluate(() => ({ e: document.querySelector('[data-fecha="entrada"]').textContent, s: document.querySelector('[data-fecha="salida"]').textContent, n: document.querySelector('[data-n-noches]').textContent, total: document.querySelector('[data-total]').textContent, frase: document.querySelector('[data-resumen]').textContent, ini: document.querySelectorAll('#cal .es-ini').length, fin: document.querySelectorAll('#cal .es-fin').length }));
  await clic(r.ocup);
  const o = await leerS();
  comprobar(/ocupado \(simulado\)/.test(o.frase) && o.ini === 0, 'un día ocupado (simulado) no se puede elegir para llegar', o);
  await clic(r.libre);
  await clic(r.una);
  const m1 = await leerS();
  comprobar(/Mínimo 2 noches \(supuesto\)/.test(m1.frase), 'el mínimo de noches (supuesto) se avisa', m1.frase);
  await clic(r.salida);
  const s1 = await leerS();
  const esperado = await page.evaluate(() => { const c = window.Tanes.reserva.cuenta(); return c && c.total.toLocaleString('es-ES') + ' €'; });
  comprobar(s1.n === '3' && s1.total === esperado && /^Del /.test(s1.frase) && s1.ini === 1 && s1.fin === 1 && /€$/.test(s1.total), `llegada y salida elegidas: 3 noches y total orientativo ${s1.total} (68 € o 75 € por noche según la temporada supuesta)`, s1);
  for (let i = 0; i < 16; i++) await page.click('.paso [data-acc="mas"]', { force: true }).catch(() => {});
  const p = await page.evaluate(() => ({ v: document.querySelector('.paso [data-valor]').textContent, mas: document.querySelector('.paso [data-acc="mas"]').disabled, pista: document.querySelector('[data-pista]').textContent }));
  comprobar(p.v === '14' && p.mas && /por confirmar/.test(p.pista), 'personas de 1 a 14 (el total de la casa); con más de dos, la capacidad de cada estancia «por confirmar»', p);
  const ls1 = await page.evaluate(() => Object.keys(localStorage).sort().join());
  comprobar(page._noGet.length === 0 && ls0 === ls1 && page._fuera.length === 0, 'el simulador no envía nada (ninguna petición que no sea GET ni a terceros) ni guarda nada en el navegador', { noGet: page._noGet, fuera: page._fuera.slice(0, 3), ls0, ls1 });
  const t = await page.evaluate(() => ({ tel: document.querySelector('.simu__acc a[href="tel:+34609053498"]') !== null, sup: document.querySelector('[data-supuestos]').textContent }));
  comprobar(t.tel && /68 €/.test(t.sup) && /75 €/.test(t.sup) && /mínimo 2 noches/.test(t.sup) && /inventados/.test(t.sup), 'junto al simulador: la alternativa real (llamar) y los supuestos escritos', t);
  comprobar(page._errores.length === 0, 'sin errores', page._errores.slice(0, 3));
  await ctx.close();
  }

  /* ---------- 7. cookies y mapa ---------- */
  if (toca(7)) {
  console.log('\n7. Cookies (los cuatro pasos) y el mapa solo al pedirlo');
  const { ctx, page } = await nueva();
  await page.goto(PAG);
  const v1 = await page.isVisible('#cookies');
  await page.click('#ck-si');
  const v2 = await page.isVisible('#cookies');
  const k = await page.evaluate((l) => localStorage.getItem(l), LLAVE);
  await page.reload();
  const v3 = await page.isVisible('#cookies');
  await page.evaluate((l) => localStorage.removeItem(l), LLAVE);
  await page.reload();
  const v4 = await page.isVisible('#cookies');
  comprobar(v1 && !v2 && k === 'si' && !v3 && v4, 'cookies: se ve en contexto limpio, «Entendido» lo cierra y guarda la clave, no vuelve al recargar y sí al borrarla', { v1, v2, k, v3, v4 });
  await page.click('#ck-no');
  const antes = await page.evaluate(() => document.querySelectorAll('iframe').length);
  await page.locator('#mapa-btn').scrollIntoViewIfNeeded();
  await page.click('#mapa-btn');
  await page.waitForTimeout(200);
  const despues = await page.evaluate(() => { const i = document.querySelector('#mapa iframe'); return i ? i.src : null; });
  comprobar(antes === 0 && despues && /google\.com\/maps\?q=Apartamentos%20La%20Casa%20de%20Tanes.*output=embed/.test(despues) && !(await page.isVisible('#mapa-btn')), 'el mapa de Google no existe hasta pulsar «Ver el mapa» (sin clave de API)', { antes, despues });
  comprobar(page._errores.length === 0, 'sin errores', page._errores.slice(0, 3));
  await ctx.close();
  }

  /* ---------- 8. el mando de densidades (?revision) ---------- */
  if (toca(8)) {
  console.log('\n8. Mando de maqueta (?revision): «La Casa» / «Sobria»');
  const { ctx, page } = await nueva();
  await page.goto(BASE + 'index.html?sin-webgl');
  const sinRev = await page.evaluate(() => document.getElementById('mando').hidden);
  await page.goto(BASE + 'index.html?sin-webgl&revision');
  const conCk = await page.evaluate(() => ({ ck: !document.getElementById('cookies').hidden, mando: document.getElementById('mando').hidden }));
  await page.click('#ck-si');
  const tras = await page.evaluate(() => !document.getElementById('mando').hidden);
  comprobar(sinRev && conCk.ck && conCk.mando && tras, 'el mando no existe sin ?revision, se aparta mientras está el aviso de cookies y aparece al cerrarlo', { sinRev, conCk, tras });
  const sw0 = await page.evaluate(() => document.documentElement.scrollWidth);
  await page.click('[data-densidad="sobria"]');
  await page.waitForTimeout(120);
  const s = await page.evaluate(() => ({ clase: document.documentElement.classList.contains('densidad-sobria'), tabla: getComputedStyle(document.getElementById('vistazo')).display, filas: document.querySelectorAll('#vistazo tr').length, chips: new Set([...document.querySelectorAll('.chip')].map((c) => Math.round(c.getBoundingClientRect().width))).size, pie: document.querySelector('.pie__letras').classList.contains('es-escrita'), url: location.search, quieta: !document.getElementById('portada').classList.contains('es-viva'), sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  comprobar(s.clase && s.tabla === 'block' && s.filas >= 10 && s.chips === 1 && s.pie && /densidad=sobria/.test(s.url) && s.quieta && s.sw <= s.cw && s.sw === sw0, 'Sobria: AÑADE la tabla «La casa, de un vistazo», la carta sin acordeón (seis tiras iguales), la portada quieta y el pie ya escrito, sin scroll lateral nuevo', s);
  await page.reload();
  comprobar(await page.evaluate(() => document.documentElement.classList.contains('densidad-sobria')), 'al recargar con ?densidad=sobria, la clase está desde el <head> (sin salto)');
  await page.click('[data-densidad="la-casa"]');
  const v = await page.evaluate(() => ({ clase: document.documentElement.classList.contains('densidad-sobria'), tabla: getComputedStyle(document.getElementById('vistazo')).display, pressed: document.querySelector('[data-densidad="la-casa"]').getAttribute('aria-pressed') }));
  comprobar(!v.clase && v.tabla === 'none' && v.pressed === 'true', 'y se puede volver a «La Casa»', v);
  comprobar(page._errores.length === 0, 'sin errores', page._errores.slice(0, 3));
  await ctx.close();
  }

  /* ---------- 9. móvil ---------- */
  if (toca(9)) {
  console.log('\n9. Móvil (390×844 y 360×640): menú, barra del navegador, sin desbordar a 360 px');
  {
    const { ctx, page } = await nueva({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }, { script: sinCookies });
    await page.goto(PAG);
    await page.evaluate(() => scrollTo(0, 1200));
    await page.waitForTimeout(150);
    await page.tap('#menu-btn');
    await page.waitForTimeout(350);
    const m = await page.evaluate(() => { const r = document.getElementById('menu-movil').getBoundingClientRect(); return { exp: document.getElementById('menu-btn').getAttribute('aria-expanded'), vis: getComputedStyle(document.getElementById('menu-movil')).visibility, alto: Math.round(r.height), top: Math.round(r.top), sc: document.getElementById('cab').classList.contains('sc') }; });
    comprobar(m.exp === 'true' && m.vis === 'visible' && m.top === 68 && m.alto >= 844 - 68 - 2 && m.sc, 'menú móvil con la cabecera ya fija: se abre a toda la altura (no lo encoge el backdrop-filter)', m);
    await page.tap('#menu-movil a[href="#alrededor"]');
    await page.waitForTimeout(400);
    const c = await page.evaluate(() => ({ exp: document.getElementById('menu-btn').getAttribute('aria-expanded'), y: Math.round(document.getElementById('alrededor').getBoundingClientRect().top) }));
    comprobar(c.exp === 'false' && Math.abs(c.y - 68 - 8) < 30, 'tocar un enlace del menú lo cierra y lleva a la sección', c);
    // la barra del navegador (resize de solo altura) no rehace nada
    await page.addStyleTag({ content: '.portada__marco{height:540px!important}.portada__fija{min-height:844px!important}' });
    const cuenta = await page.evaluate(() => { window._rs = 0; document.addEventListener('tanes:resize', () => window._rs++); return 0; });
    const y0 = await page.evaluate(() => Math.round(document.getElementById('resenas').getBoundingClientRect().top));
    for (let i = 0; i < 6; i++) { await page.setViewportSize({ width: 390, height: i % 2 ? 844 : 788 }); await page.waitForTimeout(260); }
    const r = await page.evaluate(() => ({ rs: window._rs, y: Math.round(document.getElementById('resenas').getBoundingClientRect().top) }));
    comprobar(r.rs === cuenta && r.y === y0, 'seis cambios de la barra del móvil: ningún tanes:resize y nada se mueve', { ...r, y0 });
    await page.setViewportSize({ width: 844, height: 390 });
    await page.waitForTimeout(400);
    comprobar(await page.evaluate(() => window._rs) > 0, 'girar el móvil sí rehace (un tanes:resize)');
    // la carta desborda en horizontal: solo entonces es parada de tabulador
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(400);
    const carta = await page.evaluate(() => { const c = document.querySelector('.carta__lista'); return { desborda: c.scrollWidth > c.clientWidth, tab: c.getAttribute('tabindex') }; });
    comprobar(carta.desborda && carta.tab === '0', 'en el móvil la carta de colores se desliza en horizontal y entonces es enfocable (tabindex=0)', carta);
    comprobar(page._errores.length === 0, 'sin errores', page._errores.slice(0, 3));
    await ctx.close();
  }
  {
    const { ctx, page } = await nueva({ viewport: { width: 360, height: 640 }, isMobile: true, hasTouch: true }, { script: sinCookies });
    await page.goto(PAG);
    const anchos = await page.evaluate(async () => {
      const malos = [];
      for (const s of document.querySelectorAll('main > section, footer')) {
        s.scrollIntoView();
        await new Promise((r) => requestAnimationFrame(() => r()));
        for (const el of s.querySelectorAll('*')) {
          if (el.closest('.carta__lista, .estancias__indice, .visor, .portada__marco, [data-modulo="lugar"] .lugar__fps')) continue;
          const r = el.getBoundingClientRect();
          if (r.width && (r.right > innerWidth + 1 || r.left < -1) && getComputedStyle(el).position !== 'fixed') malos.push((el.className && el.className.baseVal === undefined ? el.className : el.tagName) + ' ' + Math.round(r.left) + '…' + Math.round(r.right));
        }
      }
      return { sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, malos: malos.slice(0, 8) };
    });
    comprobar(anchos.sw <= anchos.cw && anchos.malos.length === 0, 'a 360 px nada desborda en horizontal (salvo los carriles que se deslizan a propósito, la carta y el índice, y la escena de la portada, recortada por su marco)', anchos);
    await ctx.close();
  }
  }

  /* ---------- 10. legales y 404 ---------- */
  if (toca(10)) {
  console.log('\n10. Legales y 404');
  const { ctx, page } = await nueva();
  for (const f of ['aviso-legal.html', 'privacidad.html', 'cookies.html', 'accesibilidad.html', '404.html']) {
    const resp = await page.goto(BASE + f);
    const r = await page.evaluate(() => ({ robots: document.querySelector('meta[name="robots"]').content, h1: document.querySelector('h1').textContent, rotulo: !!document.querySelector('svg path'), sw: document.documentElement.scrollWidth <= document.documentElement.clientWidth }));
    comprobar(resp.status() === 200 && r.robots === 'noindex, nofollow' && r.h1 && r.rotulo && r.sw, `${f}: carga, noindex, con el rótulo y sin scroll lateral`, r);
  }
  const av = leer('aviso-legal.html'), pr = leer('privacidad.html'), ck = leer('cookies.html');
  comprobar(/Titular<\/dt><dd><span class="aviso-corto">por confirmar/.test(av) && /AT 1490 AS/.test(av) && /OSRM/.test(av) && /ODbL/.test(av) && /Instituto Geográfico Nacional/.test(av) && /simulador/.test(av), 'aviso legal: titular «por confirmar» (nada inventado), registro AT 1490 AS, OSM/OSRM, IGN y el simulador');
  comprobar(/tanes-cookies/.test(pr) && /tanes-cookies/.test(ck) && /no envía ni guarda/.test(pr), 'privacidad y cookies nombran la única clave que se guarda (tanes-cookies) y que el simulador no envía nada');
  comprobar(page._errores.length === 0, 'sin errores', page._errores.slice(0, 3));
  await ctx.close();
  }

  /* ---------- 11. el 3D: solo el contenedor y su respaldo (no se pinta) ---------- */
  if (toca(11)) {
  console.log('\n11. El espejo de Tanes: el contenedor y el respaldo (sin pintar WebGL)');
  const { ctx, page } = await nueva({}, { script: sinCookies });
  await page.goto(PAG);
  await page.locator('#lugar').scrollIntoViewIfNeeded();
  await page.waitForFunction(() => { const i = document.querySelector('[data-modulo="lugar"] img'); return i && i.complete && i.naturalWidth > 0; }, null, { timeout: 6000 }).catch(() => {});
  const r = await page.evaluate(() => { const el = document.querySelector('[data-modulo="lugar"]'); const img = el.querySelector('img'); const r = img && img.getBoundingClientRect(); return { el: !!el, foto: !!img && img.complete && img.naturalWidth > 0 && r.width > 200, texto: /reflejadas/.test(el.textContent), canvas: !!el.querySelector('canvas') }; });
  comprobar(r.el && r.foto && r.texto && !r.canvas, 'el hueco #lugar [data-modulo="lugar"] existe y se ve el respaldo (foto 45 y texto), sin canvas', r);
  comprobar(page._errores.length === 0, 'sin js/lugar.js la página no falla', page._errores.slice(0, 3));
  await ctx.close();
  if (existe('js/lugar.js')) {
    const c3 = await nueva({}, { script: sinCookies, con3d: true });
    await c3.page.goto(PAG);
    const anc = await c3.page.evaluate(() => { const r = []; for (let e = document.querySelector('[data-modulo="lugar"]').parentElement; e && e !== document.documentElement; e = e.parentElement) { const c = getComputedStyle(e); if (/(hidden|auto|scroll|clip)/.test(c.overflowX + ' ' + c.overflowY) || c.transform !== 'none' || c.filter !== 'none') r.push(e.tagName + '.' + e.className); } return { r, arriba: getComputedStyle(document.getElementById('lugar')).getPropertyValue('--lugar-arriba').trim() }; });
    comprobar(anc.r.length === 0 && anc.arriba !== '', 'el escenario sticky del 3D puede pegarse: ningún antepasado con overflow, transform ni filter, y --lugar-arriba puesto', anc);
    await c3.page.locator('#lugar').scrollIntoViewIfNeeded();
    const ok = await c3.page.waitForFunction(() => { const el = document.querySelector('[data-modulo="lugar"]'); return el.dataset.montado === '1' && el.dataset.modo === 'plano'; }, null, { timeout: 10000 }).then(() => true, () => false);
    await c3.page.waitForFunction(() => [...document.querySelectorAll('.lugar__vista img, .lugar__pueblo img')].every((i) => i.complete && i.naturalWidth > 0), null, { timeout: 8000 }).catch(() => {});
    const p3 = await c3.page.evaluate(() => { const el = document.querySelector('[data-modulo="lugar"]'); const imgs = [...el.querySelectorAll('.lugar__vista img, .lugar__pueblo img')]; return { montado: el.dataset.montado, modo: el.dataset.modo, imgs: imgs.length, cargadas: imgs.filter((i) => i.complete && i.naturalWidth > 0).length, marcas: [...el.querySelectorAll('.lugar__marca')].filter((m) => !m.hidden && getComputedStyle(m).display !== 'none').length, sc: document.documentElement.scrollWidth <= document.documentElement.clientWidth }; });
    comprobar(ok && p3.imgs >= 2 && p3.cargadas === p3.imgs && p3.marcas > 0 && p3.sc, 'con js/lugar.js y sin WebGL: data-montado="1", data-modo="plano", cargan las imágenes del plan B y hay marcas (sin scroll lateral)', p3);
    comprobar(c3.page._errores.length === 0, 'el módulo del 3D (plan B) no da errores', c3.page._errores.slice(0, 3));
    await c3.ctx.close();
  } else nota('aún no está js/lugar.js');
  }

  /* ---------- 12. con movimiento, una vez y al final ---------- */
  if (toca(12)) {
  console.log('\n12. Con movimiento (una vez): la portada que se separa, el rótulo que llega al logo, el gesto, la recarga, titulares y el pie');
  {
    const { ctx, page } = await nueva({ reducedMotion: 'no-preference' }, { script: sinCookies });
    await page.goto(PAG);
    await page.waitForFunction(() => document.getElementById('portada').classList.contains('es-viva'), null, { timeout: 5000 }).catch(() => {});
    const leerP = () => page.evaluate(() => {
      const sc = (s) => { const t = getComputedStyle(document.querySelector(s)).transform; const m = t.match(/matrix\(([^)]+)\)/); return m ? +m[1].split(',')[0] : 1; };
      const r = document.querySelector('.rotulo').getBoundingClientRect(), l = document.querySelector('.marca__rotulo').getBoundingClientRect();
      return { viva: document.getElementById('portada').classList.contains('es-viva'), y: scrollY, monte: sc('.capa--monte'), agua: sc('.capa--agua'), casa: sc('.capa--casa'), rot: { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width) }, logo: { x: Math.round(l.left), y: Math.round(l.top), w: Math.round(l.width), op: getComputedStyle(document.querySelector('.marca__rotulo')).opacity }, rotOp: getComputedStyle(document.querySelector('.rotulo')).opacity, sc: document.getElementById('cab').classList.contains('sc') };
    });
    const p0 = await leerP();
    await page.mouse.move(640, 400);
    // el gesto con ratón: arrastrar en horizontal desliza el rótulo por detrás del tejado y vuelve al soltar
    await page.mouse.move(500, 300); await page.mouse.down();
    for (let i = 1; i <= 8; i++) { await page.mouse.move(500 + i * 20, 302); await page.waitForTimeout(16); }
    const dur = await leerP();
    await page.mouse.up();
    await page.waitForTimeout(900);
    const tras = await leerP();
    comprobar(dur.rot.x > p0.rot.x + 40 && Math.abs(tras.rot.x - p0.rot.x) <= 1, 'gesto con ratón: arrastrar desliza el rótulo detrás de la casa y al soltar vuelve (muelle)', { antes: p0.rot.x, durante: dur.rot.x, despues: tras.rot.x });
    const pasos = [];
    for (let i = 0; i < 9; i++) { await page.mouse.wheel(0, 90); await page.waitForTimeout(70); pasos.push(await leerP()); }
    const recorrido = await page.evaluate(() => parseFloat(document.getElementById('portada').style.getPropertyValue('--recorrido')));
    await page.evaluate((y) => scrollTo(0, y), recorrido);
    await page.waitForTimeout(250);
    const pF = await leerP();
    const casas = [p0, ...pasos, pF].map((p) => p.casa.toFixed(3));
    comprobar(p0.viva && p0.casa === 1 && p0.logo.op === '0' && pasos.every((p, i) => i === 0 || p.casa >= pasos[i - 1].casa - 1e-4) && pF.casa > pF.agua && pF.agua > pF.monte && pF.monte > 1, `al bajar, las capas se separan: la casa crece más que el agua y el agua más que el monte (casa ${casas.join(' → ')})`, { p0, pF });
    const llega = Math.abs(pF.rot.x - pF.logo.x) <= 4 && Math.abs(pF.rot.y - pF.logo.y) <= 4 && Math.abs(pF.rot.w - pF.logo.w) <= 4;
    comprobar(llega && pF.logo.op === '1' && pF.rotOp === '0' && pasos.some((p) => p.rot.w < p0.rot.w * 0.8 && p.rot.w > pF.logo.w), `el rótulo se encoge (${p0.rot.w} → ${pF.rot.w} px) y llega al logo de la cabecera (${pF.logo.w} px), que aparece`, { rot: pF.rot, logo: pF.logo });
    await page.mouse.wheel(0, 200); await page.waitForTimeout(200);
    comprobar(await page.evaluate(() => document.getElementById('cab').classList.contains('sc')), 'pasada la portada, la cabecera toma su fondo');
    // recarga a media página → arriba
    for (let i = 0; i < 6; i++) { await page.mouse.wheel(0, 300); await page.waitForTimeout(40); }
    await page.reload();
    await page.waitForTimeout(600);
    comprobar(await page.evaluate(() => scrollY) === 0, 'recargar a media página: vuelve arriba (scrollY === 0)', await page.evaluate(() => scrollY));
    comprobar(page._errores.length === 0, 'con movimiento no hay errores (escritorio)', page._errores.slice(0, 3));
    await ctx.close();
  }
  {
    const { ctx, page } = await nueva({ reducedMotion: 'no-preference', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }, { script: sinCookies });
    await page.goto(PAG);
    await page.waitForFunction(() => document.getElementById('portada').classList.contains('es-viva'), null, { timeout: 5000 }).catch(() => {});
    const cdp = await ctx.newCDPSession(page);
    const rx = () => page.evaluate(() => Math.round(document.querySelector('.rotulo').getBoundingClientRect().left));
    const t = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
    const x0 = await rx();
    await t('touchStart', 120, 300);
    for (let i = 1; i <= 8; i++) { await t('touchMove', 120 + i * 18, 302); await page.waitForTimeout(30); }
    await page.waitForTimeout(80);
    const durante = await rx();
    await t('touchEnd');
    await page.waitForTimeout(900);
    const despues = await rx();
    comprobar(durante > x0 + 30 && Math.abs(despues - x0) <= 1, 'gesto táctil del hero: arrastrar con el dedo desliza el rótulo detrás de la casa y al soltar vuelve (muelle)', { x0, durante, despues });
    const y0 = await page.evaluate(() => scrollY);
    await t('touchStart', 200, 500);
    for (let i = 1; i <= 10; i++) { await t('touchMove', 200, 500 - i * 35); await page.waitForTimeout(16); }
    await t('touchEnd');
    await page.waitForTimeout(500);
    const y1 = await page.evaluate(() => scrollY);
    comprobar(y1 > y0 + 150, 'y el scroll vertical con el dedo sigue siendo de la página (touch-action: pan-y)', { y0, y1 });
    const total = await page.evaluate(() => document.querySelectorAll('[data-aparece]').length);
    for (let pasada = 0; pasada < 2; pasada++) {
      const alto = await page.evaluate(() => document.documentElement.scrollHeight);
      for (let y = 0; y < alto; y += 500) { await page.evaluate((y) => scrollTo(0, y), y); await page.waitForTimeout(50); }
    }
    await page.waitForTimeout(1300);
    const vistos = await page.evaluate(() => [...document.querySelectorAll('[data-aparece]')].map((h) => [h.id, h.classList.contains('es-visto'), getComputedStyle(h).opacity]));
    comprobar(vistos.length === total && vistos.every(([, v, o]) => v && o === '1'), `móvil con movimiento: los ${total} titulares aparecen al pasar`, vistos.filter(([, v]) => !v));
    await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(3200);
    const pie = await page.evaluate(() => ({ escrita: document.querySelector('.pie__letras').classList.contains('es-escrita'), fill: [...document.querySelectorAll('.pie__letras .pl')].map((g) => getComputedStyle(g).fillOpacity), dash: [...document.querySelectorAll('.pie__letras .pl')].map((g) => getComputedStyle(g).strokeDashoffset) }));
    comprobar(pie.escrita && pie.fill.every((o) => o === '1') && pie.dash.every((d) => parseFloat(d) === 0 || d === 'normal' || d === '0px'), 'el objeto se completa en el pie: el rótulo «La Casa» se escribe entero (trazo y relleno de latón)', pie);
    comprobar(page._errores.length === 0, 'con movimiento no hay errores (móvil)', page._errores.slice(0, 3));
    await ctx.close();
  }
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, javaScriptEnabled: false });
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    const page = await ctx.newPage();
    await page.goto(PAG);
    const r = await page.evaluate(() => ({ h1: !!document.querySelector('#portada h1').offsetParent, capas: document.querySelectorAll('#portada .capa').length, rot: getComputedStyle(document.querySelector('.rotulo')).display !== 'none', logo: getComputedStyle(document.querySelector('.marca__rotulo')).opacity, tit: getComputedStyle(document.querySelector('#t-estancias')).opacity, chips: [...document.querySelectorAll('.chip__txt')].filter((p) => getComputedStyle(p).visibility === 'visible').length, cal: !!document.querySelector('#simu noscript'), lugar: !!document.querySelector('[data-modulo="lugar"] img'), pie: getComputedStyle(document.querySelector('.pie__letras .pl')).fillOpacity }));
    comprobar(r.h1 && r.capas === 3 && r.rot && r.logo === '1' && r.tit === '1' && r.chips === 6 && r.cal && r.lugar && r.pie === '1', 'sin JavaScript: la portada compuesta con el rótulo detrás de la casa, el logo, la carta entera, el respaldo del 3D, el rótulo del pie escrito y el simulador remite al teléfono', r);
    await ctx.close();
  }
  }

  /* ---------- 13. LCP en un móvil de gama media (emulado) ---------- */
  if (toca(13)) {
  console.log('\n13. LCP en un móvil de gama media emulado (412×915, DPR 2,625, 4G lento 1,6 Mb/s y 150 ms, CPU ×4; sin el 3D)');
  const res = [];
  for (const rm of ['reduce', 'no-preference']) {
    const { ctx, page } = await nueva({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true, reducedMotion: rm }, { script: sinCookies + `;window.__lcp=[];new PerformanceObserver((l)=>{for(const e of l.getEntries())window.__lcp.push({t:e.startTime,el:e.element?(e.element.tagName+'.'+(e.element.closest('picture')||e.element).className+' '+(e.element.currentSrc||'').split('/').pop()):'',size:e.size})}).observe({type:'largest-contentful-paint',buffered:true});` });
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1.6 * 1024 * 1024 / 8, uploadThroughput: 750 * 1024 / 8 });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await page.goto(PAG, { waitUntil: 'load', timeout: 60000 });
    await page.waitForTimeout(1500);
    const l = await page.evaluate(() => window.__lcp[window.__lcp.length - 1]);
    res.push([rm, l]);
    nota(`${rm}: LCP ${l ? (l.t / 1000).toFixed(2) + ' s' : '?'} · ${l ? l.el : ''}`);
    await ctx.close();
  }
  comprobar(res.every(([, l]) => l && l.t < 3000 && /capa capa--|portada__tit|H1/.test(l.el)), 'LCP por debajo de 3 s en móvil de gama media emulado, y el elemento LCP es la portada (una de sus capas o el titular)', res.map(([rm, l]) => [rm, l && Math.round(l.t), l && l.el]));
  }
} finally {
  await browser.close();
  servidor.close();
}

console.log(`\n${nOk} comprobaciones bien, ${fallos.length} mal`);
if (fallos.length) { console.log('FALLOS:\n - ' + fallos.join('\n - ')); process.exitCode = 1; }
