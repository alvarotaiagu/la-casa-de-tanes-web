/* Comprobación del módulo lugar (agente Lugar 3D). NO pinta el 3D (reglas del PC: el WebGL lo mira Álvaro).
   1. Funciones puras de js/lugar.js en Node (vm): sol y luna en Tanes, el recorrido (sin pasarse ni meterse en el agua).
   2. Datos de img/lugar/: ficheros, cajas, casa del Catastro, lugares, peso.
   3. Plan B en Chromium SIN WebGL (--disable-3d-apis + navigator.webdriver), escritorio y móvil: monta, imágenes,
      marcas, alturas PNG bien decodificadas (canvas 2D), holgura de la cámara sobre el relieve, sin errores,
      destruir() repone el respaldo.
   4. Móvil con el 3D posible (?lugar=3d) y la escena con un WebGLRenderer FALSO que no pinta: botón «Ver el vuelo
      en 3D», montaje de la escena, recorrido, rótulos, paradas, pausa fuera de pantalla. Los shaders NO se compilan.
   Uso: node scripts/lugar-prueba.mjs                  (servidor propio en el puerto 8952; se cierra al acabar)
        node scripts/lugar-prueba.mjs --sin-navegador  (solo 1 y 2)
   Un solo navegador, ventanas pequeñas, escala 1. */
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUERTO = 8952;
let fallos = 0, bien = 0;
const ok = (c, txt) => { if (c) { bien++; console.log('  ok  ', txt); } else { fallos++; console.log('  MAL ', txt); } };

/* ---------- 1. funciones puras ---------- */
console.log('1. funciones puras');
const ctx = { window: {}, document: { currentScript: null }, location: { href: 'http://localhost/', search: '' }, URL, URLSearchParams, Intl, Math, Date, console };
ctx.window = ctx; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(RAIZ, 'js/lugar.js'), 'utf8'), ctx, { filename: 'lugar.js' });
const L = ctx.Tanes.lugar;
ok(typeof L.montar === 'function', 'expone Tanes.lugar.montar');
// mediodía solar en Tanes (−5,40°): ~12:22 UTC. Solsticio de verano ~70°, de invierno ~23°, al sur
const s = L.sol(new Date('2026-06-21T12:22:00Z'));
ok(s.alt > 68.5 && s.alt < 71.5 && s.az > 170 && s.az < 195, `sol 21-jun 12:22 UTC: ${s.alt.toFixed(1)}° alt, ${s.az.toFixed(0)}° az`);
const s2 = L.sol(new Date('2026-12-21T12:22:00Z'));
ok(s2.alt > 22 && s2.alt < 25, `sol 21-dic 12:22 UTC: ${s2.alt.toFixed(1)}°`);
const s3 = L.sol(new Date('2026-11-25T23:00:00Z'));
ok(s3.alt < -40, `de noche en Tanes (25-nov 00:00 hora local): sol a ${s3.alt.toFixed(0)}°`);
const l = L.luna(new Date('2026-11-24T22:00:00Z'));
ok(l.luz >= 0 && l.luz <= 1 && l.fase >= 0 && l.fase <= 1, `luna: ${(l.luz * 100).toFixed(0)} % iluminada, fase ${l.fase.toFixed(2)}`);
ok(/Tanes/.test(L.fraseCielo(new Date())), 'frase del cielo: ' + L.fraseCielo(new Date()));

const meta = JSON.parse(fs.readFileSync(path.join(RAIZ, 'img/lugar/lugar.json'), 'utf8'));
const ruta = L.camino(meta.recorrido);
let pasaDeLargo = 0, salto = 0, prev = null, minAlt = 1e9;
for (let i = 0; i <= 4000; i++) {
  const p = i / 4000, r = ruta(p);
  for (let k = 0; k < 3; k++) {
    const vs = meta.recorrido.map((x) => x.pos[k]);
    if (r.pos[k] < Math.min(...vs) - 0.01 || r.pos[k] > Math.max(...vs) + 0.01) pasaDeLargo++;
  }
  if (prev) salto = Math.max(salto, Math.hypot(r.pos[0] - prev[0], r.pos[1] - prev[1], r.pos[2] - prev[2]));
  prev = r.pos; minAlt = Math.min(minAlt, r.pos[1]);
}
ok(pasaDeLargo === 0, 'el recorrido no se sale del rango de sus puntos');
ok(salto < 12, `paso máximo entre 1/4000 de scroll: ${salto.toFixed(2)} m`);
ok(minAlt > meta.nivel + 1.5, `la cámara nunca baja de ${(minAlt - meta.nivel).toFixed(1)} m sobre el agua`);
const r1 = ruta(1);
ok(Math.hypot(r1.pos[0] - meta.casona.rect.cx, r1.pos[2] - meta.casona.rect.cz) < 400, `al final, la cámara a ${Math.hypot(r1.pos[0] - meta.casona.rect.cx, r1.pos[2] - meta.casona.rect.cz).toFixed(0)} m de la casa`);

