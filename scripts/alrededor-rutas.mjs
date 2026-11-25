// Distancias de «Redes alrededor» con OSRM (servidor público router.project-osrm.org, perfil coche, datos de
// OpenStreetMap ODbL). Receta de ../amaicha-ribadesella-web/scripts/alrededor-rutas.mjs. NADA se escribe a ojo.
//   node scripts/alrededor-rutas.mjs   → ref/raw/rutas.json   (lo lee construir.mjs)
// Origen: la parcela de Tanes 9 en el Catastro (RC 000608200UN08F, centroide; en OSM la casa no tiene punto propio).
// Destinos: nodos/vías de OSM buscados con scripts/alrededor-buscar*.mjs el 2026-11-25 (ids abajo).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { osrm, overpass, dormir, hav, UA } from './alrededor-util.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const CASA = { lat: 43.2053887, lon: -5.3995211, fuente: 'Catastro, parcela de «LG TANES 9 CASO» (RC 000608200UN08F), centroide (Consulta_CPMRC, EPSG:4326)' };

async function aPie(a, b) {
  const u = `https://routing.openstreetmap.de/routed-foot/route/v1/driving/${a.lon},${a.lat};${b.lon},${b.lat}?overview=false`;
  for (let i = 0; i < 4; i++) { try { const r = await fetch(u, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(40000) }); if (r.ok) { const j = await r.json(); if (j.code === 'Ok') return { km: +(j.routes[0].distance / 1000).toFixed(1), minutos: Math.round(j.routes[0].duration / 60), snap_destino_m: Math.round(j.waypoints[1].distance) }; } } catch (e) {} await dormir(2000); }
  return null;
}

const LUGARES = [
  { id: 'museo', nombre: 'Museo de la Apicultura', donde: 'Tanes', grupo: 'cerca', osm: 'node/5751450146', lat: 43.20380, lon: -5.39561, pie: true },
  // La Casa del Agua (centro del Parque, en Rioseco/Rusecu) no tiene punto en OSM: se usa el nodo del pueblo
  { id: 'agua', nombre: 'La Casa del Agua', donde: 'Rioseco (Sobrescobio)', grupo: 'cerca', osm: 'node/84763126 (Rusecu / Rioseco, el pueblo)', lat: 43.221358, lon: -5.455788 },
  // la boca de la cueva junto al «Antiguo trazado AS-17 / Acceso a Cueva Deboyu» (la boca no tiene nombre en OSM)
  { id: 'deboyu', nombre: 'Cueva del Deboyu', donde: 'junto a Campo de Caso', grupo: 'cerca', osm: 'node/123465711 (natural=cave_entrance)', lat: 43.17836, lon: -5.36008 },
  { id: 'centro', nombre: 'Centro del Parque Natural de Redes', donde: 'Campo de Caso', grupo: 'redes', osm: 'way/715094089', lat: 43.18186, lon: -5.34234 },
  { id: 'alba', nombre: 'Ruta del Alba', donde: 'salida en Soto de Agues', grupo: 'redes', osm: 'node/10706971011', lat: 43.20190, lon: -5.46874 },
  { id: 'tarna', nombre: 'Puerto de Tarna', donde: '1490 m, el límite con León', grupo: 'redes', osm: 'node/4374561724', lat: 43.084635, lon: -5.217914 },
  { id: 'oviedo', nombre: 'Oviedo', donde: 'la capital', grupo: 'lejos', osm: null },
  { id: 'aeropuerto', nombre: 'Aeropuerto de Asturias', donde: 'Santiago del Monte', grupo: 'lejos', osm: 'way/35951935', lat: 43.56160, lon: -6.03307 },
];
{
  const j = await overpass('[out:json][timeout:40];node(43.33,-5.89,43.39,-5.81)["place"="city"];out;');
  const n = j.elements.find((e) => /Oviedo/.test(e.tags.name || '') || /Oviedo/.test(e.tags['name:es'] || ''));
  if (!n) throw new Error('Sin el nodo de Oviedo en OSM');
  Object.assign(LUGARES.find((l) => l.id === 'oviedo'), { osm: 'node/' + n.id, lat: n.lat, lon: n.lon });
}
const resumen = (j) => {
  const r = j.routes[0];
  const carreteras = [];
  for (const leg of r.legs) for (const s of leg.steps) { const ref = (s.ref || '').split(';')[0].trim(); if (ref && s.distance > 200 && carreteras[carreteras.length - 1] !== ref) carreteras.push(ref); }
  return { km: +(r.distance / 1000).toFixed(1), minutos: Math.max(1, Math.round(r.duration / 60)), carreteras, snap_destino_m: Math.round(j.waypoints[1].distance), snap_origen_m: Math.round(j.waypoints[0].distance) };
};
const salida = {
  fuente: 'OSRM (router.project-osrm.org, perfil coche, datos de OpenStreetMap ODbL)',
  fecha: new Date().toISOString().slice(0, 10),
  nota: 'Coche: OSRM público. A pie (solo el museo): routing.openstreetmap.de/routed-foot. Tiempos de OSRM con velocidades teóricas, sin tráfico ni paradas: orientativos. «snap_destino_m» = distancia del punto a la carretera más cercana.',
  casa: CASA,
  llegar: LUGARES.map((l) => l.id),
  destinos: {},
};
for (const l of LUGARES) {
  const ida = resumen(await osrm(CASA, l));
  await dormir(900);
  const pie = l.pie ? await aPie(CASA, l) : null;
  salida.destinos[l.id] = { nombre: l.nombre, donde: l.donde, grupo: l.grupo, osm: l.osm, lat: l.lat, lon: l.lon, recta_km: +(hav(CASA, l) / 1000).toFixed(1), desde_casa: ida, ...(pie ? { a_pie: pie } : {}) };
  console.log(l.id.padEnd(11), String(ida.km).padStart(6), 'km', String(ida.minutos).padStart(4), 'min | recta', salida.destinos[l.id].recta_km, 'km | snap', ida.snap_destino_m, 'm |', ida.carreteras.join('>'), pie ? `| a pie ${pie.km} km ${pie.minutos} min` : '');
}
const ov = salida.destinos.oviedo.desde_casa;
salida.contraste = {
  oviedo: { ficha: '30 min', osrm: `${ov.km} km, ${ov.minutos} min`, veredicto: ov.minutos > 45 ? 'la ficha se queda corta: «30 min» es falso' : 'cuadra' },
  museo: { ficha: '550 m', osrm_coche_km: salida.destinos.museo.desde_casa.km, a_pie_km: salida.destinos.museo.a_pie?.km ?? null },
  aeropuerto: { ficha: '91 km', osrm_km: salida.destinos.aeropuerto.desde_casa.km },
  deboyu: { ficha: '4,4 km', osrm_km: salida.destinos.deboyu.desde_casa.km },
  agua: { ficha: '~4–6 km', osrm_km: salida.destinos.agua.desde_casa.km },
};
fs.mkdirSync(path.join(RAIZ, 'ref/raw'), { recursive: true });
fs.writeFileSync(path.join(RAIZ, 'ref/raw/rutas.json'), JSON.stringify(salida, null, 1));
console.log('contraste', JSON.stringify(salida.contraste));
