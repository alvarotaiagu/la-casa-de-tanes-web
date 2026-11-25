"""El rótulo «La Casa» como TRAZADO SVG (no texto): las letras de latón de la fachada (fotos 01 y 19) escritas con
Imperial Script (Google Fonts, SIL OFL; ref/fuentes/), la script de Google más parecida a la cursiva inglesa del latón:
L con lazo abajo, C con rizo arriba y trazo grueso. No se vectoriza la foto (decisión de Álvaro).
Se compone con HarfBuzz (las uniones y el kerning de la letra) y se sacan los contornos con fontTools.
Salen:
  marca/rotulo.json   { viewBox, ancho, alto, glifos: [{ letra, d }] }  (lo usan construir.mjs y la portada)
  marca/rotulo.svg    el rótulo entero en currentColor
  marca/favicon.svg   la «L» en latón sobre castaño
Uso: python -I -X utf8 scripts/marca-rotulo.py"""
import json, pathlib
import uharfbuzz as hb
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen

RAIZ = pathlib.Path(__file__).resolve().parent.parent
TTF = RAIZ / 'ref/fuentes/ImperialScript-Regular.ttf'
TEXTO = 'La Casa'

blob = hb.Blob.from_file_path(str(TTF))
face = hb.Face(blob); font = hb.Font(face)
buf = hb.Buffer(); buf.add_str(TEXTO); buf.guess_segment_properties()
hb.shape(font, buf, {'kern': True, 'liga': True, 'calt': True})
tt = TTFont(str(TTF)); gs = tt.getGlyphSet(); orden = tt.getGlyphOrder()
upm = tt['head'].unitsPerEm

def r(v):
    s = f'{v:.1f}'.rstrip('0').rstrip('.')
    return '0' if s == '-0' else s

x = 0; glifos = []; caja = BoundsPen(gs)
for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
    nombre = orden[info.codepoint]
    letra = TEXTO[info.cluster]
    dx, dy = x + pos.x_offset, pos.y_offset
    x += pos.x_advance
    if letra == ' ':
        x += 0.14 * upm   # como en la fachada: «La» y «Casa» bien separadas (el espacio de la letra es corto)
        continue
    # y hacia abajo (SVG): (gx, gy) → (gx + dx, -(gy + dy))
    pen = SVGPathPen(gs, ntos=r)
    gs[nombre].draw(TransformPen(pen, (1, 0, 0, -1, dx, -dy)))
    gs[nombre].draw(TransformPen(caja, (1, 0, 0, -1, dx, -dy)))
    glifos.append({'letra': letra, 'glifo': nombre, 'd': pen.getCommands()})
x0, y0, x1, y1 = caja.bounds
m = 0.02 * upm
vb = [x0 - m, y0 - m, (x1 - x0) + 2 * m, (y1 - y0) + 2 * m]
datos = {'texto': TEXTO, 'fuente': 'Imperial Script (Google Fonts, SIL OFL 1.1)', 'upm': upm,
         'viewBox': ' '.join(r(v) for v in vb), 'ancho': round(vb[2], 1), 'alto': round(vb[3], 1),
         # la línea base (y=0) en proporción del alto de la caja: para colocar el rótulo sobre la foto
         'base': round((0 - vb[1]) / vb[3], 4), 'glifos': glifos}
(RAIZ / 'marca').mkdir(exist_ok=True)
(RAIZ / 'marca/rotulo.json').write_text(json.dumps(datos, ensure_ascii=False, indent=1), encoding='utf-8')
d = ''.join(g['d'] for g in glifos)
(RAIZ / 'marca/rotulo.svg').write_text(
    f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{datos["viewBox"]}" fill="currentColor"><title>La Casa</title><path d="{d}"/></svg>\n',
    encoding='utf-8')
# favicon: la L del rótulo, en latón sobre castaño
L = glifos[0]
cajaL = BoundsPen(gs)
nombreL = L['glifo']; gs[nombreL].draw(TransformPen(cajaL, (1, 0, 0, -1, 0, 0)))
lx0, ly0, lx1, ly1 = cajaL.bounds
lado = max(lx1 - lx0, ly1 - ly0) * 1.18
cx, cy = (lx0 + lx1) / 2, (ly0 + ly1) / 2
(RAIZ / 'marca/favicon.svg').write_text(
    f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{r(cx - lado / 2)} {r(cy - lado / 2)} {r(lado)} {r(lado)}">'
    f'<rect x="{r(cx - lado / 2)}" y="{r(cy - lado / 2)}" width="{r(lado)}" height="{r(lado)}" rx="{r(lado * .18)}" fill="#22150F"/>'
    f'<path fill="#C9B88E" d="{L["d"]}"/></svg>\n', encoding='utf-8')
print('rótulo', datos['viewBox'], len(glifos), 'glifos', 'base', datos['base'], [g['glifo'] for g in glifos])
