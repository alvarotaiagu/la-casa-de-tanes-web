/* Prepara las fotos de la web (receta de ../amaicha-ribadesella-web/scripts/fotos.mjs).
   Uso: node scripts/fotos.mjs                 (todas)
        node scripts/fotos.mjs bano-verde       (solo esas)
   - Lista, textos alternativos y notas en scripts/fotos-lista.json (rutas relativas a ref/). Salen por NOMBRE:
     img/fotos/<nombre>-<ancho>.{avif,webp,jpg} y img/fotos/fotos.json.
   - NUNCA amplía: anchos 480, 800, 1200, 1600 y 1920 solo si caben, más el ancho real (o `maxAncho`, lo que la foto
     tiene de verdad cuando scripts/fotos-nitidez.py dice que está ampliada: cociente < 0,5).
   - Gradación muy suave (sus fotos ya vienen bien): un poco menos de saturación y, fuera, el verde del césped más
     tranquilo. Sin balance de blancos: la luz cálida de dentro es parte de la casa. */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire('C:/Users/alvar/Desktop/WEBS NEGOCIOS/alvarotaiagu.github.io/');
const sharp = require('sharp');

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const REF = path.join(RAIZ, 'ref');
const SALIDA = path.join(RAIZ, 'img/fotos');
fs.mkdirSync(SALIDA, { recursive: true });

const FOTOS = JSON.parse(fs.readFileSync(path.join(RAIZ, 'scripts/fotos-lista.json'), 'utf8'));
const ANCHOS = [480, 800, 1200, 1600, 1920];
const solo = process.argv.slice(2);

const peso = (h, c, a) => { let d = Math.abs(h - c); if (d > 180) d = 360 - d; return d >= a ? 0 : 0.5 + 0.5 * Math.cos(Math.PI * d / a); };
function gradar(data, canales, f) {
  const sat = f.sat ?? 0.95, ext = f.tipo === 'ext', verde = f.verde ?? 0.7;
  for (let i = 0; i < data.length; i += canales) {
    const r = data[i] / 255, g = data[i + 1] / 255, b = data[i + 2] / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), c = max - min;
    let h = 0;
    if (c > 0) { if (max === r) h = 60 * (((g - b) / c) % 6); else if (max === g) h = 60 * ((b - r) / c + 2); else h = 60 * ((r - g) / c + 4); if (h < 0) h += 360; }
    const s = (max === 0 ? 0 : c / max) * sat * (1 - 0.25 * verde * (ext ? 1 : 0) * peso(h, 105, 55));
    const v = max, cc = v * s, x = cc * (1 - Math.abs(((h / 60) % 2) - 1)), m0 = v - cc;
    let t;
    if (h < 60) t = [cc, x, 0]; else if (h < 120) t = [x, cc, 0]; else if (h < 180) t = [0, cc, x]; else if (h < 240) t = [0, x, cc]; else if (h < 300) t = [x, 0, cc]; else t = [cc, 0, x];
    data[i] = Math.round((t[0] + m0) * 255); data[i + 1] = Math.round((t[1] + m0) * 255); data[i + 2] = Math.round((t[2] + m0) * 255);
  }
  return data;
}

const previo = fs.existsSync(path.join(SALIDA, 'fotos.json')) ? JSON.parse(fs.readFileSync(path.join(SALIDA, 'fotos.json'), 'utf8')) : [];
const salida = [];
for (const f of FOTOS) {
  if (solo.length && !solo.includes(f.nombre)) { const p = previo.find((x) => x.nombre === f.nombre); if (p) salida.push(p); continue; }
  const fuente = path.join(REF, f.ruta);
  if (!fs.existsSync(fuente)) throw new Error(`Falta ${fuente} (${f.nombre})`);
  const { data, info } = await sharp(fuente).rotate().removeAlpha().raw().toBuffer({ resolveWithObject: true });
  gradar(data, info.channels, f);
  const buf = await sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } }).png().toBuffer();
  const W = info.width, H = info.height;
  const tope = Math.min(W, f.maxAncho || W);
  const unicos = [...new Set([...ANCHOS.filter((w) => w < tope - 30), tope])];
  for (const w of unicos) {
    const p = sharp(buf).resize({ width: w, withoutEnlargement: true, kernel: 'lanczos3' }).sharpen({ sigma: 0.5, m1: 0.5, m2: 1 });
    const dst = path.join(SALIDA, `${f.nombre}-${w}`);
    await p.clone().avif({ quality: 50, effort: 5 }).toFile(dst + '.avif');
    await p.clone().webp({ quality: 74 }).toFile(dst + '.webp');
    await p.clone().jpeg({ quality: 80, mozjpeg: true }).toFile(dst + '.jpg');
  }
  const alto = Math.round(H * tope / W);
  salida.push({ nombre: f.nombre, anchos: unicos, ancho: tope, alto, origen: f.ruta, alt: f.alt });
  console.log(f.nombre.padEnd(26), unicos.join(','), `${tope}x${alto}`);
}
fs.writeFileSync(path.join(SALIDA, 'fotos.json'), JSON.stringify(salida, null, 1));
console.log(salida.length + ' fotos');
