// Busca en OSM (Overpass) la casa y los sitios de «Redes alrededor», para elegir los ids que fija alrededor-rutas.mjs.
//   node scripts/alrededor-buscar.mjs   → ref/raw/osm-candidatos.json (y un resumen por pantalla)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { overpass } from './alrededor-util.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
// el valle de Caso y Sobrescobio, con Tanes en medio
const BB = '43.10,-5.55,43.30,-5.20';
const q = `[out:json][timeout:60];
(
  nwr(${BB})["name"~"Tanes",i];
  nwr(${BB})["addr:place"="Tanes"];
  nwr(${BB})["name"~"Casa del Agua|Apicultura|Deboyu|Debollu|Tarna|Alba|Soto de Agues|Campo de Caso|Parque Natural de Redes|Redes",i];
  nwr(${BB})["tourism"~"apartment|guest_house|chalet|hotel|museum|information|viewpoint"];
  nwr(${BB})["natural"="cave_entrance"];
  nwr(${BB})["mountain_pass"="yes"];
);
out center tags;`;
const j = await overpass(q);
const filas = j.elements.map((e) => ({ id: `${e.type}/${e.id}`, lat: e.lat ?? e.center?.lat, lon: e.lon ?? e.center?.lon, nombre: e.tags.name || '', tags: Object.fromEntries(Object.entries(e.tags).filter(([k]) => /^(name|tourism|natural|place|addr|mountain_pass|highway|amenity|historic|information|route|website|ele)/.test(k))) }));
fs.mkdirSync(path.join(RAIZ, 'ref/raw'), { recursive: true });
fs.writeFileSync(path.join(RAIZ, 'ref/raw/osm-candidatos.json'), JSON.stringify(filas, null, 1));
for (const f of filas) console.log(f.id.padEnd(18), String(f.lat?.toFixed(5)).padEnd(9), String(f.lon?.toFixed(5)).padEnd(9), f.nombre, '|', Object.entries(f.tags).filter(([k]) => k !== 'name').map(([k, v]) => k + '=' + v).join(' '));
