# «El espejo de Tanes» · datos del 3D de La Casa de Tanes (Tanes 9, Caso, Asturias).
#
# Fuentes (todas abiertas):
#   - MDT05 y MDT25 del IGN por WCS (servicios.idee.es/wcs-inspire/mdt)             CC BY 4.0, © IGN / CNIG
#   - Ortofoto PNOA por WMS y WMTS (www.ign.es/wms-inspire/pnoa-ma, /wmts/pnoa-ma)    CC BY 4.0, © IGN / CNIG
#   - Direcciones, parcelas y edificios del Catastro INSPIRE (ovc.catastro.meh.es)    © Dirección General del Catastro
#   - Lugares de OpenStreetMap (scripts/lugar-osm.py)                                ODbL, © colaboradores de OSM
# Todo lo descargado se guarda en ref/raw/lugar-cache/ (no viaja a la web); lo servido va a img/lugar/.
#
# Origen: el punto de la dirección «LG TANES 9» del Catastro (parcela 0006082UN08F). Coordenadas locales en metros:
# x al este, z al sur, y = altura sobre el mar. Alturas en PNG RGB: (R*256 + G) / 10 - 100 = metros.
#
# Uso: python -I -X utf8 scripts/lugar-osm.py   (una vez)   y luego   python -I -X utf8 scripts/lugar-datos.py
import io, json, math, pathlib, re, time, urllib.request
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage
import tifffile

R = pathlib.Path(__file__).resolve().parent.parent
CACHE = R / 'ref' / 'raw' / 'lugar-cache'; CACHE.mkdir(parents=True, exist_ok=True)
OUT = R / 'img' / 'lugar'; OUT.mkdir(parents=True, exist_ok=True)
UA = {'User-Agent': 'datos-mapa-script/1.0 (uso puntual)'}       # genérico, sin datos personales

CASA = (43.205389, -5.399521)          # Catastro, dirección LG TANES 9 (AD 33.015.52.9.000608200UN08F)
REF_CASA = '000608200UN08F'            # edificio de esa parcela (BU:Building)
KX = 111320 * math.cos(math.radians(CASA[0])); KZ = 110950
def loc(lat, lon): return ((lon - CASA[1]) * KX, (CASA[0] - lat) * KZ)
def geo(x, z): return (CASA[0] - z / KZ, CASA[1] + x / KX)

# caja cercana (MDT05 + PNOA a ~2 m/px): todo el embalse, de la presa a la cola, y las peñas de alrededor
CS, CN, CO, CE = 43.178, 43.238, -5.450, -5.350
# caja lejana (MDT25), alineada con la cercana
DLON, DLAT = (CE - CO) / 36, (CN - CS) / 26
LO, LE = CO - 60 * DLON, CE + 60 * DLON
LS, LN = CS - 45 * DLAT, CN + 45 * DLAT
CAJA25 = (43.06, 43.36, -5.66, -5.14)
# el pueblo (ortofoto de detalle WMTS z19 y rejilla de 4 m): 640 m alrededor de la casa
PL = 320.0
PS, PN_ = geo(0, PL)[0], geo(0, -PL)[0]
PO, PE = geo(-PL, 0)[1], geo(PL, 0)[1]
NIVEL = 490.0                          # lámina de agua en el MDT05 (zona plana conectada); ver LUGAR.md


