/* Favicons (de marca/favicon.svg: la L del rótulo en latón sobre castaño) e img/og.jpg (1200×630: la portada
   compuesta, con el rótulo detrás de la casa). Uso: node scripts/marca.mjs   (después de marca-rotulo.py y portada-capas.py) */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire('C:/Users/alvar/Desktop/WEBS NEGOCIOS/alvarotaiagu.github.io/');
const sharp = require('sharp');

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const svg = fs.readFileSync(path.join(RAIZ, 'marca/favicon.svg'));
for (const [f, t] of [['favicon-32.png', 32], ['apple-touch-icon.png', 180], ['icono-192.png', 192], ['icono-512.png', 512]]) {
  await sharp(svg, { density: 600 }).resize(t, t).png().toFile(path.join(RAIZ, 'marca', f));
  console.log('marca/' + f);
}
// og: la misma composición que la portada (scripts/portada-ver.mjs), recortada a 1200×630
const P = JSON.parse(fs.readFileSync(path.join(RAIZ, 'data/portada.json'), 'utf8'));
const R = JSON.parse(fs.readFileSync(path.join(RAIZ, 'marca/rotulo.json'), 'utf8'));
const { x, y, ancho } = P.escritorio.rotulo;
const alto = ancho * R.alto / R.ancho, k = ancho / R.ancho, canto = Math.max(3, ancho * 0.0045) / k;
const d = R.glifos.map((g) => g.d).join('');
const rot = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="2000" height="1333" viewBox="0 0 2000 1333"><defs><linearGradient id="l" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${P.laton.luz}"/><stop offset=".55" stop-color="${P.laton.medio}"/><stop offset="1" stop-color="${P.laton.canto}"/></linearGradient></defs><svg x="${x}" y="${y}" width="${ancho}" height="${alto}" viewBox="${R.viewBox}"><path d="${d}" fill="${P.laton.canto}" transform="translate(${canto} ${canto})"/><path d="${d}" fill="url(#l)"/></svg></svg>`);
const comp = await sharp(path.join(RAIZ, 'ref/origen/01.jpg')).composite([
  { input: rot }, { input: path.join(RAIZ, 'ref/portada/agua.png') }, { input: path.join(RAIZ, 'ref/portada/casa.png') },
]).png().toBuffer();
fs.mkdirSync(path.join(RAIZ, 'img'), { recursive: true });
await sharp(comp).extract({ left: 0, top: 110, width: 2000, height: 1050 }).resize(1200, 630).jpeg({ quality: 84, mozjpeg: true }).toFile(path.join(RAIZ, 'img/og.jpg'));
console.log('img/og.jpg');
