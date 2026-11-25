# La Casa de Tanes · «La Casa»

Propuesta de web para **La Casa de Tanes**, estudios y apartamentos boutique en Tanes 9 (33994 Caso, Asturias), en el
Parque Natural de Redes, sobre el embalse de Tanes. No la han encargado. Una sola página (`index.html`) más legales y
404. **En local, sin publicar y sin commits.** `noindex, nofollow` en todas las páginas. Solo castellano.

Datos: `ref/DATOS-TANES.md` (lo que no está ahí va a [`PENDIENTES.md`](PENDIENTES.md) o se marca «por confirmar»).
Encargo: `ENCARGO.md`. El 3D («El espejo de Tanes») es del agente Lugar 3D: sus notas, en [`LUGAR.md`](LUGAR.md).

## El concepto: «La Casa»

Su única marca son las letras **«La Casa» de latón, en cursiva inglesa, atornilladas a la piedra** de la fachada
(fotos 01 y 19). La web las hace gigantes y las mete **detrás de la casa**: en la portada, la foto 01 a sangre partida
en tres capas con el mismo sistema de coordenadas (el monte, el agua con el pueblo, la casona con su jardín) y, entre
el monte y el pueblo, el rótulo «La Casa» en latón, tan grande como el valle; el tejado y la chimenea le tapan el
final. Al bajar, la portada se fija un tramo: las capas **se separan** (cada una crece más que la de detrás desde la
base de la casa) y el rótulo **se encoge y viaja** hasta quedar de logo en la cabecera. Lo que la portada abre, el
**pie lo cierra**: el rótulo vuelve a escribirse entero, trazo a trazo, en latón.

Lectura de diseño (skill `design-taste-frontend`): alojamiento rural boutique para quien decide y reserva, con lenguaje
de marca (el latón sobre la piedra), cinematográfico y sobrio; dials 7 / 6 / 3. **Una sola página oscura**, en el
castaño de la madera de dentro (sin modo claro, como sus hermanas): las fotos de interiores, cálidas, brillan sobre
él. La paleta «latón y arenisca» es la que la skill pide no usar por defecto; aquí la manda la marca real (y el
ENCARGO): no es un tono elegido, es el metal de su fachada medido en la foto.

### Las letras (Google Fonts, `display=swap`)

Ninguna está en la cartera (`verificar.mjs` lo comprueba con un grep en `../*-web`):

- **Imperial Script**: la script de Google más parecida al latón (foto 19): L con lazo abajo, C con rizo arriba y trazo
  grueso. Comparada con Pinyon (ya usada en otra web), Great Vibes, Rouge, Petit Formal, Corinthia, Italianno y Mrs
  Saint Delafield. **El rótulo no se escribe con la letra: va como TRAZADO SVG** (`scripts/marca-rotulo.py`, HarfBuzz +
  fontTools, con el hueco entre «La» y «Casa» como en la fachada) en la portada, la cabecera, el pie, las legales y el
  favicon. No se ha vectorizado la foto (decisión de Álvaro).
- **Sofia Sans Condensed** (titulares, en 200–400): estrecha y alta, deja todo el protagonismo al rótulo.
- **Ubuntu Sans** (texto, ancho 96 %).
- **Google Sans Code** (cifras: minutos, km, el calendario, los colores en hexadecimal).

### Los colores, MEDIDOS en sus fotos

`scripts/paleta.py` saca cada color como mediana de los píxeles del material (filtrados por matiz, saturación y brillo)
en una zona de una foto → `ref/raw/paleta.json`. `scripts/paleta-derivar.mjs` deriva el fondo y comprueba contrastes →
`ref/raw/paleta-derivada.json`.

| Token | Color | De dónde | Uso |
|---|---|---|---|
| `--laton` | `#B4A380` | el metal de las letras, foto 19 | la marca: logo, cifras grandes, filetes, foco (7,5:1 sobre el fondo) |
| `--arenisca` | `#E6D6C5` | la piedra al sol, foto 01 | el texto (13:1) |
| `--arenisca-media` | `#C8AE92` | la piedra media, foto 01 | texto secundario (8,8:1) |
| `--castano` | `#54382E` | la madera de la galería, foto 01 | referencia; el **fondo** `#1F0F0A` es su tono hondo (`#3B2017`) a L 0,19 en OKLCH, y la superficie `#2C1C17` a 0,245 |
| `--embalse` | `#79AA9C` | el agua, foto 21 | días elegidos del calendario, aviso del simulador, iconos de ruta |
| `--almagre` | `#872F1A` | las paredes rojas, foto 13 | solo los botones «Ver fechas» (texto arenisca 6:1) |

La carta de colores usa además los de cada estancia, medidos igual: almagre `#872F1A` (13), verde botella `#293C1D`
(61), azulejo a cuadros `#722D15` (02), ocre `#B7690D` (80), azul `#365989` (22) y amarillo `#DBB957` (44).

