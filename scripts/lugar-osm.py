# Lugares y orilla del embalse de OpenStreetMap para «El espejo de Tanes» (© colaboradores de OpenStreetMap, ODbL).
# Pide a Overpass (con espejos y reintentos) y guarda la respuesta cruda en ref/raw/lugar-cache/osm-tanes.json.
# El emparejado y la comprobación (etiquetas + distancia) los hace scripts/lugar-datos.py.
# Uso: python -I -X utf8 scripts/lugar-osm.py
import json, pathlib, time, urllib.parse, urllib.request

R = pathlib.Path(__file__).resolve().parent.parent
CACHE = R / 'ref' / 'raw' / 'lugar-cache'; CACHE.mkdir(parents=True, exist_ok=True)
UA = 'datos-mapa-script/1.0 (uso puntual)'          # genérico, sin datos personales (con UA de navegador da 406)
ESPEJOS = ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter',
           'https://overpass.osm.ch/api/interpreter', 'https://overpass.kumi.systems/api/interpreter']
Q = '''[out:json][timeout:90];
(
  way["natural"="water"]["water"="reservoir"](43.17,-5.46,43.24,-5.34);
  relation["natural"="water"]["water"="reservoir"](43.17,-5.46,43.24,-5.34);
  way["waterway"="dam"](43.17,-5.46,43.25,-5.33);
  node["place"~"village|hamlet"](43.15,-5.48,43.26,-5.30);
  node["natural"="peak"]["name"](43.08,-5.62,43.32,-5.20);
  nwr["tourism"="museum"](43.19,-5.42,43.22,-5.38);
);
out geom tags;'''


def pedir():
    datos = urllib.parse.urlencode({'data': Q}).encode()
    espera = 4
    for vuelta in range(4):
        for url in ESPEJOS:
            try:
                req = urllib.request.Request(url, data=datos, headers={'User-Agent': UA})
                j = json.loads(urllib.request.urlopen(req, timeout=150).read())
                if j.get('elements'):
                    print('OK', url, len(j['elements']), 'elementos'); return j
                print('vacío', url)
            except Exception as e:
                print('falla', url, str(e)[:80])
        print('reintento en', espera, 's'); time.sleep(espera); espera *= 2
    raise SystemExit('Overpass no responde: vuelve a probar más tarde')


j = pedir()
(CACHE / 'osm-tanes.json').write_text(json.dumps(j, ensure_ascii=False), encoding='utf-8')
