"""La paleta, MEDIDA en las fotos (no a ojo). Uso: python -I -X utf8 scripts/paleta.py → ref/raw/paleta.json
Cada color es la mediana de los píxeles de una zona de una foto, filtrados por matiz/saturación/brillo para quedarse
solo con el material (el latón de las letras, la arenisca de la fachada, la madera de la galería, el agua, el almagre…).
Las zonas están en píxeles de la foto original (ref/origen/NN.jpg)."""
import json, pathlib, colorsys
import numpy as np
from PIL import Image

RAIZ = pathlib.Path(__file__).resolve().parent.parent
O = RAIZ / 'ref/origen'

def hsv(a):
    a = a.astype(np.float32) / 255
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    mx, mn = a.max(-1), a.min(-1)
    c = mx - mn
    h = np.zeros_like(mx)
    m = c > 1e-6
    rr = (mx == r) & m; gg = (mx == g) & m & ~rr; bb = m & ~rr & ~gg
    h[rr] = ((g - b)[rr] / c[rr]) % 6
    h[gg] = (b - r)[gg] / c[gg] + 2
    h[bb] = (r - g)[bb] / c[bb] + 4
    return h * 60, np.where(mx > 0, c / np.maximum(mx, 1e-6), 0), mx

def medir(foto, caja, h0, h1, s0=0.0, s1=1.0, v0=0.0, v1=1.0, cuantil=50):
    im = np.asarray(Image.open(O / foto).convert('RGB'))
    x0, y0, x1, y1 = caja
    a = im[y0:y1, x0:x1].reshape(-1, 3)
    h, s, v = hsv(a)
    if h0 <= h1: okh = (h >= h0) & (h <= h1)
    else: okh = (h >= h0) | (h <= h1)
    ok = okh & (s >= s0) & (s <= s1) & (v >= v0) & (v <= v1)
    sel = a[ok]
    if len(sel) < 50: raise SystemExit(f'pocos píxeles en {foto} {caja}: {len(sel)}')
    # mediana por luminancia (un color real de la foto, no una media que no existe)
    lum = sel @ np.array([0.2126, 0.7152, 0.0722])
    i = np.argsort(lum)[int(len(sel) * cuantil / 100)]
    # alrededor de ese cuantil, la mediana de cada canal (quita el ruido de un píxel suelto)
    k = np.argsort(lum); c = int(len(sel) * cuantil / 100); ven = sel[k[max(0, c - len(sel) // 20):c + len(sel) // 20 + 1]]
    rgb = np.median(ven, axis=0).round().astype(int)
    return '#%02X%02X%02X' % tuple(rgb), int(len(sel))

ZONAS = {
    # las letras «La Casa» de latón, foto 19 (zona de las letras, solo el metal claro y amarillento)
    'laton':        ('19.jpg', (170, 530, 500, 670), 35, 60, 0.25, 0.75, 0.55, 1.0, 50),
    'laton_sombra': ('19.jpg', (170, 530, 500, 670), 30, 60, 0.30, 0.90, 0.25, 0.55, 50),
    # la arenisca dorada de la fachada, foto 01 (sillares de la esquina y del muro con el rótulo)
    'arenisca':     ('01.jpg', (1240, 620, 1560, 1000), 25, 50, 0.20, 0.60, 0.45, 0.95, 50),
    'arenisca_luz': ('01.jpg', (1240, 620, 1560, 1000), 25, 50, 0.10, 0.50, 0.70, 1.0, 85),
    # el castaño de la galería de madera, foto 01
    'castano':      ('01.jpg', (965, 760, 1210, 860), 0, 40, 0.30, 1.0, 0.10, 0.60, 50),
    'castano_hondo':('01.jpg', (965, 760, 1210, 860), 0, 40, 0.30, 1.0, 0.05, 0.40, 15),
    # el verde del embalse, foto 01 (el agua entre la orilla y los tejados)
    'embalse':      ('01.jpg', (300, 770, 900, 840), 150, 200, 0.20, 1.0, 0.15, 0.80, 50),
    'embalse_21':   ('21.jpg', (60, 560, 1150, 760), 150, 200, 0.20, 1.0, 0.25, 0.95, 50),
    # el almagre de las paredes (foto 77, la pared roja del comedor)
    'almagre':      ('77.jpg', (0, 0, 900, 1100), 345, 18, 0.55, 1.0, 0.35, 0.85, 50),
    'almagre_13':   ('13.jpg', (0, 0, 2000, 903), 345, 18, 0.55, 1.0, 0.35, 0.85, 50),
    # los colores de las estancias (sección «Cada una con su color»)
    'verde_botella':('61.jpg', (0, 0, 2000, 1500), 95, 160, 0.45, 1.0, 0.20, 0.85, 50),
    'azulejo_rojo': ('02.jpg', (1000, 300, 2000, 900), 350, 20, 0.55, 1.0, 0.35, 0.95, 50),
    'ocre':         ('80.jpg', (0, 0, 721, 1600), 30, 48, 0.55, 1.0, 0.45, 1.0, 50),
    'azul':         ('22.jpg', (0, 0, 1600, 721), 200, 235, 0.35, 1.0, 0.25, 0.90, 50),
    'amarillo':     ('44.jpg', (0, 0, 1125, 1100), 42, 60, 0.35, 1.0, 0.55, 1.0, 50),
}
res = {}
for k, (f, caja, *filt) in ZONAS.items():
    c, n = medir(f, caja, *filt)
    res[k] = {'hex': c, 'foto': f, 'zona': caja, 'pixeles': n}
    print(f'{k:14s} {c}  ({f}, {n} px)')
(RAIZ / 'ref/raw').mkdir(parents=True, exist_ok=True)
(RAIZ / 'ref/raw/paleta.json').write_text(json.dumps(res, indent=1), encoding='utf-8')
