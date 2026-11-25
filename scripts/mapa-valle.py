"""«Redes alrededor» · los datos de la lámina del valle (el mapa interactivo de la sección 5).

Fuentes (todas abiertas; lo descargado se guarda en ref/raw/mapa-cache/, que no se sirve):
  - Relieve: MDT05, MDT25 y MDT200 del IGN por WCS (servicios.idee.es/wcs-inspire/mdt)        CC BY 4.0, © IGN / CNIG
  - Embalses, ríos, carreteras, pueblos y el límite del Parque: OpenStreetMap por Overpass    ODbL, © colaboradores de OSM
  - Rutas por carretera desde la casa: OSRM (router.project-osrm.org, overview=full)           datos de OSM
  - La casa y los destinos: ref/raw/rutas.json (Catastro + nodos de OSM; scripts/alrededor-rutas.mjs)
Sale:
  - img/mapa/relieve-{valle,redes,lejos}.{webp,avif}   el relieve sombreado en la paleta (castaño y arenisca)
  - js/valle-datos.js   window.TANES_VALLE = { casa, capas, agua, mar?, rios, carreteras, parque, pueblos, destinos }
                        todo en METROS desde la casa (x al este, y al SUR); las rutas, simplificadas
  - ref/raw/rutas-geometria.json   la geometría completa de OSRM de cada ruta (junto a rutas.json)
  - img/mapa/lamina-quieta.{webp,jpg}   la lámina quieta (encuadre «Por Redes»), para sin JS
Uso: python -I -X utf8 scripts/mapa-valle.py   (descarga una vez; luego todo sale de la caché)"""
import json, math, pathlib, time, urllib.parse, urllib.request
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import tifffile

R = pathlib.Path(__file__).resolve().parent.parent
CACHE = R / 'ref' / 'raw' / 'mapa-cache'; CACHE.mkdir(parents=True, exist_ok=True)
OUT = R / 'img' / 'mapa'; OUT.mkdir(parents=True, exist_ok=True)
UA = {'User-Agent': 'maqueta-web-local/1.0 (prueba de maqueta sin publicar)'}   # genérico, sin datos personales
RUTAS = json.loads((R / 'ref/raw/rutas.json').read_text(encoding='utf-8'))
LAT, LON = RUTAS['casa']['lat'], RUTAS['casa']['lon']
KX = 111320 * math.cos(math.radians(LAT)); KY = 110950
def m(lat, lon): return ((lon - LON) * KX, (LAT - lat) * KY)        # x al este, y al sur, metros desde la casa

# las tres cajas del relieve (S, N, O, E): el valle (MDT05), Redes (MDT25) y hasta Oviedo y el aeropuerto (MDT200)
CAJAS = {
    'valle': (43.160, 43.250, -5.490, -5.320, 'Elevacion4258_5', 1600),
    'redes': (43.040, 43.300, -5.560, -5.140, 'Elevacion4258_25', 1600),
    'lejos': (42.980, 43.660, -6.220, -5.080, 'Elevacion4258_200', 1400),
}
# ------------------------------------------------------------------ descargas con caché
def bajar(url, nombre, intentos=5, datos=None):
    f = CACHE / nombre
    if f.exists() and f.stat().st_size > 200:
        return f.read_bytes()
    for k in range(intentos):
        try:
            req = urllib.request.Request(url, data=datos, headers=UA)
            b = urllib.request.urlopen(req, timeout=240).read()
            if nombre.endswith('.tif') and len(b) < 2000:
                raise IOError(b[:160])
            f.write_bytes(b); print('bajado', nombre, len(b) // 1024, 'KB'); return b
        except Exception as e:
            print('falla', nombre, str(e)[:100]); time.sleep(3 + 4 * k)
    raise SystemExit('No se pudo bajar ' + nombre)

ESPEJOS = ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter',
           'https://overpass.kumi.systems/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter']
