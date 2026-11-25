// Utilidades de los scripts de «Alrededor»: Overpass con espejos, OSRM y distancia en línea recta
// (receta de ../casa-benito-san-tirso-web/scripts/eo-util.mjs). User-Agent genérico, sin datos personales.
export const UA = 'maqueta-web-local/1.0 (prueba de maqueta sin publicar)';
const ESPEJOS = ['https://overpass.openstreetmap.fr/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter', 'https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
export const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
export async function overpass(q, { rondas = 3, timeout = 70000 } = {}) {
  for (let ronda = 0; ronda < rondas; ronda++) for (const e of ESPEJOS) {
    try {
      const r = await fetch(e, { method: 'POST', headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'data=' + encodeURIComponent(q), signal: AbortSignal.timeout(timeout) });
      if (r.ok) { const j = await r.json(); if (j.elements) return j; } else console.error(e, r.status);
    } catch (err) { console.error(e, err.message); }
    await dormir(1500);
  }
  throw new Error('Overpass no responde');
}
export async function osrm(a, b, intentos = 4) {
  const url = `https://router.project-osrm.org/route/v1/driving/${a.lon},${a.lat};${b.lon},${b.lat}?overview=false&steps=true&alternatives=false`;
  for (let i = 0; i < intentos; i++) {
    try { const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(40000) }); if (r.ok) { const j = await r.json(); if (j.code === 'Ok') return j; } } catch (e) { /* reintenta */ }
    await dormir(2000);
  }
  throw new Error('OSRM falla ' + url);
}
export const hav = (a, b) => { const r = Math.PI / 180, dx = (b.lon - a.lon) * r * Math.cos(((a.lat + b.lat) / 2) * r), dy = (b.lat - a.lat) * r; return 6371000 * Math.hypot(dx, dy); };
