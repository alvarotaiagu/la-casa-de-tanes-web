"""Nitidez real de las fotos: cociente de detalle a escala 1:1 frente a 1:2.
Uso: python -I -X utf8 scripts/fotos-nitidez.py [carpeta ...]   (por defecto ref/origen)
Detalle = media del |laplaciano| sobre el 60 % central en gris. Una foto con resolución real da un cociente
alrededor de 0,6 o más; una ampliada (el píxel no lleva información propia) baja de ~0,5. Escribe ref/raw/nitidez.json."""
import json, sys, pathlib
import cv2, numpy as np

RAIZ = pathlib.Path(__file__).resolve().parent.parent
carpetas = [pathlib.Path(a) for a in sys.argv[1:]] or [RAIZ / 'ref/origen']

def detalle(g):
    return float(np.mean(np.abs(cv2.Laplacian(g, cv2.CV_32F, ksize=3))))

res = {}
for c in carpetas:
    for f in sorted(c.glob('*')):
        if f.suffix.lower() not in ('.jpg', '.jpeg', '.png'):
            continue
        im = cv2.imdecode(np.fromfile(str(f), np.uint8), cv2.IMREAD_GRAYSCALE)
        if im is None:
            continue
        h, w = im.shape
        g = im[int(h * .2):int(h * .8), int(w * .2):int(w * .8)].astype(np.float32)
        mitad = cv2.resize(g, (g.shape[1] // 2, g.shape[0] // 2), interpolation=cv2.INTER_AREA)
        q = detalle(g) / max(detalle(mitad), 1e-6)
        res[f'{c.name}/{f.name}'] = {'ancho': w, 'alto': h, 'cociente': round(q, 3)}
        print(f'{c.name}/{f.name:70s} {w}x{h}  {q:.2f}')
(RAIZ / 'ref/raw').mkdir(parents=True, exist_ok=True)
(RAIZ / 'ref/raw/nitidez.json').write_text(json.dumps(res, indent=1, ensure_ascii=False), encoding='utf-8')