def overpass(q, nombre):
    f = CACHE / nombre
    if f.exists():
        return json.loads(f.read_text(encoding='utf-8'))
    datos = urllib.parse.urlencode({'data': q}).encode()
    for vuelta in range(4):
        for url in ESPEJOS:
            try:
                j = json.loads(urllib.request.urlopen(urllib.request.Request(url, data=datos, headers=UA), timeout=180).read())
                if j.get('elements'):
                    f.write_text(json.dumps(j), encoding='utf-8'); print('OSM', nombre, len(j['elements']), 'elementos de', url); return j
                print('vacío', url)
            except Exception as e:
                print('falla', url, str(e)[:90])
            time.sleep(2)
        time.sleep(6 * (vuelta + 1))
    raise SystemExit('Overpass no responde (' + nombre + '): probar más tarde o la API 0.6 por trozos')

# ------------------------------------------------------------------ simplificar (Douglas-Peucker en metros)
def dp(pts, eps):
    if len(pts) < 3:
        return pts
    if pts[0] == pts[-1]:   # anillo: se parte por el vértice más lejano al primero (si no, degenera en 2 puntos)
        k = max(range(len(pts)), key=lambda i: (pts[i][0] - pts[0][0]) ** 2 + (pts[i][1] - pts[0][1]) ** 2)
        a, b = dp(pts[:k + 1], eps), dp(pts[k:], eps)
        return a[:-1] + b
    (ax, ay), (bx, by) = pts[0], pts[-1]
    L = math.hypot(bx - ax, by - ay) or 1e-9
    dmax, imax = 0, 0
    for i in range(1, len(pts) - 1):
        px, py = pts[i]
        d = abs((bx - ax) * (ay - py) - (ax - px) * (by - ay)) / L
        if d > dmax: dmax, imax = d, i
    if dmax <= eps:
        return [pts[0], pts[-1]]
    return dp(pts[:imax + 1], eps)[:-1] + dp(pts[imax:], eps)
def plano(pts): return [v for p in pts for v in (round(p[0]), round(p[1]))]

