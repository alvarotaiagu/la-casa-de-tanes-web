/* Las tres capas de la portada en la web (de scripts/portada-capas.py):
     img/portada/monte-<w>.{avif,webp,jpg}   la foto 01 entera (sin gradar: las capas recortadas son sus mismos píxeles)
     img/portada/agua-<w>.{avif,webp}        el embalse y el pueblo, con transparencia
     img/portada/casa-<w>.{avif,webp}        la casona y el jardín, con transparencia
   Anchos 2000 (el real: nunca se amplía), 1500 y 1000. Mismo remuestreo (lanczos3) en las tres, para que no se vea
   costura entre capas en reposo.   Uso: node scripts/portada-imagenes.mjs */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire('C:/Users/alvar/Desktop/WEBS NEGOCIOS/alvarotaiagu.github.io/');
const sharp = require('sharp');

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SAL = path.join(RAIZ, 'img/portada');
fs.mkdirSync(SAL, { recursive: true });
const ANCHOS = [2000, 1500, 1000];
const capas = [
  ['monte', path.join(RAIZ, 'ref/origen/01.jpg'), false],
  ['agua', path.join(RAIZ, 'ref/portada/agua.png'), true],
  ['casa', path.join(RAIZ, 'ref/portada/casa.png'), true],
];
const info = { ancho: 2000, alto: 1333, anchos: ANCHOS, capas: {} };
for (const [nombre, src, alfa] of capas) {
  info.capas[nombre] = [];
  for (const w of ANCHOS) {
    const p = sharp(src).resize({ width: w, kernel: 'lanczos3', withoutEnlargement: true });
    const base = path.join(SAL, `${nombre}-${w}`);
    await p.clone().avif({ quality: alfa ? 55 : 52, effort: 5 }).toFile(base + '.avif');
    await p.clone().webp({ quality: 78, alphaQuality: 90 }).toFile(base + '.webp');
    if (!alfa) await p.clone().jpeg({ quality: 82, mozjpeg: true }).toFile(base + '.jpg');
    const kb = (f) => Math.round(fs.statSync(f).size / 1024);
    info.capas[nombre].push({ w, avif: kb(base + '.avif'), webp: kb(base + '.webp') });
    console.log(nombre.padEnd(6), w, 'avif', kb(base + '.avif'), 'KB · webp', kb(base + '.webp'), 'KB');
  }
}
fs.writeFileSync(path.join(SAL, 'portada.json'), JSON.stringify(info, null, 1));
