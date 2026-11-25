// Deriva los tonos de página de los colores MEDIDOS (ref/raw/paleta.json) y comprueba el contraste WCAG.
//   node scripts/paleta-derivar.mjs   → imprime la tabla y escribe ref/raw/paleta-derivada.json
// El fondo es el castaño hondo de la galería (medido) llevado a L 0,19 en OKLCH con el mismo matiz; la superficie, a 0,245.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const M = JSON.parse(fs.readFileSync(path.join(RAIZ, 'ref/raw/paleta.json'), 'utf8'));

const hex2rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const delin = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
function oklch(h) {
  const [r, g, b] = hex2rgb(h).map(lin);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b), m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b), s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return { L, C: Math.hypot(a, bb), h: (Math.atan2(bb, a) * 180 / Math.PI + 360) % 360 };
}
function hex({ L, C, h }) {
  const a = C * Math.cos(h * Math.PI / 180), b = C * Math.sin(h * Math.PI / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3, m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3, s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const rgb = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
  return '#' + rgb.map((c) => Math.round(Math.min(1, Math.max(0, delin(c))) * 255).toString(16).padStart(2, '0')).join('').toUpperCase();
}
const lum = (h) => { const [r, g, b] = hex2rgb(h).map(lin); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const cr = (a, b) => { const x = lum(a), y = lum(b); return Math.round(((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)) * 100) / 100; };

const hondo = oklch(M.castano_hondo.hex);
const T = {
  fondo: hex({ L: 0.19, C: hondo.C * 0.62, h: hondo.h }),
  superficie: hex({ L: 0.245, C: hondo.C * 0.6, h: hondo.h }),
  castano: M.castano.hex,
  texto: M.arenisca_luz.hex,
  textoSuave: M.arenisca.hex,
  laton: M.laton.hex,
  almagre: M.almagre_13.hex,
  agua: M.embalse_21.hex,
};
T.almagreTexto = hex({ ...oklch(T.almagre), L: 0.66 });   // el almagre como TEXTO sobre el fondo (la marca no cambia)
const filas = [
  ['texto / fondo', T.texto, T.fondo], ['texto suave / fondo', T.textoSuave, T.fondo], ['latón / fondo', T.laton, T.fondo],
  ['agua / fondo', T.agua, T.fondo], ['texto / superficie', T.texto, T.superficie], ['texto suave / superficie', T.textoSuave, T.superficie],
  ['latón / superficie', T.laton, T.superficie], ['agua / superficie', T.agua, T.superficie], ['texto / almagre (botón)', T.texto, T.almagre],
  ['almagre texto / fondo', T.almagreTexto, T.fondo], ['fondo / latón (botón claro)', T.fondo, T.laton],
];
for (const [k, v] of Object.entries(T)) console.log(k.padEnd(14), v, 'oklch', Object.values(oklch(v)).map((x) => x.toFixed(3)).join(' '));
for (const [n, a, b] of filas) console.log(n.padEnd(30), cr(a, b));
fs.writeFileSync(path.join(RAIZ, 'ref/raw/paleta-derivada.json'), JSON.stringify({ tokens: T, contraste: Object.fromEntries(filas.map(([n, a, b]) => [n, cr(a, b)])) }, null, 1));