# ------------------------------------------------------------------ 1. el relieve sombreado
OSC = np.array([0x22, 0x13, 0x0d], np.float32)        # el castaño de la lámina (algo más claro que el fondo)
MEDIO = np.array([0x54, 0x38, 0x2e], np.float32)      # castaño de la galería
CLARO = np.array([0xe6, 0xd6, 0xc5], np.float32)      # arenisca al sol
MAR = np.array([0x14, 0x24, 0x22], np.float32)
def relieve(clave):
    S, N, O, E, cov, ancho = CAJAS[clave]
    url = ('https://servicios.idee.es/wcs-inspire/mdt?SERVICE=WCS&VERSION=2.0.1&REQUEST=GetCoverage'
           f'&COVERAGEID={cov}&FORMAT=image/tiff&SUBSET=Lat({S},{N})&SUBSET=Long({O},{E})')
    bajar(url, f'mdt-{clave}.tif')
    z = tifffile.imread(CACHE / f'mdt-{clave}.tif').astype(np.float32)
    if z.ndim == 3: z = z[..., 0]
    mar = (z <= 0.5) | (z < -1000)
    z[mar] = 0
    filas, cols = z.shape
    dx = (E - O) * KX / cols; dy = (N - S) * KY / filas
    gy, gx = np.gradient(z, dy, dx)           # gy: hacia el sur (filas), gx: hacia el este
    exag = 1.6 if clave == 'lejos' else 1.25
    # luz del noroeste, a 40° (norma cartográfica): n = (-gx, gy, 1) con y hacia el norte = -filas
    nx, ny, nz = -gx * exag, gy * exag, np.ones_like(z)
    nn = np.sqrt(nx * nx + ny * ny + nz * nz)
    az, al = math.radians(315), math.radians(40)
    lx, ly, lz = math.sin(az) * math.cos(al), math.cos(az) * math.cos(al), math.sin(al)
    h = np.clip((nx * lx + ny * ly + nz * lz) / nn, 0, 1)
    # segunda luz suave del norte, para que las laderas en sombra no se queden en negro
    h2 = np.clip((ny * math.cos(math.radians(60)) + nz * math.sin(math.radians(60))) / nn, 0, 1)
    luz = 0.78 * h + 0.22 * h2
    alto = np.clip((z - 200) / 1700, 0, 1)
    k = np.clip(luz, 0, 1) ** 1.7 * (0.30 + 0.50 * alto)
    medio_k = np.clip(alto * 0.9, 0, 1)[..., None]
    base = OSC * (1 - medio_k) + MEDIO * medio_k * 0.55 + OSC * medio_k * 0.45
    rgb = base * (1 - k[..., None]) + CLARO * k[..., None] * 0.62 + base * k[..., None] * 0.38
    rgb[mar] = MAR
    alto_px = round(ancho * (N - S) * KY / ((E - O) * KX))
    im = Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8)).resize((ancho, alto_px), Image.LANCZOS)
    im.save(OUT / f'relieve-{clave}.webp', 'WEBP', quality=72, method=6)
    try:
        im.save(OUT / f'relieve-{clave}.avif', 'AVIF', quality=55)
    except Exception:
        pass
    x0, y0 = m(N, O); x1, y1 = m(S, E)
    print('relieve', clave, z.shape, '→', im.size, (OUT / f'relieve-{clave}.webp').stat().st_size // 1024, 'KB')
    return {'id': clave, 'x0': round(x0), 'y0': round(y0), 'x1': round(x1), 'y1': round(y1), 'w': ancho, 'h': alto_px, 'mdt': cov}, im, mar.mean()

capas, imgs = [], {}
for c in ('lejos', 'redes', 'valle'):
    info, im, fmar = relieve(c)
    capas.append(info); imgs[c] = im
    if fmar: print('  mar en la caja', c, round(fmar * 100, 1), '%')

# ------------------------------------------------------------------ 2. OpenStreetMap
S, N, O, E = CAJAS['lejos'][:4]
bl = f'{S},{O},{N},{E}'
Sr, Nr, Or, Er = CAJAS['redes'][:4]
br = f'{Sr},{Or},{Nr},{Er}'
grandes = overpass(f'''[out:json][timeout:170];
(
  way["highway"~"^(motorway|trunk|primary)$"]({bl});
  way["waterway"="river"]({bl});
  node["place"~"^(city|town)$"]({bl});
);
out geom tags;''', 'osm-lejos.json')
finas = overpass(f'''[out:json][timeout:170];
(
  way["highway"~"^(secondary|tertiary)$"]({br});
  way["natural"="water"]({br});
  relation["natural"="water"]({br});
  node["place"~"^(village|hamlet)$"]["name"]({br});
);
out geom;''', 'osm-redes-v2.json')
# ojo: «out geom tags» NO trae los miembros de las relaciones; hace falta «out geom»
parque = overpass('[out:json][timeout:120];relation(2640874);out geom;', 'osm-parque-v2.json')

def geom_ll(g): return [m(p['lat'], p['lon']) for p in g]
def encadenar(trozos):
    """une las vías que comparten extremo (OSM parte cada carretera en decenas de tramos): menos líneas y DP mejor"""
    trozos = [list(t) for t in trozos if len(t) > 1]
    ext = {}
    for i, t in enumerate(trozos):
        for k in (t[0], t[-1]): ext.setdefault(k, []).append(i)
    usado = [False] * len(trozos); salida = []
    def siguiente(p, i):
        for j in ext.get(p, []):
            if not usado[j] and j != i: return j
        return None
    for i in range(len(trozos)):
        if usado[i]: continue
        usado[i] = True; a = trozos[i]
        for _ in range(2):          # hacia delante y, dándole la vuelta, hacia atrás
            j = siguiente(a[-1], i)
            while j is not None:
                usado[j] = True; b = trozos[j]
                a = a + (b[1:] if b[0] == a[-1] else b[::-1][1:])
                j = siguiente(a[-1], j)
            a = a[::-1]
        salida.append(a)
    return salida
def largo(p): return sum(math.hypot(p[i + 1][0] - p[i][0], p[i + 1][1] - p[i][1]) for i in range(len(p) - 1))
NIVEL = {'motorway': 0, 'trunk': 0, 'primary': 1, 'secondary': 2, 'tertiary': 3}
EPS = {0: 30, 1: 24, 2: 14, 3: 12}
carreteras, rios, agua, pueblos = [], [], [], []
vistos = set()
por_nivel, por_rio = {0: [], 1: [], 2: [], 3: []}, {}
for e in grandes['elements'] + finas['elements']:
    t = e.get('tags', {})
    if e['type'] == 'way' and 'highway' in t and 'geometry' in e:
        if e['id'] in vistos: continue
        vistos.add(e['id'])
        por_nivel[NIVEL[t['highway']]].append(geom_ll(e['geometry']))
    elif e['type'] == 'way' and t.get('waterway') == 'river' and 'geometry' in e:
        por_rio.setdefault(t.get('name', ''), []).append(geom_ll(e['geometry']))
    elif t.get('natural') == 'water' and ('geometry' in e or 'members' in e):
        anillos = []
        if e['type'] == 'way':
            anillos.append(geom_ll(e['geometry']))
        else:
            # multipolígono: se encadenan los miembros «outer» en anillos
            trozos = [geom_ll(mm['geometry']) for mm in e['members'] if mm.get('role') == 'outer' and mm.get('geometry')]
            while trozos:
                a = trozos.pop(0)
                cambio = True
                while cambio and a[0] != a[-1]:
                    cambio = False
                    for i, b in enumerate(trozos):
                        if b[0] == a[-1]: a += b[1:]
                        elif b[-1] == a[-1]: a += b[::-1][1:]
                        elif b[-1] == a[0]: a = b + a[1:]
                        elif b[0] == a[0]: a = b[::-1] + a[1:]
                        else: continue
                        trozos.pop(i); cambio = True; break
                anillos.append(a)
        for a in anillos:
            xs = [p[0] for p in a]; ys = [p[1] for p in a]
            area = abs(sum(a[i][0] * a[i + 1][1] - a[i + 1][0] * a[i][1] for i in range(len(a) - 1))) / 2
            if area < 6000: continue          # charcas y piscinas fuera
            agua.append({'nombre': t.get('name', ''), 'area': round(area), 'p': plano(dp(a, 6))})
    elif e['type'] == 'node' and 'place' in t and t.get('name'):
        x, y = m(e['lat'], e['lon'])
        pueblos.append({'nombre': t['name'], 'tipo': t['place'], 'x': round(x), 'y': round(y), 'osm': 'node/' + str(e['id'])})
for n, trozos in por_nivel.items():
    for p in encadenar(trozos):
        if largo(p) < (400 if n >= 2 else 250): continue
        carreteras.append({'n': n, 'p': plano(dp(p, EPS[n]))})
for nombre, trozos in por_rio.items():
    for p in encadenar(trozos):
        if not nombre or largo(p) < 2500: continue          # los ríos con nombre y de más de 2,5 km
        rios.append({'nombre': nombre, 'p': plano(dp(p, 22))})
# solo los pueblos y aldeas del valle y de Redes que no son destino (para orientarse), y las villas grandes
pueblos = [p for p in pueblos if p['tipo'] in ('city', 'town') or (p['tipo'] == 'village')]
par = []
for e in parque['elements']:
    for mm in e.get('members', []):
        if mm.get('role') == 'outer' and mm.get('geometry'):
            par.append(plano(dp(geom_ll(mm['geometry']), 30)))
print('OSM:', len(carreteras), 'carreteras,', len(rios), 'ríos,', len(agua), 'láminas de agua,', len(pueblos), 'pueblos,', len(par), 'trozos del límite del Parque')

# ------------------------------------------------------------------ 3. OSRM: la ruta real de cada destino
geo_full, destinos = {}, []
for i, did in enumerate(RUTAS['llegar']):
    d = RUTAS['destinos'][did]
    url = (f'https://router.project-osrm.org/route/v1/driving/{LON},{LAT};{d["lon"]},{d["lat"]}'
           '?overview=full&geometries=geojson&alternatives=false')
    j = json.loads(bajar(url, f'osrm-{did}.json'))
    r = j['routes'][0]
    coords = r['geometry']['coordinates']
    geo_full[did] = {'km': round(r['distance'] / 1000, 1), 'minutos': max(1, round(r['duration'] / 60)), 'puntos': len(coords), 'coordinates': coords}
    p = dp([m(c[1], c[0]) for c in coords], 6 if d['grupo'] == 'cerca' else 12)
    x, y = m(d['lat'], d['lon'])
    dc = d['desde_casa']
    if abs(geo_full[did]['km'] - dc['km']) > 0.3:
        print('  OJO', did, 'la geometría da', geo_full[did]['km'], 'km y rutas.json', dc['km'])
    destinos.append({'id': did, 'nombre': d['nombre'], 'donde': d['donde'], 'grupo': d['grupo'], 'x': round(x), 'y': round(y),
                     'km': dc['km'], 'min': dc['minutos'], 'pie': d.get('a_pie'), 'ruta': plano(p)})
    print(f'  {did:11s} {dc["km"]:>5} km {dc["minutos"]:>3} min · {len(coords)} → {len(p)} puntos')
(R / 'ref/raw/rutas-geometria.json').write_text(json.dumps({'fuente': 'OSRM router.project-osrm.org, overview=full, geometries=geojson (datos de OpenStreetMap, ODbL)', 'fecha': time.strftime('%Y-%m-%d'), 'casa': [LAT, LON], 'rutas': geo_full}), encoding='utf-8')

datos = {
    'nota': 'Metros desde la casa (Catastro, Tanes 9): x al este, y al sur. Relieve: IGN (MDT05, MDT25, MDT200) CC BY 4.0. Agua, ríos, carreteras y pueblos: OpenStreetMap (ODbL). Rutas: OSRM. Generado por scripts/mapa-valle.py.',
    'capas': capas, 'agua': agua, 'rios': rios, 'carreteras': carreteras, 'parque': par, 'pueblos': pueblos, 'destinos': destinos,
}
js = 'window.TANES_VALLE = ' + json.dumps(datos, ensure_ascii=False, separators=(',', ':')) + ';\n'
(R / 'js/valle-datos.js').write_text('/* La lámina del valle: datos de scripts/mapa-valle.py (no editar a mano) */\n' + js, encoding='utf-8')
print('js/valle-datos.js', len(js.encode('utf-8')) // 1024, 'KB')

# ------------------------------------------------------------------ 4. la lámina quieta (sin JS): encuadre «Por Redes»
# la letra de la lámina quieta: la del sistema (Segoe UI en Windows); es solo la imagen para sin JS
F = next((f for f in (pathlib.Path('C:/Windows/Fonts/segoeui.ttf'), pathlib.Path('C:/Windows/Fonts/arial.ttf')) if f.exists()), None)
W, H = 1200, 900
pts = [(0, 0)] + [(d['x'], d['y']) for d in destinos if d['grupo'] in ('cerca', 'redes')]
xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
esc = min(W / ((max(xs) - min(xs)) * 1.3), H / ((max(ys) - min(ys)) * 1.3))
def px(x, y): return (W / 2 + (x - cx) * esc, H / 2 + (y - cy) * esc)
lam = Image.new('RGB', (W, H), tuple(int(v) for v in OSC))
for c in ('lejos', 'redes', 'valle'):
    info = next(k for k in capas if k['id'] == c)
    a, b = px(info['x0'], info['y0']), px(info['x1'], info['y1'])
    w, h = round(b[0] - a[0]), round(b[1] - a[1])
    if w > 0 and h > 0:
        lam.paste(imgs[c].resize((w, h), Image.LANCZOS), (round(a[0]), round(a[1])))
dr = ImageDraw.Draw(lam, 'RGBA')
def linea(flat, col, w):
    p = [px(flat[i], flat[i + 1]) for i in range(0, len(flat), 2)]
    if len(p) > 1: dr.line(p, fill=col, width=w, joint='curve')
for a in agua:
    p = [px(a['p'][i], a['p'][i + 1]) for i in range(0, len(a['p']), 2)]
    if len(p) > 2: dr.polygon(p, fill=(0x79, 0xaa, 0x9c, 235))
for r in rios: linea(r['p'], (0x79, 0xaa, 0x9c, 150), 2)
for c in sorted(carreteras, key=lambda c: -c['n']): linea(c['p'], (0xe6, 0xd6, 0xc5, [170, 140, 95, 70][c['n']]), [3, 2, 2, 1][c['n']])
for d in destinos: linea(d['ruta'], (0xb4, 0xa3, 0x80, 230), 3)
f1 = ImageFont.truetype(str(F), 22) if F else ImageFont.load_default(); f2 = ImageFont.truetype(str(F), 17) if F else ImageFont.load_default()
for d in destinos:
    x, y = px(d['x'], d['y'])
    t = f'{d["nombre"]} · {d["min"]} min'
    if 8 < x < W - 8 and 8 < y < H - 8:
        dr.ellipse([x - 7, y - 7, x + 7, y + 7], fill=(0x22, 0x13, 0x0d), outline=(0xb4, 0xa3, 0x80), width=3)
        dr.text((x + 12, y - 12), t, font=f2, fill=(0xe6, 0xd6, 0xc5), stroke_width=3, stroke_fill=(0x22, 0x13, 0x0d))
    else:   # fuera del encuadre: flecha en el borde con su distancia
        ang = math.atan2(d['y'] - cy, d['x'] - cx)
        bx, by = W / 2 + math.cos(ang) * W, H / 2 + math.sin(ang) * W
        k = min((W / 2 - 40) / max(1e-6, abs(bx - W / 2)), (H / 2 - 40) / max(1e-6, abs(by - H / 2)))
        ex, ey = W / 2 + (bx - W / 2) * k, H / 2 + (by - H / 2) * k
        dr.polygon([(ex + math.cos(ang) * 16, ey + math.sin(ang) * 16), (ex + math.cos(ang + 2.5) * 12, ey + math.sin(ang + 2.5) * 12), (ex + math.cos(ang - 2.5) * 12, ey + math.sin(ang - 2.5) * 12)], fill=(0xb4, 0xa3, 0x80))
        t2 = f'{d["nombre"]} · {str(d["km"]).replace(".", ",")} km'
        tw = dr.textlength(t2, font=f2)
        dr.text((min(max(ex - tw / 2, 10), W - tw - 10), ey + (18 if ey < H / 2 else -36)), t2, font=f2, fill=(0xe6, 0xd6, 0xc5), stroke_width=3, stroke_fill=(0x22, 0x13, 0x0d))
hx, hy = px(0, 0)
dr.ellipse([hx - 10, hy - 10, hx + 10, hy + 10], fill=(0xb4, 0xa3, 0x80), outline=(0x22, 0x13, 0x0d), width=3)
dr.text((hx + 14, hy - 30), 'La Casa', font=f1, fill=(0xb4, 0xa3, 0x80), stroke_width=3, stroke_fill=(0x22, 0x13, 0x0d))
dr.text((14, H - 28), 'Relieve © IGN (CC BY 4.0) · Datos © colaboradores de OpenStreetMap (ODbL) · Rutas: OSRM', font=f2, fill=(0xc8, 0xae, 0x92))
lam.save(OUT / 'lamina-quieta.webp', 'WEBP', quality=74, method=6)
lam.save(OUT / 'lamina-quieta.jpg', 'JPEG', quality=80, optimize=True, progressive=True)
print('lámina quieta', (OUT / 'lamina-quieta.webp').stat().st_size // 1024, 'KB')
