"""Portada «La Casa»: separa la foto 01 en tres capas con el MISMO sistema de coordenadas (2000×1333):
  monte  la foto entera (cielo, peñas y monte): va detrás de todo; no se recorta ni se rellena
  agua   el embalse y el pueblo de la izquierda, de la orilla para abajo (delante de las letras)
  casa   la casona (tejado, chimenea, muros y galería), el jardín y el verde de delante (delante de todo)
Entre «monte» y «agua» van las letras gigantes «La Casa»: quedan DETRÁS de la casa y del pueblo, delante de las peñas.
Al bajar, las capas se separan escalando cada una más que la de detrás desde el mismo punto (la base de la casa,
ORIGEN): como la casa y el agua «crecen» desde ahí, siempre tapan su propio fantasma en la capa de detrás y no hace
falta rellenar nada (las regiones son estrelladas respecto a ORIGEN).
Recorte de la casa: el contorno de arriba (tejado, chimenea, aleros) sale de rembg (isnet-general-use), que lo clava
contra el cielo y el monte; de cintura para abajo manda un polígono medido sobre la foto (rembg ahí deja la casa a
medias). Orilla y pueblo, polígonos medidos sobre la foto a 2000 px (ver los números abajo).
Uso: python -X utf8 scripts/portada-capas.py   (sin -I: rembg vive en el site-packages del usuario)
     → ref/portada/agua.png, casa.png (RGBA, 2000×1333), mascaras.json y ref/portada/ver-*.jpg (comprobación)"""
import json, pathlib, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

RAIZ = pathlib.Path(__file__).resolve().parent.parent
SRC = RAIZ / 'ref/origen/01.jpg'
OUT = RAIZ / 'ref/portada'; OUT.mkdir(parents=True, exist_ok=True)
im = Image.open(SRC).convert('RGB')
W, H = im.size
assert (W, H) == (2000, 1333), (W, H)
ORIGEN = (1330, 1333)   # la base de la casa, en el borde de abajo: centro de todas las escalas

def poligono(pts, desenfoque=1.6):
    m = Image.new('L', (W, H), 0)
    ImageDraw.Draw(m).polygon(pts, fill=255)
    return np.asarray(m.filter(ImageFilter.GaussianBlur(desenfoque))).astype(np.float32) / 255

# ---------- la casa ----------
cache = OUT / 'rembg-01.png'
if not cache.exists():
    from rembg import remove, new_session
    remove(im, session=new_session('isnet-general-use'), only_mask=True).save(cache)
r = np.asarray(Image.open(cache).convert('L')).astype(np.float32) / 255
# solo la casona: fuera de su caja, nada (rembg deja algún resto suelto)
caja = np.zeros_like(r); caja[150:1333, 820:1890] = 1
r = r * caja
# de cintura para abajo rembg deja la casa a medias: el cuerpo, el porche y el jardín de delante, por polígono
cuerpo = poligono([(924, 525), (1580, 320), (1795, 560), (1806, 1060), (1760, 1140), (1700, 1200), (1640, 1333), (810, 1333), (810, 1090), (924, 1060)])
# el jardín de la izquierda (césped, valla, banco y olivo, más cerca que la casa)
jardin = poligono([(0, 1120), (300, 1110), (560, 1060), (620, 1000), (760, 960), (924, 950), (924, 1333), (0, 1333)], 2.5)
# el verde de delante, abajo a la derecha
verde = poligono([(1700, 1200), (1806, 1060), (1880, 980), (2000, 940), (2000, 1333), (1640, 1333)], 2.5)
# rembg manda arriba (y < 600); abajo se suma el polígono
arriba = np.zeros_like(r); arriba[:620] = 1
casa = np.clip(np.maximum.reduce([r * np.where(np.arange(H)[:, None] < 1000, 1, 0.0), cuerpo, jardin, verde]), 0, 1)
# limpiar el halo: lo que rembg da por debajo de 0,12 es cielo
casa[casa < 0.12] = 0

# ---------- el agua (orilla para abajo, a la izquierda de la casa) ----------
agua = poligono([(0, 778), (200, 772), (500, 760), (700, 750), (940, 733), (940, 960), (760, 965), (620, 1005), (560, 1065), (300, 1115), (0, 1125)], 2.0)
agua = agua * (1 - casa)   # lo que es casa no es agua

def guardar(nombre, alfa):
    a = Image.fromarray((alfa * 255).round().astype(np.uint8))
    # lo transparente, a negro: si no, AVIF codifica la foto entera que hay debajo del alfa 0 (pesa el triple)
    rgb = np.asarray(im).copy(); rgb[alfa <= 0] = 0
    c = Image.fromarray(rgb); c.putalpha(a); c.save(OUT / f'{nombre}.png', optimize=True)
    ver = Image.new('RGB', (W, H), (255, 0, 255)); ver.paste(im, (0, 0), a)
    ver.resize((1000, 667), Image.LANCZOS).save(OUT / f'ver-{nombre}.jpg', quality=82)
    return float((alfa > 0.5).mean())

info = {'foto': 'ref/origen/01.jpg', 'ancho': W, 'alto': H, 'origen': ORIGEN,
        'cubre': {'casa': round(guardar('casa', casa), 4), 'agua': round(guardar('agua', agua), 4)}}
# el tejado (lo más alto de la casa en cada columna): construir.mjs lo usa para comprobar que las letras quedan detrás
cols = {}
for x in range(820, 1890, 10):
    ys = np.where(casa[:, x] > 0.5)[0]
    if len(ys): cols[x] = int(ys[0])
info['tejado'] = cols
(OUT / 'mascaras.json').write_text(json.dumps(info, indent=1), encoding='utf-8')
print(json.dumps(info['cubre']), 'tejado más alto', min(cols.values()), 'en x', min(cols, key=cols.get))