/* ---------- 2. datos ---------- */
console.log('2. datos de img/lugar/');
const dir = path.join(RAIZ, 'img/lugar');
const usados = new Set(['lugar.json', meta.orto.agua.archivo, ...meta.planB.vista.archivos, ...meta.planB.poster.archivos, meta.planB.plano.archivo]);
Object.values(meta.rasters).forEach((r) => usados.add(r.archivo));
['cerca', 'pueblo', 'lejos'].forEach((k) => Object.values(meta.orto[k].archivos).forEach((a) => usados.add(a)));
usados.forEach((f) => ok(fs.existsSync(path.join(dir, f)), 'existe ' + f));
const sobran = fs.readdirSync(dir).filter((f) => !usados.has(f));
ok(sobran.length === 0, 'ningún fichero sin usar en img/lugar/' + (sobran.length ? ': ' + sobran.join(', ') : ''));
const tam = (f) => fs.statSync(path.join(dir, f)).size;
const peso = fs.readdirSync(dir).reduce((a, f) => a + tam(f), 0);
ok(peso < 5e6, `peso de img/lugar/: ${(peso / 1048576).toFixed(2)} MB`);
const three = fs.statSync(path.join(RAIZ, 'vendor/three-0.160.0.module.min.js')).size;
const comun = ['lugar.json', meta.orto.agua.archivo, ...Object.values(meta.rasters).map((r) => r.archivo), meta.orto.lejos.archivos.alta];
const pesoEsc = [...comun, meta.orto.cerca.archivos.alta, meta.orto.pueblo.archivos.alta, 'vista-penas-1600.webp'].reduce((a, f) => a + tam(f), 0) + three;
const pesoMov = [...comun, meta.orto.cerca.archivos.baja, meta.orto.pueblo.archivos.baja].reduce((a, f) => a + tam(f), 0) + three;
const pesoB = ['lugar.json', 'vista-espejo-960.webp', meta.planB.plano.archivo].reduce((a, f) => a + tam(f), 0);
console.log(`       lo que baja el 3D: escritorio ${(pesoEsc / 1048576).toFixed(2)} MB · móvil (tras el botón) ${(pesoMov / 1048576).toFixed(2)} MB (Three.js incluido, sin gzip) · plan B ${(pesoB / 1024).toFixed(0)} KB`);
const C = meta.rasters.cerca;
const dentro = (r, x, z) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1;
const casa = meta.edificios.find((e) => e.tipo === 'casa');
ok(casa && casa.id === '000608200UN08F', 'la casa es el edificio 000608200UN08F del Catastro (LG TANES 9)');
ok(meta.casona.rect.largo > 8 && meta.casona.rect.largo < 20 && meta.casona.rect.fondo > 6, `planta de la casona: ${meta.casona.rect.largo} × ${meta.casona.rect.fondo} m`);
ok(meta.casona.galeria.rumbo > 135 && meta.casona.galeria.rumbo < 315, `la galería mira al ${meta.casona.galeria.rumbo}° (hacia el agua, del sureste al noroeste por el sur)`);
ok(dentro(meta.rasters.pueblo, meta.casona.rect.cx, meta.casona.rect.cz), 'la casa cae dentro del relieve del pueblo');
for (const lu of meta.lugares) ok(dentro(C, lu.x, lu.z), `${lu.nombre}${lu.sub ? ' (' + lu.sub + ')' : ''} dentro del relieve cercano (${lu.x.toFixed(0)}, ${lu.z.toFixed(0)}) [${lu.osm || lu.nota}]`);
ok(meta.lugares.some((x) => x.clave === 'embalse') && meta.lugares.some((x) => x.clave === 'tanes') && meta.lugares.some((x) => x.tipo === 'casa'), 'rótulos: embalse, Tanes y La Casa');
ok(meta.lugares.filter((x) => x.tipo === 'pico').every((x) => /^(node|way|relation)\/\d+$/.test(x.osm)), 'todas las peñas rotuladas vienen de OSM');
ok(Array.isArray(meta.arboles) && meta.arboles.length > 50, `árboles: ${meta.arboles.length}`);
ok(meta.edificios.length > 30, `edificios del pueblo: ${meta.edificios.length}`);