Contrato con Lugar 3D: `--fondo`, `--superficie`, `--texto`, `--texto-suave`, `--marca` (= latón), `--acento`
(= almagre), `--agua` (= embalse), `--linea`, `--letra-titular`, `--letra-texto`, `--letra-script`, `--letra-cifras`,
en `:root` de `css/base.css`. Formas: botones y mandos en píldora; fotos y paneles en arista viva.

## Las secciones

1. **Portada «La Casa»** (`js/portada.js`, `Tanes.portada`). La foto 01 (2000×1333, **nitidez 0,76**: resolución
   real) en tres capas (`scripts/portada-capas.py`: el contorno de arriba de la casa con rembg, que lo clava contra el
   cielo; de cintura para abajo y la orilla, polígonos medidos sobre la foto). Respaldo (sin JS, movimiento reducido,
   pantallas bajas y versión sobria): la composición quieta, con el logo a la vista. En el móvil y en pantallas en
   vertical, la foto va bajo la cabecera y ocupa el 56 % del alto (la casa entera), con el texto debajo. **Gesto** (§5 bis): arrastrar en horizontal sobre la portada desliza
   el rótulo por detrás del tejado; al soltar vuelve con un muelle (`touch-action: pan-y`).
2. **Cada una con su color**: cifras grandes del conjunto (14 viajeros y 5 dormitorios, según Airbnb, «por
   confirmar»; todas al sur), la **carta de colores** (seis tiras, una por color medido, con su foto; la elegida se
   ensancha; en el móvil, carril horizontal), servicios con **icono propio** (sprite `partes/iconos.html`, trazo 1,6) en
   tres grupos y las condiciones aparte. Sin nombres de apartamento ni «qué foto es de cuál».
3. **Todo mira al sur**: la casa por estancias, empezando por **las ventanas** (73, 06, 04, 50, 71, 51, con filas más
   altas). Índice fijo que marca la estancia que se ve (en el móvil, pestañas cortas pegadas bajo la cabecera), fotos
   sin marco en filas de la misma altura y el visor que abre por NOMBRE.
4. **El espejo de Tanes** (`#lugar`): el 3D de Lugar 3D. Respaldo de la Web: la foto 45 (las montañas reflejadas).
5. **Redes alrededor**: el trayecto por la AS-117 en tres tramos (en el valle, por Redes, para llegar), **todo de
   OSRM** (`ref/raw/rutas.json`): Museo de la Apicultura (500 m, también a pie), Cueva del Deboyu, La Casa del Agua
   (Rioseco), Centro del Parque (Campo de Caso), Ruta del Alba (Soto de Agues), Puerto de Tarna, Oviedo (54,7 km,
   51 min; la ficha decía 30 min) y el aeropuerto (88,9 km).
6. **Reseñas**: 9,2 / 10 con 205 en Booking y 4,6 / 5 con 18 en Google, con enlace a cada una. Sin citas (no hay
   reseñas copiadas en DATOS).
7. **Ver fechas**: el **simulador** (`js/reserva.js`), marcado como tal: calendario con días ocupados inventados y
   temporada alta supuesta, personas 1–14, resumen con noches y total orientativo. No reserva, no envía ni guarda nada
   y no pide datos. Al lado, la alternativa real: llamar al 609 05 34 98 o buscarla en Booking. Supuestos escritos.
8. **Cómo llegar**: dirección, teléfono, Oviedo y el aeropuerto (OSRM), el mapa de Google tras pulsar y la foto aérea.

Pie con el rótulo que se escribe. Legales (aviso legal, privacidad, cookies, accesibilidad) con el titular «por
confirmar». Aviso de cookies. 404 con el rótulo.

## Cómo se trabaja

```
python -I -X utf8 scripts/fotos-nitidez.py      # nitidez real de las 82 fotos → ref/raw/nitidez.json
python -I -X utf8 scripts/paleta.py             # los colores medidos → ref/raw/paleta.json
node scripts/paleta-derivar.mjs                 # fondo derivado y contrastes → ref/raw/paleta-derivada.json
node scripts/fotos.mjs                          # img/fotos/<nombre>-<ancho>.{avif,webp,jpg} + fotos.json (nunca amplía)
python -I -X utf8 scripts/marca-rotulo.py       # el rótulo «La Casa» como trazado → marca/rotulo.json, rotulo.svg, favicon.svg
python -X utf8 scripts/portada-capas.py         # las capas de la portada (rembg: sin -I) → ref/portada/*.png, mascaras.json
node scripts/portada-imagenes.mjs               # img/portada/{monte,agua,casa}-{1000,1500,2000}.{avif,webp,jpg}
node scripts/portada-ver.mjs                    # composición SIN navegador para colocar el rótulo → ref/portada/portada-*.jpg
node scripts/marca.mjs                          # favicons e img/og.jpg
node scripts/alrededor-rutas.mjs                # distancias OSRM → ref/raw/rutas.json (los ids de OSM, de alrededor-buscar*.mjs)
node scripts/legales.mjs                        # *.src.html de las legales y el 404
node construir.mjs                              # partes, datos, fotos → *.html; versionar.mjs pone ?v=<huella>
node verificar.mjs                              # Playwright, puerto 8951 (un navegador, sin pintar WebGL)
```