def bajar(url, destino, intentos=5):
    if destino.exists() and destino.stat().st_size > 2000:
        return destino.read_bytes()
    for k in range(intentos):
        try:
            b = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=240).read()
            if len(b) < 2000 and b'<' in b[:200]:
                raise IOError(b[:160])
            destino.write_bytes(b); print('bajado', destino.name, len(b) // 1024, 'KB'); return b
        except Exception as e:
            print('falla', destino.name, str(e)[:100]); time.sleep(3 + 4 * k)
    raise SystemExit('No se pudo bajar ' + destino.name)


def wms(S, O, N, E, w, h, nombre):
    url = ('https://www.ign.es/wms-inspire/pnoa-ma?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=OI.OrthoimageCoverage'
           f'&STYLES=&CRS=EPSG:4326&BBOX={S},{O},{N},{E}&WIDTH={w}&HEIGHT={h}&FORMAT=image/jpeg')
    return Image.open(io.BytesIO(bajar(url, CACHE / nombre))).convert('RGB')


def mosaico(S, O, N, E, W, H, nx, ny, base):
    f = CACHE / (base + '.png')
    if f.exists():
        return Image.open(f).convert('RGB')
    im = Image.new('RGB', (W, H))
    for i in range(nx):
        for j in range(ny):
            o, e = O + (E - O) * i / nx, O + (E - O) * (i + 1) / nx
            n, s = N - (N - S) * j / ny, N - (N - S) * (j + 1) / ny
            im.paste(wms(s, o, n, e, W // nx, H // ny, f'{base}-{i}{j}.jpg'), (i * W // nx, j * H // ny))
    im.save(f); return im


def wmts_caja(S, O, N, E, zoom, W, nombre, H=None):
    """Ortofoto PNOA por teselas WMTS (GoogleMapsCompatible) llevada a la caja lat/lon (W x W)."""
    f = CACHE / (nombre + '.png')
    if f.exists():
        return Image.open(f).convert('RGB')
    n = 2 ** zoom
    tx = lambda lon: (np.asarray(lon, np.float64) + 180) / 360 * n
    ty = lambda lat: (1 - np.arcsinh(np.tan(np.radians(np.asarray(lat, np.float64)))) / np.pi) / 2 * n
    x0, x1, y0, y1 = tx(O), tx(E), ty(N), ty(S)
    cols = range(int(x0), int(x1) + 1); filas = range(int(y0), int(y1) + 1)
    lienzo = Image.new('RGB', (len(cols) * 256, len(filas) * 256))
    tdir = CACHE / f'wmts{zoom}'; tdir.mkdir(exist_ok=True)
    for i, c in enumerate(cols):
        for j, r in enumerate(filas):
            url = ('https://www.ign.es/wmts/pnoa-ma?layer=OI.OrthoimageCoverage&style=default&tilematrixset=GoogleMapsCompatible'
                   f'&Service=WMTS&Request=GetTile&Version=1.0.0&Format=image/jpeg&TileMatrix={zoom}&TileCol={c}&TileRow={r}')
            lienzo.paste(Image.open(io.BytesIO(bajar(url, tdir / f'{c}-{r}.jpg'))).convert('RGB'), (i * 256, j * 256))
    a = np.asarray(lienzo, np.float32)
    H = H or W
    lat = N - (np.arange(H) + 0.5) / H * (N - S); lon = O + (np.arange(W) + 0.5) / W * (E - O)
    py = (ty(lat) - int(float(y0))) * 256 - 0.5; px = (tx(lon) - int(float(x0))) * 256 - 0.5
    PY, PX = np.meshgrid(py, px, indexing='ij')
    out = np.stack([ndimage.map_coordinates(a[..., k], [PY, PX], order=1) for k in range(3)], -1)
    im = Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)); im.save(f); return im


def wcs(cov, S, N, O, E, nombre):
    url = ('https://servicios.idee.es/wcs-inspire/mdt?SERVICE=WCS&VERSION=2.0.1&REQUEST=GetCoverage'
           f'&COVERAGEID={cov}&FORMAT=image/tiff&SUBSET=Lat({S},{N})&SUBSET=Long({O},{E})')
    bajar(url, CACHE / nombre)
    return tifffile.imread(CACHE / nombre).astype(np.float32)


# ------------------------------------------------------------------ descargas
mdt5 = wcs('Elevacion4258_5', CS, CN, CO, CE, 'mdt5-cerca.tif')
mdt25 = wcs('Elevacion4258_25', CAJA25[0], CAJA25[1], CAJA25[2], CAJA25[3], 'mdt25-lejos.tif')
orto_c = mosaico(CS, CO, CN, CE, 4096, 3390, 2, 2, 'pnoa-cerca')
orto_p = wmts_caja(PS, PO, PN_, PE, 19, 2048, 'pnoa-pueblo-z19')
orto_l = wmts_caja(CAJA25[0], CAJA25[2], CAJA25[1], CAJA25[3], 12, 2048, 'pnoa-lejos-z12', 1620)   # el WMS da 502 a esta escala
print('MDT05', mdt5.shape, 'MDT25', mdt25.shape)
CAJA5 = (CS, CN, CO, CE)


def muestrea(a, caja, lat, lon, orden=1):
    S, N, O, E = caja
    fil = (N - lat) / (N - S) * a.shape[0] - 0.5
    col = (lon - O) / (E - O) * a.shape[1] - 0.5
    return ndimage.map_coordinates(a, [fil, col], order=orden, mode='nearest')


# ------------------------------------------------------------------ el agua
# El embalse en el MDT05 es una lámina plana a 490 m (el nivel del día del vuelo LiDAR). Se toma la zona <= 490,5 m
# conectada con un punto de agua conocido (frente a Tanes), lo que deja fuera el Nalón aguas abajo de la presa.
paso5 = ((CE - CO) * KX / mdt5.shape[1], (CN - CS) * KZ / mdt5.shape[0])
bajo = mdt5 <= NIVEL + 0.5
et, _ = ndimage.label(bajo)
def rc5(lat, lon): return int((CN - lat) / (CN - CS) * mdt5.shape[0]), int((lon - CO) / (CE - CO) * mdt5.shape[1])
semilla = rc5(43.2042, -5.4014)
agua5 = et == et[semilla]
agua5 = ndimage.binary_closing(agua5, iterations=2) & bajo | agua5
print('agua: celdas', int(agua5.sum()), 'superficie', round(float(agua5.sum() * paso5[0] * paso5[1] / 1e6), 3), 'km²')
dist5 = ndimage.distance_transform_edt(agua5, sampling=(paso5[1], paso5[0]))          # m hasta la orilla (dentro)
fuera5 = ndimage.distance_transform_edt(~agua5, sampling=(paso5[1], paso5[0]))         # m hasta el agua (fuera)
mdt5_s = ndimage.gaussian_filter(mdt5, 1.3)
# fondo inventado (no se ve: el agua es opaca) y orilla siempre por encima de la lámina, salvo la caída de la presa
anillo = (~agua5) & (fuera5 < 14) & (mdt5_s > NIVEL - 10)
alt5 = np.where(agua5, NIVEL - 1.5 - np.minimum(dist5 * 0.12, 22.0), mdt5_s)
alt5 = np.where(anillo, np.maximum(alt5, NIVEL + 0.35), alt5)
lamina5 = agua5 | anillo                                     # dónde se pinta el plano del agua (la orilla lo tapa)
alt25 = mdt25.copy()


def alt_en(lat, lon, fina=True):
    lat = np.asarray(lat, np.float64); lon = np.asarray(lon, np.float64)
    a = muestrea(alt25, CAJA25, lat, lon)
    if fina:
        dentro = (lat >= CS) & (lat <= CN) & (lon >= CO) & (lon <= CE)
        if dentro.any():
            a = a.copy(); a[dentro] = muestrea(alt5, CAJA5, lat[dentro], lon[dentro])
    return a


def es_agua(lat, lon):
    lat = np.asarray(lat, np.float64); lon = np.asarray(lon, np.float64)
    dentro = (lat >= CS) & (lat <= CN) & (lon >= CO) & (lon <= CE)
    out = np.zeros(lat.shape, bool)
    if dentro.any():
        out[dentro] = muestrea(agua5.astype(np.float32), CAJA5, lat[dentro], lon[dentro], 0) > 0.5
    return out


def alt_xz(x, z):
    la, lo = geo(x, z); return float(alt_en(np.array([la]), np.array([lo]))[0])


def agua_xz(x, z):
    la, lo = geo(x, z); return bool(es_agua(np.array([la]), np.array([lo]))[0])


def png_alturas(h, nombre):
    v = np.clip(np.round((h + 100.0) * 10), 0, 65535).astype(np.uint16)
    rgb = np.stack([(v >> 8).astype(np.uint8), (v & 255).astype(np.uint8), np.zeros_like(v, np.uint8)], -1)
    Image.fromarray(rgb, 'RGB').save(OUT / nombre, optimize=True)


def rejilla_local(x0, z0, x1, z1, paso):
    nx = int(round((x1 - x0) / paso)) + 1; nz = int(round((z1 - z0) / paso)) + 1
    X, Z = np.meshgrid(np.linspace(x0, x1, nx), np.linspace(z0, z1, nz))
    lat, lon = geo(X, Z)
    return X, Z, lat, lon, nx, nz


rasters = {}
cx0, cz0 = loc(CN, CO); cx1, cz1 = loc(CS, CE)
for nombre, (x0, z0, x1, z1, paso) in {
    'cerca': (cx0, cz0, cx1, cz1, 20.0),
    'medio': (-1800.0, -1300.0, 1800.0, 1300.0, 8.0),
    'pueblo': (-PL, -PL, PL, PL, 4.0),
}.items():
    X, Z, lat, lon, nx, nz = rejilla_local(x0, z0, x1, z1, paso)
    h = alt_en(lat, lon)
    png_alturas(h, f'alturas-{nombre}.png')
    rasters[nombre] = {'x0': round(x0, 2), 'z0': round(z0, 2), 'x1': round(x1, 2), 'z1': round(z1, 2), 'w': nx, 'h': nz,
                       'archivo': f'alturas-{nombre}.png'}
    print('alturas', nombre, nx, 'x', nz, round(float(h.min()), 1), round(float(h.max()), 1))

nlx = int(round((LE - LO) / DLON)) + 1; nlz = int(round((LN - LS) / DLAT)) + 1
lons = LO + np.arange(nlx) * DLON; lats = LN - np.arange(nlz) * DLAT
LON_, LAT_ = np.meshgrid(lons, lats)
k = max(1, int(round(DLON * KX / 25.0)))
med = ndimage.uniform_filter(alt25, size=k); mx = ndimage.maximum_filter(alt25, size=k)
hl = muestrea(0.55 * med + 0.45 * mx, CAJA25, LAT_, LON_)           # sin aplanar las cumbres
dentro = (LAT_ >= CS - 1e-9) & (LAT_ <= CN + 1e-9) & (LON_ >= CO - 1e-9) & (LON_ <= CE + 1e-9)
hl[dentro] = muestrea(alt5, CAJA5, LAT_[dentro], LON_[dentro])
png_alturas(hl, 'alturas-lejos.png')
lx0, lz0 = loc(LN, LO); lx1, lz1 = loc(LS, LE)
rasters['lejos'] = {'x0': round(lx0, 2), 'z0': round(lz0, 2), 'x1': round(lx1, 2), 'z1': round(lz1, 2), 'w': nlx, 'h': nlz,
                    'archivo': 'alturas-lejos.png',
                    'hueco': [int(round((CO - LO) / DLON)), int(round((LN - CN) / DLAT)), int(round((CE - LO) / DLON)), int(round((LN - CS) / DLAT))]}
print('lejos', nlx, 'x', nlz, 'celda', round(DLON * KX), 'm', 'hueco', rasters['lejos']['hueco'])

# textura del agua (caja cercana): R = distancia a la orilla (2 m por unidad), G = 255 donde se pinta la lámina
AW, AH = 2048, 1694
fil = np.linspace(0, mdt5.shape[0] - 1, AH); col = np.linspace(0, mdt5.shape[1] - 1, AW)
F, C = np.meshgrid(fil, col, indexing='ij')
d_ = ndimage.map_coordinates(dist5, [F, C], order=1)
lam = ndimage.map_coordinates(lamina5.astype(np.float32), [F, C], order=1)
aguaT = np.stack([np.clip(d_ / 2.0, 0, 255), np.clip(lam * 255, 0, 255), np.zeros_like(d_)], -1).astype(np.uint8)
Image.fromarray(aguaT, 'RGB').save(OUT / 'agua.png', optimize=True)

# ------------------------------------------------------------------ ortofotos
def mascara(w, h, caja, f):
    S, N, O, E = caja
    lat = N - (np.arange(h) + 0.5) / h * (N - S); lon = O + (np.arange(w) + 0.5) / w * (E - O)
    LON2, LAT2 = np.meshgrid(lon, lat)
    return f(LAT2, LON2)


AGUA_RGB = np.array([24, 58, 54], np.float32)
oc = np.asarray(orto_c, np.float32).copy()
aguaC = mascara(oc.shape[1], oc.shape[0], CAJA5, es_agua)
oc[ndimage.binary_erosion(aguaC, iterations=2)] = AGUA_RGB
orto_c2 = Image.fromarray(oc.astype(np.uint8))
# 3072 px (~2,6 m/px) en escritorio: la de 4096 pesaba 2,2 MB para un detalle que solo se ve en el pueblo,
# que ya lleva su propia ortofoto de 0,31 m/px
orto_c2.resize((3072, 2543), Image.LANCZOS).save(OUT / 'orto-cerca-3072.webp', quality=66, method=6)
orto_c2.resize((2048, 1695), Image.LANCZOS).save(OUT / 'orto-cerca-2048.webp', quality=70, method=6)

# anillo lejano: las teselas de zoom 12 vienen de otro sensor (más saturadas, brezo morado). Se igualan solo las
# ganancias por canal con la ortofoto cercana en la zona común (sin estirar contrastes) y se apaga la saturación.
S_, N_, O_, E_ = CAJA25
i0 = int((CO - O_) / (E_ - O_) * orto_l.width); i1 = int((CE - O_) / (E_ - O_) * orto_l.width)
j0 = int((N_ - CN) / (N_ - S_) * orto_l.height); j1 = int((N_ - CS) / (N_ - S_) * orto_l.height)
ol_ = np.asarray(orto_l, np.float32)
ref_ = np.asarray(orto_c2.resize((i1 - i0, j1 - j0), Image.LANCZOS), np.float32)
comun_ = ol_[j0:j1, i0:i1]
ganancia = ref_.reshape(-1, 3).mean(0) / (comun_.reshape(-1, 3).mean(0) + 1e-3)
print('ganancia del anillo lejano', np.round(ganancia, 3))
olg = ol_ * ganancia
gris = olg.mean(-1, keepdims=True); olg = gris + (olg - gris) * 0.6
olg = olg * np.array([0.97, 1.02, 0.98])                     # sin el tinte morado del brezo de lejos
Image.fromarray(np.clip(olg, 0, 255).astype(np.uint8)).save(OUT / 'orto-lejos-2048.webp', quality=70, method=6)


# ------------------------------------------------------------------ Catastro
def wfs(servicio, tipo, S, O, N, E, nombre):
    url = (f'https://ovc.catastro.meh.es/INSPIRE/{servicio}.aspx?service=WFS&version=2.0.0&request=GetFeature'
           f'&typenames={tipo}&srsname=EPSG::4258&bbox={S},{O},{N},{E}')
    return bajar(url, CACHE / nombre).decode('latin-1')


def poligonos(xml, patron_id):
    out = []
    for m in re.finditer(r'<(?:gml:featureMember|wfs:member|member)>(.*?)</(?:gml:featureMember|wfs:member|member)>', xml, re.S):
        f = m.group(1)
        lid = re.search(patron_id, f)
        pis = re.search(r'numberOfFloorsAboveGround>(\d+)', f)
        uso = re.search(r'currentUse>([^<]+)', f)
        anillos = []
        for pl in re.findall(r'<gml:posList[^>]*>([^<]+)</gml:posList>', f):
            v = list(map(float, pl.split()))
            anillos.append([(v[i], v[i + 1]) for i in range(0, len(v), 2)])
        out.append({'id': lid.group(1) if lid else '?', 'pisos': int(pis.group(1)) if pis else None,
                    'uso': uso.group(1) if uso else None, 'anillos': anillos})
    return out


# comprobación: la dirección «LG TANES 9» está en la parcela del edificio que se modela
ad = wfs('wfsAD', 'AD:Address', CASA[0] - 0.0006, CASA[1] - 0.0008, CASA[0] + 0.0006, CASA[1] + 0.0008, 'ad-casa.xml')
assert 'LG TANES' in ad and '33.015.52.9.' + REF_CASA in ad, 'La dirección Tanes 9 ya no casa con la parcela'
bp = poligonos(wfs('wfsBU', 'BU:BuildingPart', PS, PO, PN_, PE, 'bp-pueblo.xml'), r'localId>([^<]+)')
bu = poligonos(wfs('wfsBU', 'BU:Building', PS, PO, PN_, PE, 'bu-pueblo.xml'), r'reference>([^<]+)')
print('Catastro: partes', len(bp), 'edificios', len(bu))


def rect_orientado(pts):
    P = np.array(pts); mejor = None
    for g in np.radians(np.arange(0, 90, 0.5)):
        c, s = math.cos(g), math.sin(g)
        u = P[:, 0] * c + P[:, 1] * s; v = -P[:, 0] * s + P[:, 1] * c
        a = (u.max() - u.min()) * (v.max() - v.min())
        if mejor is None or a < mejor[0]:
            mejor = (a, g, (u.max() + u.min()) / 2, (v.max() + v.min()) / 2, u.max() - u.min(), v.max() - v.min())
    a, g, uc, vc, lu, lv = mejor
    c, s = math.cos(g), math.sin(g)
    cx, cz = uc * c - vc * s, uc * s + vc * c
    if lv > lu:
        lu, lv, g = lv, lu, g + math.pi / 2
    return {'cx': round(cx, 2), 'cz': round(cz, 2), 'largo': round(lu, 2), 'fondo': round(lv, 2), 'ang': round(g, 4)}


def area(pts):
    return 0.5 * abs(sum(pts[i][0] * pts[i - 1][1] - pts[i - 1][0] * pts[i][1] for i in range(len(pts))))


def anillo_local(b):
    pts = [loc(la, lo) for la, lo in b['anillos'][0]]
    if pts[0] == pts[-1]:
        pts = pts[:-1]
    return pts


# plantas por edificio: la media de sus partes, ponderada por superficie
pis_ed = {}
for b in bp:
    if not b['anillos'] or not b['pisos']:
        continue
    ref = b['id'].split('_')[0]; a_ = area(anillo_local(b))
    s = pis_ed.setdefault(ref, [0.0, 0.0, 0]); s[0] += a_ * b['pisos']; s[1] += a_; s[2] = max(s[2], b['pisos'])
edificios = []
casa = None
for b in bu:
    if not b['anillos']:
        continue
    pts = anillo_local(b)
    if area(pts) < 6 or math.hypot(*np.mean(pts, axis=0)) > PL - 20:
        continue
    rc = rect_orientado(pts)
    lat = np.array([geo(x, z)[0] for x, z in pts]); lon = np.array([geo(x, z)[1] for x, z in pts])
    hs = alt_en(lat, lon)
    s = pis_ed.get(b['id'])
    pisos = max(1, int(round(s[0] / s[1]))) if s else 1
    tipo = 'casa' if b['id'] == REF_CASA else 'vecina'
    e = {'id': b['id'], 'tipo': tipo, 'pisos': pisos, 'pisos_max': s[2] if s else pisos, 'uso': b['uso'],
         'cubierta': '2' if rc['largo'] > 1.7 * rc['fondo'] else '4',
         'suelo': round(float(hs.min()), 2), 'suelo_max': round(float(hs.max()), 2),
         'anillo': [[round(x, 2), round(z, 2)] for x, z in pts], 'rect': rc, 'area': round(area(pts), 1)}
    edificios.append(e)
    if tipo == 'casa':
        casa = e
assert casa, 'No encuentro el edificio de Tanes 9 en Catastro'
edificios.sort(key=lambda e: (e['tipo'] != 'casa', e['id']))
print('edificios', len(edificios), 'casa', casa['rect'], 'pisos', casa['pisos'], casa['pisos_max'], 'suelo', casa['suelo'], casa['suelo_max'])

# la casona: núcleo de tres plantas (partes de 3 plantas) y galería de madera en la fachada larga que mira al agua.
nucleo = []
for b in bp:
    if b['id'].startswith(REF_CASA) and b['pisos'] == 3 and b['anillos']:
        nucleo += anillo_local(b)
rn = rect_orientado(nucleo)
# Los muros van sobre el núcleo de tres plantas; las tiras de ~1 m y dos plantas que lo rodean en el Catastro
# (a lo largo de las dos fachadas largas) quedan bajo el alero ancho del tejado. Ver LUGAR.md.
rc = rn
# fachadas largas: normales (hacia fuera) y la que más mira al embalse (agua más cercana en esa dirección)
c_, s_ = math.cos(rc['ang']), math.sin(rc['ang'])
def agua_en_dir(nx, nz):
    for d in range(10, 400, 5):
        if agua_xz(rc['cx'] + nx * d, rc['cz'] + nz * d):
            return d
    return 999
lados = [(-s_, c_), (s_, -c_)]                                     # normales de las fachadas largas
da = [agua_en_dir(*n) for n in lados]
nG = lados[int(np.argmin(da))]
azG = (math.degrees(math.atan2(nG[0], -nG[1])) + 360) % 360       # rumbo al que mira la galería (0 = norte, 90 = este)
# la galería ocupa la mitad noroeste de esa fachada (fotos 01 y 10): el extremo con el eje u que va más al oeste
uO = -1 if c_ > 0 else 1                                           # signo de u hacia el oeste (x menor)
CASONA = {'rect': rc, 'nucleo': rn, 'galeria': {'normal': [round(nG[0], 4), round(nG[1], 4)], 'rumbo': round(azG, 1),
          'u': round(uO * rc['largo'] * 0.2, 2), 'ancho': round(rc['largo'] * 0.4, 2), 'vuelo': 0.7},
          'suelo': casa['suelo'], 'plantas': 3, 'altura_planta': 2.85}
print('casona: galería mira a', round(azG), '° (agua a', min(da), 'm)', 'núcleo', rn)

# ------------------------------------------------------------------ ortofoto del pueblo, sin tejados
of = np.asarray(orto_p, np.uint8).copy()
FW = of.shape[1]
fx0, fz0 = loc(PN_, PO); fx1, fz1 = loc(PS, PE)
def a_px(x, z): return ((x - fx0) / (fx1 - fx0) * FW, (z - fz0) / (fz1 - fz0) * FW)
masc = Image.new('L', (FW, FW), 0); dm = ImageDraw.Draw(masc)
for e in edificios:
    r_ = e['rect']; c, s = math.cos(r_['ang']), math.sin(r_['ang'])
    L, Fh = r_['largo'] / 2 + 1.2, r_['fondo'] / 2 + 1.2
    dm.polygon([a_px(r_['cx'] + u * c - v * s, r_['cz'] + u * s + v * c) for u, v in ((-L, -Fh), (L, -Fh), (L, Fh), (-L, Fh))], fill=255)
masc = masc.filter(ImageFilter.MaxFilter(5))
m_ = np.asarray(masc, np.float32) / 255.0
libre = 1.0 - m_
num = np.stack([ndimage.gaussian_filter(of[..., k] * libre, 20) for k in range(3)], -1)
den = ndimage.gaussian_filter(libre, 20)[..., None] + 1e-4
relleno = num / den * (0.93 + 0.07 * np.random.default_rng(3).random(of.shape[:2] + (1,)))
suave = ndimage.gaussian_filter(m_, 2.5)[..., None]
ofl = np.clip(of * (1 - suave) + relleno * suave, 0, 255)
aguaP = mascara(FW, FW, (PS, PN_, PO, PE), es_agua)
ofl[ndimage.binary_erosion(aguaP, iterations=3)] = AGUA_RGB
orto_p2 = Image.fromarray(ofl.astype(np.uint8))
orto_p2.save(OUT / 'orto-pueblo-2048.webp', quality=74, method=6)
orto_p2.resize((1024, 1024), Image.LANCZOS).save(OUT / 'orto-pueblo-1024.webp', quality=76, method=6)


# ------------------------------------------------------------------ árboles del pueblo (copas en la ortofoto)
def arboles():
    a = np.asarray(orto_p, np.float32)
    lum = a.mean(-1); verde = a[..., 1] - (a[..., 0] + a[..., 2]) / 2
    rug = ndimage.generic_filter(ndimage.zoom(lum, 0.25, order=1), np.std, size=5)
    rug = ndimage.zoom(rug, 4, order=1)[:lum.shape[0], :lum.shape[1]]
    copa = (ndimage.gaussian_filter(lum, 3) < 95) & (rug > 9) & (ndimage.gaussian_filter(verde, 3) > -4)
    copa = ndimage.binary_opening(copa, iterations=3)
    copa &= ~(np.asarray(masc) > 0) & ~ndimage.binary_dilation(aguaP, iterations=8)
    paso_m = (fx1 - fx0) / FW
    rng = np.random.default_rng(7)
    lista, ocup = [], []
    cand = np.argwhere(copa[::5, ::5]) * 5
    rng.shuffle(cand)
    for fy, fxp in cand:
        x = fx0 + fxp * paso_m; z = fz0 + fy * paso_m
        if math.hypot(x, z) > PL - 30:
            continue
        r = 2.4 + rng.random() * 2.6
        if any((x - ox) ** 2 + (z - oz) ** 2 < (0.95 * (r + orr)) ** 2 for ox, oz, orr in ocup):
            continue
        ocup.append((x, z, r))
        col = a[max(0, fy - 4):fy + 4, max(0, fxp - 4):fxp + 4].reshape(-1, 3).mean(0)
        alto = r * (2.0 + rng.random() * 1.3)
        lista.append([round(x, 1), round(alt_xz(x, z), 1), round(z, 1), round(r, 2), round(alto, 1), '#%02x%02x%02x' % tuple(int(v) for v in col)])
    return lista


arb = arboles()
print('árboles', len(arb))

# ------------------------------------------------------------------ lugares (OSM, comprobados por etiqueta y distancia)
osm = json.loads((CACHE / 'osm-tanes.json').read_text(encoding='utf-8'))['elements']


def centro(e):
    if 'lat' in e:
        return e['lat'], e['lon']
    if 'center' in e:
        return e['center']['lat'], e['center']['lon']
    g = e.get('geometry') or []
    if g:
        return sum(p['lat'] for p in g) / len(g), sum(p['lon'] for p in g) / len(g)
    b = e.get('bounds')
    return (b['minlat'] + b['maxlat']) / 2, (b['minlon'] + b['maxlon']) / 2


def busca(cond, cerca_de=(0, 0), max_m=None):
    mejor = None
    for e in osm:
        t = e.get('tags', {})
        if not cond(t):
            continue
        lat, lon = centro(e)
        x, z = loc(lat, lon)
        d = math.hypot(x - cerca_de[0], z - cerca_de[1])
        if max_m is not None and d > max_m:
            continue
        if mejor is None or d < mejor[0]:
            mejor = (d, e, x, z)
    if mejor is None:
        raise SystemExit('No encuentro en OSM un lugar que cumpla la condición')
    return mejor


lugares = []
def pon(clave, nombre, sub, e, x, z, dy, fase, nota, tipo='lugar'):
    lugares.append({'clave': clave, 'nombre': nombre, 'sub': sub, 'tipo': tipo, 'x': round(x, 1), 'z': round(z, 1),
                    'y': round(max(alt_xz(x, z), NIVEL) + dy, 1), 'dy': dy, 'fase': fase,
                    'osm': f"{e['type']}/{e['id']}" if e else None, 'nota': nota})


# Tanes: el nodo place=hamlet de OSM (nombre en asturiano «Tañes»; el rótulo usa el oficial «Tanes», como Catastro)
_, e, x, z = busca(lambda t: t.get('place') in ('hamlet', 'village') and t.get('name') == 'Tañes', max_m=600)
pon('tanes', 'Tanes', None, e, x, z, 40, [0.0, 0.8], 'place=hamlet «Tañes»')
# el embalse: la vía natural=water/water=reservoir «Embalse de Tanes»; el rótulo, sobre un punto de agua del propio MDT
_, ee, _, _ = busca(lambda t: t.get('water') == 'reservoir' and t.get('name') == 'Embalse de Tanes', max_m=3000)
mejor = None
for ang in range(0, 360, 6):
    for d in range(250, 1600, 25):
        xx, zz = d * math.sin(math.radians(ang)), -d * math.cos(math.radians(ang))
        if agua_xz(xx, zz):
            la, lo = geo(xx, zz); r_, c_r = rc5(la, lo)
            dd = dist5[min(max(r_, 0), dist5.shape[0] - 1), min(max(c_r, 0), dist5.shape[1] - 1)]
            sc = dd - abs(d - 650) * 0.05
            if mejor is None or sc > mejor[0]:
                mejor = (sc, xx, zz)
pon('embalse', 'Embalse de Tanes', None, ee, mejor[1], mejor[2], 14, [0.0, 0.86], 'water=reservoir ' + str(ee['id']))
_, ed, x, z = busca(lambda t: t.get('waterway') == 'dam' and t.get('name') == 'Presa de Tanes', max_m=6000)
pon('presa', 'Presa de Tanes', None, ed, x, z, 30, [0.0, 0.55], 'waterway=dam ' + str(ed['id']))
# peñas con nombre en OSM a menos de 4,5 km (las que se ven depende de la cámara; el 3D oculta las tapadas)
picos = []
for e in osm:
    t = e.get('tags', {})
    if t.get('natural') != 'peak' or not t.get('name'):
        continue
    x, z = loc(e['lat'], e['lon'])
    d = math.hypot(x, z)
    if d > 4500 or not (CS < e['lat'] < CN and CO < e['lon'] < CE):
        continue
    h = alt_xz(x, z)
    if h < 900:
        continue
    picos.append((h, e, x, z))
picos.sort(key=lambda p: -p[0])
elegidos = []
for h, e, x, z in picos:
    if all(math.hypot(x - ox, z - oz) > 1100 for _, _, ox, oz in elegidos):
        elegidos.append((h, e, x, z))
for h, e, x, z in elegidos[:6]:
    ele = e['tags'].get('ele')
    sub = (f"{int(float(ele)):,} m".replace(',', '.')) if ele else None
    pon('pico-' + str(e['id']), e['tags']['name'], sub, e, x, z, 25, [0.0, 0.9], f'natural=peak ele={ele} MDT={round(h)}', 'pico')
# la casa
pon('casa', 'La Casa', None, None, rc['cx'], rc['cz'], 15, [0.25, 1.01], 'Catastro ' + REF_CASA, 'casa')
for l in lugares:
    print('lugar', l['clave'], l['nombre'], l['sub'], l['x'], l['z'], l['y'], l['nota'])

# ------------------------------------------------------------------ recorrido de la cámara
# De las peñas del otro lado del embalse (suroeste de la casa) a rozar el agua frente a la galería.
gx, gz = nG
fin = None
for d in range(150, 330, 5):
    for da_ in range(-40, 41, 4):
        a = math.atan2(gx, gz) + math.radians(da_)
        x, z = rc['cx'] + math.sin(a) * d, rc['cz'] + math.cos(a) * d
        if agua_xz(x, z):
            la, lo = geo(x, z); r_, c_r = rc5(la, lo)
            orilla = dist5[r_, c_r]
            sc = orilla - abs(da_) * 0.3 - abs(d - 220) * 0.08
            if orilla > 14 and (fin is None or sc > fin[0]):
                fin = (sc, x, z, d, da_)
print('final sobre el agua', [round(v, 1) for v in fin])
_, fxw, fzw, _, _ = fin
dirx, dirz = rc['cx'] - fxw, rc['cz'] - fzw; dl = math.hypot(dirx, dirz); dirx /= dl; dirz /= dl
cy = casa['suelo'] + 6.0
def P(t, alt): return [rc['cx'] - dirx * t, alt, rc['cz'] - dirz * t]
rec = [
    {'p': 0.00, 'pos': P(3300, 1650), 'mira': [rc['cx'] + dirx * 1800, 760, rc['cz'] + dirz * 1800]},
    {'p': 0.30, 'pos': P(2100, 1160), 'mira': [rc['cx'] + dirx * 600, 600, rc['cz'] + dirz * 600]},
    {'p': 0.58, 'pos': P(1000, 720), 'mira': [rc['cx'], cy + 20, rc['cz']]},
    {'p': 0.80, 'pos': [fxw - dirx * 150, NIVEL + 32, fzw - dirz * 150], 'mira': [rc['cx'], cy + 6, rc['cz']]},
    {'p': 0.92, 'pos': [fxw - dirx * 30, NIVEL + 5.0, fzw - dirz * 30], 'mira': [rc['cx'], cy + 2, rc['cz']]},
    {'p': 1.00, 'pos': [fxw, NIVEL + 2.2, fzw], 'mira': [rc['cx'], cy, rc['cz']]},
]
# el tramo alto no puede atravesar el monte: se sube cada punto hasta 120 m sobre el relieve que tiene debajo y
# alrededor; el de 0,80 (bajando por la ladera), hasta 25 m sobre el suelo
for r_ in rec:
    x, y, z = r_['pos']
    if y > NIVEL + 40:
        lim_ = max(alt_xz(x + dx, z + dz) for dx in (-150, 0, 150) for dz in (-150, 0, 150)) + 120
    elif r_['p'] == 0.80:
        lim_ = max(alt_xz(x + dx, z + dz) for dx in (-30, 0, 30) for dz in (-30, 0, 30)) + 25
    else:
        lim_ = -1e9
    if y < lim_:
        print('  subo el punto', r_['p'], 'de', round(y), 'a', round(lim_)); r_['pos'][1] = lim_
    r_['pos'] = [round(float(v), 2) for v in r_['pos']]; r_['mira'] = [round(float(v), 2) for v in r_['mira']]
# los dos últimos, sobre el agua
for r_ in rec[4:]:
    assert agua_xz(r_['pos'][0], r_['pos'][2]), ('punto bajo fuera del agua', r_)
for r_ in rec:
    print('rec', r_['p'], r_['pos'], 'suelo', round(alt_xz(r_['pos'][0], r_['pos'][2])))
# holgura a lo largo del recorrido (en línea recta entre puntos; la curva real es suave y monótona)
for a_, b_ in zip(rec, rec[1:]):
    holg = min(lerp_y - alt_xz(lx, lz) for t in np.linspace(0, 1, 60)
               for lx, lerp_y, lz in [[a_['pos'][k] + (b_['pos'][k] - a_['pos'][k]) * t for k in range(3)]])
    print('  tramo', a_['p'], '→', b_['p'], 'holgura mínima', round(holg, 1), 'm')
    if holg < 3:
        print('  ¡OJO! el tramo roza el relieve')


# ------------------------------------------------------------------ plan B: vistas dibujadas (sin WebGL)
def h_edificios(X, Z):
    """Alturas y colores de los edificios del Catastro (bloques con tejado a cuatro aguas) para las vistas 2D."""
    H = np.zeros(X.shape, np.float32); Cl = np.zeros(X.shape + (3,), np.float32); M = np.zeros(X.shape, bool)
    for e in edificios:
        r_ = e['rect']; c, s = math.cos(r_['ang']), math.sin(r_['ang'])
        u = (X - r_['cx']) * c + (Z - r_['cz']) * s; v = -(X - r_['cx']) * s + (Z - r_['cz']) * c
        L, Fh = r_['largo'] / 2, r_['fondo'] / 2
        dentro_ = (np.abs(u) < L + 0.6) & (np.abs(v) < Fh + 0.6)
        if not dentro_.any():
            continue
        plantas = 3 if e['tipo'] == 'casa' else e['pisos']
        alero = e['suelo'] + 0.3 + plantas * 2.85
        borde = np.minimum(L + 0.6 - np.abs(u), Fh + 0.6 - np.abs(v))
        techo = alero + np.minimum(borde, Fh + 0.6) * math.tan(math.radians(26))
        muro = (np.abs(u) < L) & (np.abs(v) < Fh) & (borde < 2.0)
        hh = np.where(dentro_, np.where(muro, alero - 0.2, techo), 0)
        nuevo = dentro_ & (hh > H)
        H[nuevo] = hh[nuevo]; M |= dentro_
        colMuro = np.array([196, 168, 120] if e['tipo'] == 'casa' else [206, 196, 176], np.float32)
        colTeja = np.array([150, 82, 58] if e['tipo'] == 'casa' else [166, 92, 66], np.float32)
        Cl[nuevo] = np.where(muro[nuevo][:, None], colMuro, colTeja)
    return H, Cl, M


def render(W, Hh, pos, mira, fov, luz, espejo=False):
    """Render por columnas del relieve real + ortofoto. Con espejo=True, la cámara bajo la lámina y el agua
    transparente: volteado en vertical, es el reflejo que ve la cámara de verdad."""
    px_, py_, pz_ = pos
    yaw = math.atan2(mira[0] - px_, mira[2] - pz_)
    pitch = math.atan2(mira[1] - py_, math.hypot(mira[0] - px_, mira[2] - pz_))
    if espejo:
        py_ = 2 * NIVEL - py_; pitch = -pitch
    f = (Hh / 2) / math.tan(math.radians(fov / 2))
    K = 3000
    d = 3.0 * (60000 / 3.0) ** (np.arange(K) / (K - 1))
    cols = np.arange(W) - W / 2 + 0.5
    ang = yaw + np.arctan(cols / f)
    cosd = np.cos(ang - yaw)
    X = px_ + np.outer(d, np.sin(ang)); Z = pz_ + np.outer(d, np.cos(ang))
    lat, lon = geo(X, Z)
    h = alt_en(lat, lon)
    agua = es_agua(lat, lon)
    hb, cb, mb = h_edificios(X, Z)
    edif = hb > h
    hv = np.where(edif, hb, np.where(agua, NIVEL, h))
    if espejo:
        hv = np.where(agua & ~edif, -1e5, hv)
    prof = d[:, None] * cosd[None, :]
    y = Hh / 2 - f * (hv - py_) / prof + f * math.tan(pitch)
    oc_ = np.asarray(orto_c2, np.float32); op_ = np.asarray(orto_p2, np.float32)
    def col_de(img, caja):
        S, N, O, E = caja
        fy = (N - lat) / (N - S) * img.shape[0] - 0.5; fx = (lon - O) / (E - O) * img.shape[1] - 0.5
        return np.stack([ndimage.map_coordinates(img[..., c], [fy, fx], order=1, mode='nearest') for c in range(3)], -1)
    color = col_de(olg, CAJA25)
    dentroC = (lat >= CS) & (lat <= CN) & (lon >= CO) & (lon <= CE)
    cc = col_de(oc_, CAJA5); color[dentroC] = cc[dentroC]
    dentroP = (lat >= PS) & (lat <= PN_) & (lon >= PO) & (lon <= PE)
    cp_ = col_de(op_, (PS, PN_, PO, PE)); color[dentroP] = cp_[dentroP]
    e = 6.0
    hx = alt_en(*geo(X + e, Z)); hz = alt_en(*geo(X, Z + e))
    nx_, nz_ = -(hx - h) / e, -(hz - h) / e
    sh = (nx_ * luz[0] + luz[1] + nz_ * luz[2]) / np.sqrt(nx_ ** 2 + nz_ ** 2 + 1)
    color *= np.clip(0.5 + 0.8 * sh, 0.32, 1.25)[..., None]
    # edificios: muros con la luz por su orientación aproximada, tejados algo más oscuros
    color = np.where(edif[..., None], cb * np.clip(0.75 + 0.35 * sh, 0.5, 1.15)[..., None], color)
    bruma = np.array([200, 210, 214], np.float32)
    kf = 1 - np.exp(-(d / 30000.0) ** 2 * 1.4)
    color = color * (1 - kf[:, None, None]) + bruma * kf[:, None, None]
    img = np.zeros((Hh, W, 3), np.float32); es_agua_px = np.zeros((Hh, W), bool); dist_px = np.zeros((Hh, W), np.float32)
    filas = np.arange(Hh)
    yy = np.minimum.accumulate(np.minimum(y, Hh), axis=0)
    cielo_t = np.array([120, 160, 204], np.float32); cielo_h = np.array([226, 230, 232], np.float32)
    aguaV = agua & ~edif
    for c_ in range(W):
        idx = np.searchsorted(-yy[:, c_], -filas, side='left')
        ok = idx < K
        img[ok, c_] = color[idx[ok], c_]
        es_agua_px[ok, c_] = aguaV[idx[ok], c_]
        dist_px[ok, c_] = d[idx[ok]]
        t = np.clip(filas[~ok] / (Hh * 0.55), 0, 1)[:, None]
        img[~ok, c_] = cielo_t * (1 - t) + cielo_h * t
    if espejo:
        img = img[::-1]
    return img, es_agua_px, dist_px, (f, yaw, pitch)


def vista_con_reflejo(W, Hh, pos, mira, fov, luz, nombre):
    img, agua_px, dist_px, cam = render(W, Hh, pos, mira, fov, luz)
    if agua_px.any():
        refl, _, _, _ = render(W, Hh, pos, mira, fov, luz, espejo=True)
        # rizado suave: desplaza unas pocas filas del reflejo según un ruido por fila y columna
        rng = np.random.default_rng(5)
        ruido = ndimage.gaussian_filter(rng.standard_normal((Hh, W)), (1.2, 18)) * 22
        filas = np.clip(np.arange(Hh)[:, None] + np.round(ruido * np.clip(1 - dist_px / 3000, 0, 1)).astype(int), 0, Hh - 1)
        refl = refl[filas, np.arange(W)[None, :]]
        # Fresnel aproximado: cuanto más rasante, más espejo
        incl = np.clip((pos[1] - NIVEL) / np.maximum(dist_px, 1), 0, 1)
        fres = 0.55 + 0.4 * (1 - np.clip(incl * 6, 0, 1))
        cuerpo = np.array([26, 62, 56], np.float32)
        mezcla = refl * 0.92 * fres[..., None] + cuerpo * (1 - fres[..., None])
        img = np.where(agua_px[..., None], mezcla, img)
    Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).save(OUT / f'{nombre}-1600.webp', quality=76, method=6)
    Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).resize((W * 3 // 5, Hh * 3 // 5), Image.LANCZOS).save(OUT / f'{nombre}-960.webp', quality=78, method=6)
    return cam


def proyecta(pt, pos, f, yaw, pitch, W, Hh):
    dx, dz = pt[0] - pos[0], pt[2] - pos[2]
    fr = dx * math.sin(yaw) + dz * math.cos(yaw); la = dx * math.cos(yaw) - dz * math.sin(yaw)
    if fr <= 0:
        return None
    return (W / 2 + f * la / fr, Hh / 2 - f * (pt[1] - pos[1]) / fr + f * math.tan(pitch))


def marcas_de(pos, cam, W, Hh, fase_p):
    f, yaw, pitch = cam
    out = []
    for l in lugares:
        if not (l['fase'][0] <= fase_p <= l['fase'][1]):
            continue
        pr = proyecta((l['x'], l['y'], l['z']), pos, f, yaw, pitch, W, Hh)
        if pr and 0 < pr[0] < W and 0 < pr[1] < Hh:
            out.append({'clave': l['clave'], 'x': round(pr[0] / W * 100, 2), 'y': round(pr[1] / Hh * 100, 2)})
    return out


WB, HB = 1600, 1000
LUZ = np.array([0.55, 0.62, 0.45]); LUZ /= np.linalg.norm(LUZ)         # sol de media tarde, del suroeste
# 1) póster del 3D: el primer encuadre del recorrido (desde las peñas)
camP = vista_con_reflejo(WB, HB, rec[0]['pos'], rec[0]['mira'], 42, LUZ, 'vista-penas')   # el fov del 3D en pantalla ancha
marcasP = marcas_de(rec[0]['pos'], camP, WB, HB, 0.0)
# 2) plan B: desde el agua, un poco más atrás que el final del 3D, con el reflejo de las montañas
# el punto de agua más lejano de la casa (300-800 m, del sureste al oeste) con orilla a más de 25 m
mejorE = None
for d in range(300, 820, 20):
    for az in range(150, 290, 4):
        x = rc['cx'] + d * math.sin(math.radians(az)); z = rc['cz'] - d * math.cos(math.radians(az))
        if agua_xz(x, z):
            la, lo = geo(x, z); r_, c_r = rc5(la, lo)
            if dist5[r_, c_r] > 25 and (mejorE is None or d > mejorE[0]):
                mejorE = (d, x, z, az)
print('vista del espejo desde', mejorE)
posE = [mejorE[1], NIVEL + 3.0, mejorE[2]]
dEx, dEz = rc['cx'] - posE[0], rc['cz'] - posE[2]; dE = math.hypot(dEx, dEz)
miraE = [posE[0] + dEx / dE * (dE + 500), NIVEL + 3.0 + 0.04 * (dE + 500), posE[2] + dEz / dE * (dE + 500)]
camE = vista_con_reflejo(WB, HB, posE, miraE, 46, LUZ, 'vista-espejo')
marcasE = [k for k in marcas_de(posE, camE, WB, HB, 0.5) if k['clave'] != 'presa']
print('marcas póster', marcasP); print('marcas espejo', marcasE)

# plano del pueblo (ortofoto de detalle con los tejados; los edificios ya están en la foto)
LADO = 260.0; pcx, pcz = rc['cx'] - 30, rc['cz'] + 40
i0p, j0p = a_px(pcx - LADO / 2, pcz - LADO / 2); i1p, j1p = a_px(pcx + LADO / 2, pcz + LADO / 2)
orto_p.crop((int(i0p), int(j0p), int(i1p), int(j1p))).resize((900, 900), Image.LANCZOS).save(OUT / 'plano-pueblo-900.webp', quality=76, method=6)

# ------------------------------------------------------------------ metadatos
meta = {
    'version': 1,
    'origen': {'lat': CASA[0], 'lon': CASA[1], 'catastro': 'LG TANES 9 · ' + REF_CASA},
    'kx': round(KX, 3), 'kz': KZ, 'nivel': NIVEL,
    'rasters': rasters,
    'orto': {
        'cerca': {'x0': rasters['cerca']['x0'], 'z0': rasters['cerca']['z0'], 'x1': rasters['cerca']['x1'], 'z1': rasters['cerca']['z1'],
                  'archivos': {'alta': 'orto-cerca-3072.webp', 'baja': 'orto-cerca-2048.webp'}},
        'pueblo': {'x0': round(fx0, 2), 'z0': round(fz0, 2), 'x1': round(fx1, 2), 'z1': round(fz1, 2),
                   'archivos': {'alta': 'orto-pueblo-2048.webp', 'baja': 'orto-pueblo-1024.webp'}},
        'lejos': {'x0': round(loc(CAJA25[1], CAJA25[2])[0], 2), 'z0': round(loc(CAJA25[1], CAJA25[2])[1], 2),
                  'x1': round(loc(CAJA25[0], CAJA25[3])[0], 2), 'z1': round(loc(CAJA25[0], CAJA25[3])[1], 2),
                  'archivos': {'alta': 'orto-lejos-2048.webp', 'baja': 'orto-lejos-2048.webp'}},
        'agua': {'archivo': 'agua.png', 'metros_por_unidad': 2.0},
    },
    'casona': CASONA,
    'edificios': edificios,
    'arboles': arb,
    'lugares': lugares,
    'recorrido': rec,
    'planB': {'poster': {'archivos': ['vista-penas-960.webp', 'vista-penas-1600.webp'], 'ancho': WB, 'alto': HB, 'marcas': marcasP},
              'vista': {'archivos': ['vista-espejo-960.webp', 'vista-espejo-1600.webp'], 'ancho': WB, 'alto': HB, 'marcas': marcasE},
              'plano': {'archivo': 'plano-pueblo-900.webp', 'cx': round(pcx, 2), 'cz': round(pcz, 2), 'lado': LADO}},
    'fuentes': {
        'ign': 'Relieve MDT05 y MDT25 y ortofoto PNOA © IGN / CNIG, CC BY 4.0',
        'catastro': 'Planta de la casa y del pueblo © Dirección General del Catastro',
        'osm': 'Nombres de lugares © colaboradores de OpenStreetMap (ODbL)',
    },
    'fecha_datos': time.strftime('%Y-%m-%d'),
}
(OUT / 'lugar.json').write_text(json.dumps(meta, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
tot = 0
for f in sorted(OUT.iterdir()):
    tot += f.stat().st_size; print(f'{f.name:28s} {f.stat().st_size // 1024:6d} KB')
print('total img/lugar', tot // 1024, 'KB')
