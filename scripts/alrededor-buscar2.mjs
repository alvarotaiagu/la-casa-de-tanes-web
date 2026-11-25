// Segunda búsqueda en OSM: el pueblo de Tanes y su número 9, la Casa del Agua y el Puerto de Tarna.
import { overpass } from './alrededor-util.mjs';
const q = `[out:json][timeout:60];
(
  node(43.15,-5.50,43.30,-5.30)["place"]["name"~"^(Tanes|Rioseco|Rusecu)",i];
  nwr(around:900,43.2045,-5.3985)["addr:housenumber"];
  nwr(around:900,43.2045,-5.3985)["building"]["name"];
  nwr(43.18,-5.50,43.26,-5.40)["name"~"Agua|Auga",i];
  nwr(43.05,-5.30,43.12,-5.15)["name"~"Tarna",i];
  nwr(43.05,-5.30,43.12,-5.15)["mountain_pass"];
  nwr(43.05,-5.30,43.12,-5.15)["natural"="saddle"];
  node(43.30,-5.90,43.40,-5.80)["place"="city"]["name"="Oviedo"];
);
out center tags;`;
const j = await overpass(q);
for (const e of j.elements) console.log(`${e.type}/${e.id}`.padEnd(18), (e.lat ?? e.center?.lat)?.toFixed(6), (e.lon ?? e.center?.lon)?.toFixed(6), JSON.stringify(e.tags));
