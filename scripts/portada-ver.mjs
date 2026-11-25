/* Comprobación SIN navegador de la composición de la portada (no es una captura: compone las capas con sharp).
   node scripts/portada-ver.mjs [salida]   → <salida>/portada-escritorio.jpg y portada-movil.jpg (por defecto ref/portada/)
   Monta monte + rótulo (latón, con su canto) + agua + casa en el sistema de coordenadas de la foto (2000×1333) y recorta
   lo que se ve en 1280×800 y en 390×844 según data/portada.json. Sirve para colocar el rótulo detrás del tejado. */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire('C:/Users/alvar/Desktop/WEBS NEGOCIOS/alvarotaiagu.github.io/');
const sharp = require('sharp');

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SAL = process.argv[2] || path.join(RAIZ, 'ref/portada');
const P = JSON.parse(fs.readFileSync(path.join(RAIZ, 'data/portada.json'), 'utf8'));
const R = JSON.parse(fs.readFileSync(path.join(RAIZ, 'marca/rotulo.json'), 'utf8'));
const { ancho: FW, alto: FH } = P.foto;
const d = R.glifos.map((g) => g.d).join('');

function rotuloSvg(cfg) {
  const { x, y, ancho } = cfg.rotulo;
  const alto = ancho * R.alto / R.ancho;
  const k = ancho / R.ancho;
  const canto = Math.max(3, ancho * 0.0045) / k;   // grosor del metal, en unidades del rótulo
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${FW}" height="${FH}" viewBox="0 0 ${FW} ${FH}">
  <defs><linearGradient id="l" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${P.laton.luz}"/><stop offset=".55" stop-color="${P.laton.medio}"/><stop offset="1" stop-color="${P.laton.canto}"/></linearGradient></defs>
  <svg x="${x}" y="${y}" width="${ancho}" height="${alto}" viewBox="${R.viewBox}">
    <path d="${d}" fill="${P.laton.canto}" transform="translate(${canto} ${canto})"/>
    <path d="${d}" fill="url(#l)"/>
  </svg></svg>`);
}
async function componer(cfg) {
  return sharp(path.join(RAIZ, 'ref/origen/01.jpg')).composite([
    { input: rotuloSvg(cfg) },
    { input: path.join(RAIZ, 'ref/portada/agua.png') },
    { input: path.join(RAIZ, 'ref/portada/casa.png') },
  ]).png().toBuffer();
}
async function vista(nombre, cfg, vw, vh, altoEscena) {
  const ah = altoEscena ?? vh;                    // alto de la caja que cubre la escena
  const W = Math.max(vw, ah * FW / FH), H = W * FH / FW;
  const ox = (vw - W) * cfg.fx, oy = (ah - H) * cfg.fy;
  const k = FW / W;                               // píxeles de foto por píxel CSS
  const comp = await componer(cfg);
  const left = Math.round(-ox * k), top = Math.round(-oy * k);
  const width = Math.min(FW - left, Math.round(vw * k)), height = Math.min(FH - top, Math.round(ah * k));
  const f = path.join(SAL, `portada-${nombre}.jpg`);
  await sharp(comp).extract({ left, top, width, height }).resize(vw * 2, Math.round(ah * 2)).jpeg({ quality: 82 }).toFile(f);
  console.log(f, `${vw}×${ah}`, `foto x ${left}…${left + width}, y ${top}…${top + height}`);
}
fs.mkdirSync(SAL, { recursive: true });
await vista('escritorio', P.escritorio, 1280, 800);
await vista('movil', P.movil, 390, 844, Math.round(844 * parseFloat(P.movil.alto) / 100));