/* ---------- 3. plan B en el navegador, sin WebGL ---------- */
if (process.argv.includes('--sin-navegador')) { console.log(`\n${bien} bien, ${fallos} mal (sin navegador)`); process.exit(fallos ? 1 : 0); }
console.log('3. plan B en Chromium sin WebGL');
const require = createRequire('C:/Users/alvar/Desktop/WEBS NEGOCIOS/alvarotaiagu.github.io/');
const { chromium } = require('playwright');
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg' };
const srv = http.createServer((req, res) => {
  const f = path.join(RAIZ, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!f.startsWith(RAIZ) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TIPOS[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});
await new Promise((r) => srv.listen(PUERTO, r));
const browser = await chromium.launch({ args: ['--disable-3d-apis', '--disable-webgl', '--disable-gpu'] });
try {
  for (const [w, h] of [[1280, 800], [390, 844]]) {
    const ctxB = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, reducedMotion: 'reduce', isMobile: w < 800, hasTouch: w < 800 });
    const page = await ctxB.newPage();
    const errores = [];
    page.on('pageerror', (e) => errores.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
    page.on('requestfailed', (r) => errores.push('falla ' + r.url()));
    await page.goto(`http://localhost:${PUERTO}/scripts/lugar-prueba.html`);
    await page.waitForFunction(() => document.querySelector('[data-modulo="lugar"]').dataset.montado === '1');
    await page.locator('#lugar').scrollIntoViewIfNeeded();
    await page.waitForFunction(() => document.querySelectorAll('.lugar__vista .lugar__marca').length > 0, null, { timeout: 8000 });
    await page.waitForFunction(() => [...document.querySelectorAll('.lugar__planob img')].every((i) => i.complete && i.naturalWidth > 0), null, { timeout: 8000 });
    const r = await page.evaluate(() => {
      const el = document.querySelector('[data-modulo="lugar"]');
      const pista = el.querySelector('.lugar__pista');
      const vis = (s) => { const n = el.querySelector(s); return !!n && n.getBoundingClientRect().height > 0 && getComputedStyle(n).display !== 'none'; };
      return {
        modo: el.dataset.modo, pistaVisible: getComputedStyle(pista).display !== 'none',
        planob: vis('.lugar__planob'), vista: vis('.lugar__vista img'), pueblo: vis('.lugar__pueblo img'),
        marcasVista: [...el.querySelectorAll('.lugar__vista .lugar__marca')].filter((m) => !m.hidden).map((m) => m.textContent),
        marcasPueblo: [...el.querySelectorAll('.lugar__pueblo .lugar__marca')].map((m) => m.textContent),
        pasos: el.querySelectorAll('.lugar__pasos li').length, ahora: el.querySelector('[data-l="ahora2d"]').textContent,
        fuente: el.querySelector('.lugar__fuente').textContent,
        boton: !el.querySelector('[data-l="a3d"]').hidden, lienzo: !!el.querySelector('canvas'),
        anchoDoc: document.documentElement.scrollWidth, anchoVista: innerWidth,
      };
    });
    console.log(`   ${w}×${h}`);
    ok(r.modo === 'plano' && !r.pistaVisible && !r.lienzo, 'plan B, sin pista y sin lienzo (no se pinta WebGL)');
    ok(r.planob && r.vista && r.pueblo, 'se ven la vista desde el agua y el pueblo desde el aire');
    ok(r.marcasVista.length >= 2, 'marcas en la vista: ' + r.marcasVista.join(' · '));
    ok(r.marcasVista.some((t) => /La Casa/.test(t)), 'La Casa marcada en la vista');
    ok(r.marcasPueblo.length === 1 && /La Casa/.test(r.marcasPueblo[0]), 'La Casa marcada en el plano del pueblo');
    ok(r.pasos === 4 && /Tanes/.test(r.ahora), 'cuatro paradas y el cielo de ahora');
    ok(/IGN \/ CNIG, CC BY 4\.0/.test(r.fuente), 'cita «© IGN / CNIG, CC BY 4.0»');
    ok(!r.boton, 'sin botón 3D cuando no hay WebGL');
    ok(r.anchoDoc <= r.anchoVista, `sin scroll horizontal (${r.anchoDoc} ≤ ${r.anchoVista})`);
    if (w === 1280) {
      // alturas decodificadas en canvas 2D: casa ~511 m, agua (fondo inventado) < 490, cumbre lejana > 1.500 m;
      // y la holgura de la cámara sobre el relieve a lo largo de todo el recorrido (con el camino real del módulo)
      const alt = await page.evaluate(async () => {
        const m = await (await fetch('../img/lugar/lugar.json')).json();
        const dec = async (r) => {
          const b = await (await fetch('../img/lugar/' + r.archivo)).blob();
          const bmp = await createImageBitmap(b, { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
          const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
          const g = c.getContext('2d'); g.drawImage(bmp, 0, 0); const d = g.getImageData(0, 0, c.width, c.height).data;
          const at = (x, z) => { const i = Math.round((x - r.x0) / (r.x1 - r.x0) * (c.width - 1)), j = Math.round((z - r.z0) / (r.z1 - r.z0) * (c.height - 1)); const k = (j * c.width + i) * 4; return (d[k] * 256 + d[k + 1]) / 10 - 100; };
          return { at, w: c.width, h: c.height, r };
        };
        const P = await dec(m.rasters.pueblo), M = await dec(m.rasters.medio), C = await dec(m.rasters.cerca), Lj = await dec(m.rasters.lejos);
        const den = (o, x, z) => x >= o.r.x0 && x <= o.r.x1 && z >= o.r.z0 && z <= o.r.z1;
        const h = (x, z) => (den(P, x, z) ? P : den(M, x, z) ? M : den(C, x, z) ? C : Lj).at(x, z);
        const ruta = window.Tanes.lugar.camino(m.recorrido);
        let holg = 1e9, enP = 0;
        for (let i = 0; i <= 3000; i++) { const p = i / 3000, q = ruta(p).pos, g = q[1] - Math.max(m.nivel, h(q[0], q[2])); if (g < holg) { holg = g; enP = p; } }
        let maxL = -1e9; for (let i = 0; i < Lj.w; i += 2) for (let j = 0; j < Lj.h; j += 2) maxL = Math.max(maxL, Lj.at(Lj.r.x0 + i / (Lj.w - 1) * (Lj.r.x1 - Lj.r.x0), Lj.r.z0 + j / (Lj.h - 1) * (Lj.r.z1 - Lj.r.z0)));
        return { casa: P.at(m.casona.rect.cx, m.casona.rect.cz), suelo: m.casona.suelo, agua: M.at(m.recorrido.at(-1).pos[0], m.recorrido.at(-1).pos[2]), maxL, holg, enP, dims: [P.w, P.h, m.rasters.pueblo.w, m.rasters.pueblo.h] };
      });
      ok(alt.dims[0] === alt.dims[2] && alt.dims[1] === alt.dims[3], 'tamaño del PNG de alturas = el del JSON');
      ok(alt.casa > 500 && alt.casa < 525 && Math.abs(alt.casa - alt.suelo) < 6, `altura en la casa: ${alt.casa.toFixed(1)} m (suelo del Catastro ${alt.suelo})`);
      ok(alt.agua < meta.nivel, `bajo la cámara final, agua (fondo a ${alt.agua.toFixed(1)} m, lámina a ${meta.nivel} m)`);
      ok(alt.maxL > 1500, `cumbres del anillo lejano hasta ${alt.maxL.toFixed(0)} m`);
      ok(alt.holg > 1.5, `holgura mínima de la cámara sobre el relieve o el agua: ${alt.holg.toFixed(1)} m (en p = ${alt.enP.toFixed(3)})`);
      const rep = await page.evaluate(() => { window.__lugar.destruir(); const el = document.querySelector('[data-modulo="lugar"]'); return { resp: !!el.querySelector('figure.respaldo'), clase: el.classList.contains('lugar') }; });
      ok(rep.resp && !rep.clase, 'destruir() repone el HTML de respaldo');
    }
    ok(errores.length === 0, 'sin errores en consola' + (errores.length ? ': ' + errores.join(' | ') : ''));
    await ctxB.close();
  }

  /* ---------- 4. móvil con botón y escena 3D con un renderizador FALSO (no pinta) ---------- */
  console.log('4. botón del móvil y escena 3D con renderizador falso (no pinta)');
  const ENVOLTORIO = `import * as T from '/vendor/three-0.160.0.module.min.js?real';
export * from '/vendor/three-0.160.0.module.min.js?real';
export class WebGLRenderer {
  constructor(o) { this.domElement = o.canvas; this.shadowMap = { enabled: false, type: 0, autoUpdate: true, needsUpdate: false };
    this.capabilities = { getMaxAnisotropy: () => 8 }; this.info = { render: { triangles: 0, calls: 0 } }; this._pr = 1; this.clippingPlanes = []; this._rt = null;
    window.__pintadas = 0; window.__reflejos = 0; }
  setPixelRatio(v) { this._pr = v; } getPixelRatio() { return this._pr; } setSize() {} compile() {}
  setRenderTarget(rt) { this._rt = rt; }
  render(esc, cam) {
    if (this._rt) { window.__reflejos++; if (!this.clippingPlanes.length) throw new Error('reflejo sin plano de recorte'); if (cam.position.y > ${meta.nivel}) throw new Error('cámara del reflejo por encima del agua'); return; }
    window.__pintadas++; let tri = 0, calls = 0;
    esc.traverse((o) => { if ((o.isMesh || o.isPoints || o.isSprite) && o.visible && o.geometry) { calls++; const g = o.geometry; const n = g.index ? g.index.count : g.attributes.position.count; tri += n / 3 * (o.isInstancedMesh ? o.count : 1);
      const pa = g.attributes.position && g.attributes.position.array; if (pa && !window.__nan) { for (let i = 0; i < pa.length; i += 97) if (!Number.isFinite(pa[i])) { window.__nan = (o.name || o.type) + ' ' + i; break; } } } });
    this.info.render.triangles = tri; this.info.render.calls = calls;
    if (![cam.position.x, cam.position.y, cam.position.z].every(Number.isFinite)) throw new Error('cámara con NaN');
    window.__cam = [cam.position.x, cam.position.y, cam.position.z, cam.near, cam.fov];
  }
  dispose() { window.__liberado = true; } forceContextLoss() {}
}`;
  // 4a. móvil: plan B con el botón; al pulsarlo, el 3D
  const ctxM = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const pm = await ctxM.newPage();
  const errM = [];
  pm.on('pageerror', (e) => errM.push(String(e)));
  pm.on('console', (m) => { if (m.type() === 'error') errM.push(m.text()); });
  await pm.route((u) => u.pathname.endsWith('/vendor/three-0.160.0.module.min.js') && !u.search.includes('real'),
    (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: ENVOLTORIO }));
  await pm.goto(`http://localhost:${PUERTO}/scripts/lugar-prueba.html?lugar=3d`);
  await pm.waitForFunction(() => document.querySelector('[data-modulo="lugar"]').dataset.montado === '1');
  const m0 = await pm.evaluate(() => ({ modo: document.querySelector('[data-modulo="lugar"]').dataset.modo, boton: !document.querySelector('[data-l="a3d"]').hidden, texto: document.querySelector('[data-l="a3d"]').textContent, lienzo: !!document.querySelector('.lugar canvas') }));
  ok(m0.modo === 'plano' && m0.boton && !m0.lienzo, `móvil: plan B con el botón «${m0.texto}» y sin cargar el 3D`);
  await pm.locator('[data-l="a3d"]').click();
  await pm.waitForFunction(() => window.__pintadas > 0, null, { timeout: 30000 });
  const m1 = await pm.evaluate(() => ({ modo: document.querySelector('[data-modulo="lugar"]').dataset.modo, est: window.__lugar.estado() }));
  ok(m1.modo === '3d' && m1.est.t3, 'móvil: el botón monta el 3D');
  ok(errM.length === 0, 'móvil: sin errores en consola' + (errM.length ? ': ' + errM.join(' | ') : ''));
  await ctxM.close();

  // 4b. escritorio: la escena entera y el recorrido
  const ctx3 = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, reducedMotion: 'no-preference' });
  const page = await ctx3.newPage();
  const errores = [];
  page.on('pageerror', (e) => errores.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' || (m.type() === 'warning' && /Lugar/.test(m.text()))) errores.push(m.text()); });
  await page.route((u) => u.pathname.endsWith('/vendor/three-0.160.0.module.min.js') && !u.search.includes('real'),
    (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: ENVOLTORIO }));
  await page.goto(`http://localhost:${PUERTO}/scripts/lugar-prueba.html?lugar=3d`);
  await page.waitForFunction(() => window.__lugar && window.__lugar.estado().t3 && window.__pintadas > 0, null, { timeout: 30000 });
  const e0 = await page.evaluate(() => ({ est: window.__lugar.estado(), modo: document.querySelector('[data-modulo="lugar"]').dataset.modo, nan: window.__nan || null, listo: document.querySelector('.lugar__escenario').classList.contains('lugar--listo'), refl: window.__reflejos }));
  ok(e0.modo === '3d' && e0.listo, 'modo 3D montado y primer fotograma «pintado»');
  ok(e0.refl > 0, 'cada fotograma pinta antes el reflejo (cámara espejada bajo el agua, con plano de recorte)');
  ok(!e0.nan, 'ninguna geometría con NaN' + (e0.nan ? ': ' + e0.nan : ''));
  console.log('       triángulos', Math.round(e0.est.t3.triangulos), '· objetos', e0.est.t3.llamadas, '· ventanas', e0.est.t3.ventanas, '· árboles', e0.est.t3.arboles);
  ok(e0.est.t3.triangulos > 100000 && e0.est.t3.triangulos < 2500000, 'triángulos en un rango razonable');
  const tramos = [[0, 'Las peñas'], [0.35, 'La ladera'], [0.65, 'El embalse'], [0.995, 'La Casa']];
  for (const [p, parada] of tramos) {
    await page.evaluate((p) => { const pista = document.querySelector('.lugar__pista'); const esc = document.querySelector('.lugar__escenario');
      const y0 = pista.getBoundingClientRect().top + scrollY; scrollTo(0, y0 + p * (pista.offsetHeight - esc.offsetHeight)); }, p);
    await page.waitForFunction((p) => { const t = window.__lugar.estado().t3; return t && Math.abs(t.pVis - p) < 0.004; }, p, { timeout: 15000 });
    await page.waitForFunction(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(true)))));
    const r = await page.evaluate(() => ({ rot: [...document.querySelectorAll('.lugar__rotulo.es-visible b')].map((b) => b.textContent), par: (document.querySelector('.lugar__paradas li.es-actual b') || {}).textContent, cam: window.__cam }));
    const casaOk = p < 0.99 || r.rot.includes('La Casa');
    ok(r.par === parada && casaOk && (p > 0 || r.rot.length >= 2), `p=${p}: parada «${r.par}», rótulos: ${r.rot.join(' · ') || '(ninguno)'} · cámara a ${r.cam[1].toFixed(0)} m, near ${r.cam[3].toFixed(2)}`);
  }
  // fuera de pantalla deja de pintar
  await page.evaluate(() => { const d = document.createElement('div'); d.id = 'relleno-prueba'; d.style.height = '3000px'; document.body.appendChild(d); scrollTo(0, document.documentElement.scrollHeight); });
  await page.waitForFunction(() => new Promise((r) => setTimeout(() => r(true), 300)));
  const quieto = await page.evaluate(() => { const a = window.__pintadas; return new Promise((res) => setTimeout(() => res(window.__pintadas - a), 600)); });
  ok(quieto === 0, `fuera de pantalla no pinta (${quieto} fotogramas en 0,6 s)`);
  await page.evaluate(() => { const el = document.querySelector('[data-modulo="lugar"]'); el.scrollIntoView(); });
  await page.evaluate(() => document.querySelector('[data-l="aplano"]').click());
  const pl = await page.evaluate(() => ({ modo: document.querySelector('[data-modulo="lugar"]').dataset.modo, boton: !document.querySelector('[data-l="a3d"]').hidden }));
  ok(pl.modo === 'plano' && pl.boton, '«Ver en plano» vuelve al plan B y ofrece volver al 3D');
  const rep = await page.evaluate(() => { window.__lugar.destruir(); return { resp: !!document.querySelector('[data-modulo="lugar"] figure.respaldo'), lib: !!window.__liberado, lienzo: !!document.querySelector('.lugar__lienzo') }; });
  ok(rep.resp && rep.lib && !rep.lienzo, 'destruir() con el 3D montado libera el renderizador, quita el lienzo y repone el respaldo');
  ok(errores.length === 0, 'sin errores en consola' + (errores.length ? ': ' + errores.join(' | ') : ''));
  await ctx3.close();
} finally {
  await browser.close();
  srv.close();
}
console.log(`\n${bien} bien, ${fallos} mal`);
process.exit(fallos ? 1 : 0);