Se edita SIEMPRE el `*.src.html` o la parte (`partes/`); el `.html` se regenera. **Una sola fuente de datos:**
`data/tanes.json` (cifras, colores, servicios, condiciones, estancias, reseñas, supuestos del simulador, titular).
La colocación del rótulo, en `data/portada.json` (en píxeles de la foto, escritorio y móvil). Las distancias, solo de
`ref/raw/rutas.json`. `construir.mjs` deja siempre `css/lugar.css` y `js/lugar.js` aunque falten.

### Módulos

| Módulo | Agente | Hueco | Ficheros |
|---|---|---|---|
| `portada` | Web | `#portada [data-modulo="portada"]` (respaldo: la escena quieta; el LCP es la capa «monte») | `js/portada.js` (CSS en `css/estilos.css`) |
| `lugar` | Lugar 3D | `#lugar [data-modulo="lugar"]` (respaldo: la foto 45 y su pie) | `js/lugar.js`, `css/lugar.css`, `img/lugar/`, `vendor/`, `scripts/lugar-*` → [`LUGAR.md`](LUGAR.md) |

Contrato: `Tanes.<mod>.montar(el, { movimiento, densidad, webgl })` → `{ destruir() }`. `main.js` monta la portada al
cargar y el lugar al acercarse (900 px). Eventos: `tanes:resize` (solo los resize de verdad), `tanes:densidad`.
Integración del 3D (LUGAR.md, «Para Web»): Three.js va en `vendor/` y lo pide `js/lugar.js` (la Web no carga nada);
ningún antepasado del div lleva overflow, transform ni filter; `#lugar { --lugar-arriba: var(--cabecera) }`; el div a
todo el ancho y con margen en `[data-modo="plano"]`. La sección es `.espejo` (no `.lugar`: esa clase es del módulo).

## Mando de densidades (solo con `?revision`)

`index.html?revision` enseña «Versión: **La Casa** / **Sobria**» (abajo a la izquierda; se aparta con el aviso de
cookies). Sin `?revision` no existe. No lleva mando de paleta: es la marca real de un negocio real.

- **La Casa**: la portada que se separa y manda el rótulo al logo, la carta de colores en acordeón, el pie que se escribe.
- **Sobria**: la portada quieta, la carta con las seis tiras iguales, el pie ya escrito y **añade** la tabla «La casa,
  de un vistazo» (viajeros, dormitorios, estancias, cocina, baño, orientación, entrada, salida, mascotas, wifi y
  aparcamiento, registro).

### Receta de borrado (antes de enseñársela al cliente como web suya)

1. `partes/cabeza.html`: borrar desde `// MANDO DE MAQUETA` hasta el cierre de su `if (q.has('revision')) { … }`.
2. `partes/pie.html`: borrar desde `<!-- MANDO DE MAQUETA` hasta `<!-- fin del MANDO DE MAQUETA -->`.
3. `js/main.js`: borrar el bloque `/* ===… 15. MANDO DE MAQUETA` … `/* fin del MANDO DE MAQUETA */`.
4. `css/estilos.css`: borrar desde `/* ============ MANDO DE MAQUETA` hasta `/* fin del MANDO DE MAQUETA */`.
5. Si ya no hace falta la tabla de la sobria: quitar `.replace('<!--vistazo-->', vistazo)` y el `<!--vistazo-->`.
6. `node construir.mjs && node verificar.mjs` (el bloque 1 comprueba esta receta sobre copias en memoria).

## Lo que no se negocia (y su prueba en `verificar.mjs`)

Checklist de webs desde cero, para las piezas que lleva: menú móvil a 100dvh dentro de la cabecera con blur (9),
cookies con `:not([hidden])` (1 y 7), resize de la barra del móvil que no rehace nada (9), visor por NOMBRE (5),
recargar a media página vuelve arriba (12), titulares que aparecen observando el contenedor (12), portada sin pisarse a
360×640, 375×667, 390×844, 768×1024 y 1280×800 (2), contraste medido, también **sobre la foto** con su velo (2 y 3),
`con-movimiento` solo sin movimiento reducido (1), simulador marcado y sin enviar ni guardar nada (1 y 6), noindex y
enlaces en todas las páginas (1 y 10), nada desborda a 360 px (9). Sin cursor propio, sin pila sticky, sin
marquesina, sin cortina, sin letra a letra (1).

§5 bis: **fórmula rota** (fuera cortina, pila, marquesina, cursor, letra a letra y botones magnéticos; **pieza
propia**: el rótulo de latón detrás de la casa que viaja al logo); **gesto del hero** (deslizar el rótulo, con ratón y
con eventos táctiles reales en el bloque 12); **el objeto se completa en el pie** (el rótulo se escribe; con
movimiento reducido, ya escrito: 12); **foco con forma propia** (contorno de 2 px y cuatro tornillos en las esquinas,
`#foco-tornillos`: 3); **rendimiento medido** (abajo). Menú §5 bis: rótulo propio servido como trazado SVG.

## Rendimiento

**Medido el 2026-11-25** con el bloque 13 de `verificar.mjs` (412×915, DPR 2,625, 4G lento 1,6 Mb/s y 150 ms, CPU ×4,
caché desactivada, sin el 3D): **LCP 1,76–1,80 s** con y sin movimiento reducido; el elemento LCP es la portada (la capa
«agua» de 2000 px, que pinta a la vez que el monte). Presupuesto: LCP ≤ 2,5 s. INP sin medir.

La portada pesa en el móvil ~530 KB (monte 289 + agua 54 + casa 188, AVIF a 2000 px: el tamaño real de la foto; en el
móvil la escena mide 84vh de ancho) y en escritorio ~375 KB (las de 1500). Sin canvas ni librerías (ni GSAP ni Lenis):
un `scroll` pasivo con un rAF que solo escribe si cambia el progreso, y `transform` (escala y traslado) en cuatro
elementos. El 3D tiene su propio presupuesto (`LUGAR.md`) y no entra en el LCP (se monta a 900 px).

## Verificación y «no repetir»

`node verificar.mjs` (2026-11-25, con el módulo de Lugar 3D ya dentro): **135 comprobaciones en 13 bloques**. La pasada
entera dio 133 bien y 2 mal, las dos de la propia prueba (contaba como desborde la escena de la portada, que su marco
recorta, y exigía que el LCP fuera la capa «monte» cuando lo es la capa «agua», del mismo tamaño); corregidas, los
bloques 9 y 13 se repitieron: 8 de 8. Bloques: archivos y contrato (63), portada a los cinco tamaños (con el contraste
del titular medido sobre la foto), contraste y foco, la carta de colores, estancias y visor por nombre, el simulador,
cookies y mapa, mando de densidades, móvil, legales, el 3D (contenedor, respaldo y plan B 2D sin WebGL), una vez con
movimiento (capas que se separan, rótulo que llega al logo, gesto con ratón y con eventos táctiles reales, recarga,
titulares y el pie) y el LCP.

`node ../plantillas-negocios-web/scripts/repeticion.mjs la-casa-de-tanes-web` (2026-11-25): en las últimas diez webs
no domina ninguna pieza (marquesina 0/10; letra a letra, cursor, cortina y serif 1/10; crema con acento 2/10).
**La Casa de Tanes usa ninguna del kit** (fondo `#1F0F0A`, oscuro) → **repite 0 de las dominantes (tope 2)**.

## Qué mirar en Chrome

Servidor local (p. ej. `npx http-server -p 8951` en esta carpeta): `index.html` y `index.html?revision`. **Nadie ha
visto todavía el aspecto**: las pruebas miden comportamiento. La composición de la portada solo se ha visto en
`ref/portada/portada-escritorio.jpg` y `portada-movil.jpg` (compuestas con sharp, sin navegador).

1. **Portada**: que el rótulo se lea como «La Casa» aunque el tejado le tape el final («sa» en escritorio); que el
   latón no parezca pegatina (lleva un canto más oscuro); que la foto no se vea blanda (2000 px). Bajar despacio:
   las capas se separan y el rótulo vuela al logo; al llegar, ¿salta? Arrastrar en horizontal (ratón o dedo).
2. **Cabecera**: el logo aparece justo cuando llega el rótulo; al pasar la portada, fondo castaño con blur.
3. **Carta de colores**: que las seis tiras se lean como «cada una con su color» y no como un muestrario de pinturas;
   el texto oscuro sobre ocre y amarillo.
4. **Todo mira al sur**: filas de alturas iguales con fotos de proporciones distintas; «Las ventanas» más grandes.
5. **Redes alrededor**: el trayecto con sus paradas; la foto del arco iris pegada a la izquierda.
6. **Ver fechas**: elegir llegada y salida, días ocupados tachados, el punto de temporada alta.
7. **Pie**: el rótulo que se escribe trazo a trazo.
8. El **foco del teclado** (Tab): el contorno con los cuatro tornillos.
9. `?revision` → **Sobria**: la tabla «La casa, de un vistazo».
