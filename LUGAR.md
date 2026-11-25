# Lugar 3D · «El espejo de Tanes»

Módulo `lugar` de la sección `#lugar` (agente Lugar 3D, 2026-11-25). Ficheros: `js/lugar.js`, `css/lugar.css`,
`img/lugar/`, `vendor/three-0.160.0.module.min.js`, `scripts/lugar-*`, `ref/raw/lugar-cache/` (caché de descargas,
no viaja a la web).

**Nadie lo ha visto pintado todavía.** El 3D no se prueba con Playwright (reglas del PC); lo tiene que mirar Álvaro
en su Chrome (ver «Qué mirar»). Lo que sí está comprobado, abajo en «Pruebas».

## Qué hace

Un vuelo en 3D que avanza con el scroll (sección fijada con `position: sticky`, sin GSAP), de las peñas al agua:

| Scroll | Cámara | Parada | Rótulos |
|---|---|---|---|
| 0 – 30 % | sobre las peñas del otro lado del embalse, ~3,3 km al suroeste de la casa y a 1.650 m, mirando al noreste: el valle, el embalse serpenteando y Tanes en la orilla de enfrente | Las peñas | Embalse de Tanes, Tanes, peñas con nombre de OSM (Pico Tejeira o Busllar, Pico de Trapa o Muezca, Piquero, Cuyargayos), Presa de Tanes si entra en cuadro |
| 30 – 58 % | baja por la ladera, siempre a más de ~90 m del monte | La ladera | |
| 58 – 86 % | llega al agua: de ~880 m a rozar la lámina (5 m), ya mirando a la casa | El embalse | La Casa aparece al 25 % |
| 86 – 100 % | queda quieta a ~2 m sobre el agua, a ~230 m de la casa, frente a la galería; las montañas de detrás de Tanes se repiten en el agua | La Casa | La Casa |

Abajo, las cuatro paradas («Las peñas», «La ladera», «El embalse», «La Casa»); la actual se marca en `--marca`.
Rótulos sin distancias (las pone Web en «Redes alrededor», de OSRM).

- **Relieve**: MDT05 del IGN en todo el embalse (de la presa a la cola, 8,1 × 6,7 km) con una rejilla que se aprieta
  en el pueblo (4 m) y se abre lejos (10, 24 y 60 m); anillo lejano con MDT25 (42 × 33 km, celdas de ~225 m) para el
  horizonte de Redes. **A escala real, sin exagerar.**
- **Ortofoto PNOA** encima: ~2,6 m/px en todo el valle (4 m/px en móvil), 0,31 m/px en el pueblo (640 m; 0,62 en
  móvil), ~20 m/px en el anillo lejano (teselas de zoom 12, de otro sensor: se igualan las ganancias por canal con
  la cercana y se baja la saturación, porque el brezo salía morado).
- **El agua**: la lámina está a **490 m**, la cota del agua en el MDT05 (el embalse plano del día del vuelo LiDAR;
  cambia con las estaciones). Dónde hay agua sale del propio MDT (la zona ≤ 490,5 m conectada con el agua frente a
  Tanes; deja fuera el Nalón bajo la presa) y se guarda en `agua.png` (distancia a la orilla + máscara).
  **El reflejo**: cada fotograma se pinta antes la escena desde una cámara espejada bajo la lámina, a media
  resolución (0,5 × DPR en escritorio, 0,4 en móvil; baja a 0,35 y 0,25 si va justo), con un plano de recorte para
  que no salga lo de debajo del agua. El agua lee esa textura con un rizado suave (tres trenes de ondas cortas +
  ruido que deriva, que se apaga con la distancia), Fresnel (más espejo cuanto más rasante) y el brillo del sol o
  de la luna. Es el método del `Reflector` de Three.js, escrito a mano y sin plano oblicuo: una pasada más, nada de
  `transmission`, SSR ni cubemaps.
- **La casona** (Tanes 9): la dirección «LG TANES 9» del Catastro (INSPIRE Addresses) cae en la parcela
  `0006082UN08F`, y su edificio `000608200UN08F` es la casona de las fotos (lo confirma la ortofoto: tejado a cuatro
  aguas, jardín al suroeste, camino al este). Muros de arenisca sobre el **núcleo de tres plantas** del Catastro
  (13,6 × 7,3 m), esquinas de sillería más clara, tejado a cuatro aguas de teja vieja con alero ancho, dos chimeneas
  con sombrerete, la **galería de madera** en la mitad noroeste de la fachada larga que mira al **suroeste, al agua**
  (calculado: la fachada con el agua más cerca), con su cierre de tablas, la banda acristalada con montantes y la
  cornisa; la puerta en arco con «La Casa» en latón encima (en la letra `--letra-script` de Web) y ventanas.
  **De noche** la galería entera se enciende (vidrio con emisión cálida + halo dibujado) y unas cuantas ventanas.
- **El pueblo**: los 116 edificios del Catastro a menos de 300 m, con su planta y su número de plantas (muros de
  piedra, blancos u ocres, tejado de teja), y 1.165 árboles detectados en la ortofoto de detalle.
- **El cielo de ahora** en Tanes: sol y luna en su posición real (fórmulas de SunCalc, en el navegador), color del
  cielo y de la luz según la altura del sol, sombras de la casa y del pueblo (mapa de sombras de 300 m, recalculado
  solo cuando cambia el sol). Como es un valle hondo, el sol se esconde tras las peñas antes que en el llano: eso lo
  hacen las sombras del relieve solas. De noche: estrellas, la luna con su fase y su reflejo, ventanas y galería
  encendidas. Texto «Ahora en Tanes son las…» (cada minuto).

### Plan B (en el mismo hueco)

Sin WebGL, con movimiento reducido, en densidad «sobria», con ahorro de datos, en el móvil antes de pulsar el botón y
en navegadores automatizados (Playwright): **la vista desde el agua dibujada** con los mismos datos (relieve +
ortofoto + edificios del Catastro como bloques, render por columnas en Python **con el reflejo de las montañas**:
la misma vista desde la cámara espejada, volteada y mezclada con Fresnel y un rizado leve) con sus marcas, **Tanes
desde el aire** (ortofoto con La Casa marcada con un anillo), las cuatro paradas y el cielo de ahora. De noche, las
dos imágenes se oscurecen y la marca de la casa brilla. Si el JS falla del todo, sigue el respaldo HTML de Web.

### Cuándo sale cada cosa

| Caso | Qué se ve |
|---|---|
| Escritorio con WebGL | el 3D se carga al montar (Web monta a ~900 px); mientras, el póster (la vista desde las peñas dibujada, el mismo encuadre que el arranque) |
| Móvil (≤ 820 px o puntero grueso) o ahorro de datos | plan B + botón **«Ver el vuelo en 3D»** |
| `prefers-reduced-motion`, `movimiento: false`, `densidad: 'sobria'`, sin WebGL, `?sin-webgl` | plan B, sin botón |
| `navigator.webdriver` (Playwright) | plan B siempre; `?lugar=3d` lo fuerza (no usarlo en pruebas con WebGL de verdad) |
| En 3D | botón «Ver en plano» abajo a la derecha |
| Si falla la carga o se pierde el contexto WebGL | vuelve solo al plan B |

## Para Web

1. **HTML** (en `index.src.html`, dentro de `#lugar`; el contenido del div es tu respaldo y se repone al destruir):

``html
<section id="lugar" aria-labelledby="lugar-titulo">
  <!-- tu título y entradilla -->
  <div data-modulo="lugar">
    <!-- RESPALDO: foto 45 (el reflejo) + texto -->
  </div>
</section>
``

2. **CSS y JS** en el `<head>` (con tu `?v=` de `versionar.mjs`):

``html
<link rel="stylesheet" href="css/lugar.css">
<script src="js/lugar.js" defer></script>
``

   **Three.js no lo cargas tú**: `lugar.js` lo pide con `import()` a `vendor/three-0.160.0.module.min.js` (copia
   propia de Three.js r160, MIT, la misma de Amaicha) solo cuando hace falta. Sin import map, sin CDN.

3. **Montar** desde `main.js`: `Tanes.lugar.montar(el, { movimiento, densidad, webgl })`. `webgl: false` fuerza el
   plan B; si no lo pasas, lo detecta él. Devuelve `{ destruir(), estado(), ver3d(), verPlano() }`.

4. **Sticky**: el escenario va con `position: sticky`. Ningún antepasado de `[data-modulo="lugar"]` puede llevar
   `overflow: hidden|auto|clip` ni `transform`/`filter`. Si hay **cabecera fija**, pon su alto en `--lugar-arriba`
   (p. ej. `#lugar { --lugar-arriba: 64px; }`). Para que luzca, el div a **todo el ancho** (sin el `max-width` del
   texto); al plan B dale `padding` lateral cuando `[data-modo="plano"]`.

5. **Variables que lee**: `--fondo`, `--superficie`, `--texto`, `--texto-suave`, `--marca`, `--acento`, `--agua`,
   `--linea`, `--letra-titular`, `--letra-texto`, `--letra-script` (rótulo de La Casa y el latón de la fachada en
   3D), `--letra-cifras`. No define colores de página.

6. **`verificar.mjs`**: el módulo no pinta WebGL bajo Playwright (mira `navigator.webdriver`); aun así, arranca
   Chromium con `--disable-3d-apis`. Comprueba solo: `[data-modulo="lugar"][data-montado="1"]`,
   `[data-modo="plano"]`, que `.lugar__vista img` y `.lugar__pueblo img` cargan y que hay `.lugar__marca` visibles.
   Mi prueba propia: `node scripts/lugar-prueba.mjs` (ver abajo).

7. **Créditos**: el pie del módulo ya cita «© IGN / CNIG, CC BY 4.0», Catastro y OSM. Si el aviso legal o una página
   de créditos lista fuentes, añade esas tres.

8. **Peso**: con `defer` y la carga diferida, nada de esto entra en el LCP. El 3D baja **~3,0 MB en escritorio**
   (Three.js 655 KB incluido; la ortofoto del valle de 3072 px es 1,25 MB) y **~2,0 MB en móvil** al pulsar el
   botón (texturas de 2048/1024); el plan B, **~230 KB** (vista de 960 px, plano del pueblo y `lugar.json`). Todo
   `img/lugar/`: 3,4 MB. `lugar.js` 78 KB y `lugar.css` 12 KB, sin minificar.

## Datos (cómo se hicieron)

``
python -I -X utf8 scripts/lugar-osm.py     # lugares y embalse de OSM (Overpass con espejos) → ref/raw/lugar-cache/osm-tanes.json
python -I -X utf8 scripts/lugar-datos.py   # descargas (en caché), agua, alturas, ortofotos, Catastro, árboles, plan B, lugar.json
node scripts/lugar-prueba.mjs              # comprobaciones (ver «Pruebas»); --sin-navegador: solo las de Node
``

Todas las peticiones llevan el User-Agent genérico `datos-mapa-script/1.0 (uso puntual)`, sin datos personales.

| Fuente | Servicio | Uso |
|---|---|---|
| MDT05 IGN | WCS `servicios.idee.es/wcs-inspire/mdt`, `Elevacion4258_5` | relieve del valle (nativo ~3,6 × 5 m) → rejillas de 4, 8 y 20 m; la cota y la forma del agua |
| MDT25 IGN | mismo WCS, `Elevacion4258_25` | anillo lejano (mezcla de media y máximo para no aplanar cumbres) |
| PNOA | WMS `www.ign.es/wms-inspire/pnoa-ma` (valle, 4 teselas); **WMTS** `www.ign.es/wmts/pnoa-ma` zoom 19 (pueblo) y zoom 12 (anillo lejano: el WMS da 502 a esa escala) | color del suelo |
| Catastro INSPIRE | `wfsAD.aspx` (dirección LG TANES 9), `wfsBU.aspx` (`BU:Building`, `BU:BuildingPart` con plantas) | la casona y el pueblo |
| OSM | Overpass (UA genérico; con UA de navegador da 406) | nombres: Tañes (`place=hamlet`), Embalse de Tanes (`water=reservoir`), Presa de Tanes (`waterway=dam`), peñas (`natural=peak` con nombre, > 900 m, a < 4,5 km, separadas > 1,1 km) |
| Sol y luna | fórmulas de SunCalc (V. Agafonkin), en el navegador | luz, cielo, astros, noche |

Alturas en PNG RGB: `(R·256 + G) / 10 − 100` m. Coordenadas locales en metros desde el punto de la dirección del
Catastro (43,205389, −5,399521; x al este, z al sur, y = altura sobre el mar).

### Comprobaciones hechas (y lo que no es como se suponía)

- **La casa no está en OSM** (ni como nodo ni con número). Se ha usado el **Catastro**: `Consulta_DNPLOC` con
  calle «TANES» número 9 dice «el número no existe», pero el servicio INSPIRE de direcciones tiene «LG TANES 9»
  (código postal 33994, el de la ficha) en la parcela `0006082UN08F`. Su edificio es el de las fotos.
- **El rótulo dice «Tanes»** (nombre oficial y del negocio; el Catastro dice «LG TANES»); en OSM el pueblo es «Tañes»
  (asturiano).
- **El agua a 490 m** es la del MDT, no la de embalse lleno: en la foto 11 se ven las orillas peladas, así que el
  día del vuelo estaba bajo. Si se quiere el embalse lleno habría que subir la lámina (`NIVEL`) y rehacer: hoy no se
  inventa.
- **Planta de la casona**: el edificio del Catastro tiene 19 partes; el núcleo de tres plantas mide 13,6 × 7,3 m y lo
  rodean tiras de ~1 m de dos plantas a lo largo de las dos fachadas largas (probablemente voladizos o el alero; no
  se sabe). Los muros van sobre el núcleo y el alero de 0,9 m tapa las tiras. **Supuesto razonado.**
- **La galería**: en la fachada larga que mira al suroeste (222°), donde el agua está más cerca (90 m), en su mitad
  noroeste, a la altura de la primera planta, de 0,7 m de vuelo; la puerta en arco y «La Casa», en la otra mitad.
  Sale de las fotos 01 y 10; **las medidas de la galería, las ventanas y las chimeneas están puestas a ojo**.
- Peñas con nombre: solo las que tienen `natural=peak` y nombre en OSM. El rótulo pone la altura de OSM (`ele`)
  cuando la hay; «Pico de Trapa o Muezca» no la tiene y va sin cifra.

## Pruebas

`node scripts/lugar-prueba.mjs` (servidor propio en el 8952, un solo Chromium **con WebGL desactivado**, ventanas
de 1280×800 y 390×844, escala 1; se cierra al acabar). Última pasada: **85 bien, 0 mal**. Comprueba:

1. **Node**: sol en Tanes (solsticios a mediodía: 70,2° y 23,4°, al sur), luna, la frase del cielo; el recorrido no
   se pasa de sus puntos ni da saltos (1,4 m máx. por 1/4000 de scroll), nunca baja de 2,2 m sobre el agua y acaba
   a 230 m de la casa.
2. **Datos**: todos los ficheros existen y no sobra ninguno; pesos; la casa es `000608200UN08F`; la galería mira
   al 221,5°; todos los rótulos caen dentro del relieve; las peñas vienen de OSM; 117 edificios, 1.165 árboles.
3. **Plan B sin WebGL** (escritorio y móvil): no hay lienzo ni pista; se ven la vista y el plano con sus marcas
   (Tanes · Embalse de Tanes · Piquero · La Casa; La Casa en el plano); cuatro paradas, el cielo de ahora y la cita
   del IGN; sin botón 3D (no hay WebGL); sin scroll horizontal; alturas PNG bien decodificadas en canvas (casa a
   511,4 m, fondo del agua bajo la cámara final, cumbres lejanas hasta 1.991 m); **holgura de la cámara sobre el
   relieve o el agua en todo el recorrido** ≥ 2,2 m; `destruir()` repone el respaldo; sin errores.
4. **Botón del móvil**: en 390×844 táctil con el 3D posible sale el plan B con «Ver el vuelo en 3D» y no se carga
   nada; al pulsarlo monta el 3D. **Escena con un `WebGLRenderer` falso** (Three.js real, no pinta nada): se
   monta sin NaN (~615.000 triángulos, 305 objetos, 1.357 ventanas, 1.165 árboles); cada fotograma pinta antes el
   reflejo con la cámara bajo el agua y el plano de recorte; las cuatro paradas y los rótulos por tramo (p=0: Pico
   Tejeira o Busllar · Piquero · Pico de Trapa o Muezca; p=0,35: Tanes · Embalse · Pico Tejeira · La Casa; p=0,65:
   Tanes · Embalse · La Casa; p≈1: La Casa, cámara a 492 m, `near` 0,66); fuera de pantalla no pinta; «Ver en
   plano» vuelve; `destruir()` libera el renderizador y quita el lienzo; sin errores.

**No comprobado**: nada se ha pintado con WebGL (ni shaders compilados, ni el reflejo visto, ni fps). El plan B y el
póster son imágenes que sí he mirado.

## Rendimiento

Sin `transmission`, sin `RectAreaLight`, sin bloom (halos dibujados con sprites aditivos), colores en sRGB (`'#hex'`),
DPR ≤ 1,5 (1,25 en móvil) con bajada automática (DPR 1 y reflejo más pequeño; luego sin sombras y DPR 0,8 si los
fotogramas pasan de 30 ms), sombras PCF solo en 300 m alrededor de la casa y recalculadas solo cuando cambia el sol,
bucle que pinta solo si hay cambio (el agua se riza y se repinta mientras se ve de cerca, del 45 % del recorrido
en adelante), pausa fuera de pantalla. **El reflejo cuesta una segunda pasada de la escena a media resolución**: es
lo más caro de este módulo; si va justo, lo primero es bajarlo (`escalaReflejo` en `lugar.js`).
La prueba con el renderizador falso **no compila los shaders**: un error de GLSL solo se vería en Chrome, en la
consola (`THREE.WebGLProgram: Shader Error`), con el agua, el cielo o el suelo en negro o sin pintar.

## Qué mirar (Álvaro, en su Chrome)

Servidor local, en la carpeta de la web: `python -m http.server 8952` (o el de Web en el 8951) y abrir
`http://localhost:8952/scripts/lugar-prueba.html` (página de prueba solo del módulo) o la página de Web.

1. Abrir con **`?fps`**: arriba a la derecha salen fps, calidad, DPR, tamaño del reflejo y altura de la cámara. Si la
   calidad baja a 1 o 2 sola, va justo; decirlo.
2. **El reflejo**: que las montañas se repitan en el agua al bajar, que no salga nada «de debajo» del agua (un
   borde raro en la orilla) y que el rizado no maree. Si el reflejo sale desplazado o al revés, avisar (se
   escribió a mano).
3. Recorrer el scroll entero despacio y deprisa: que no haya saltos, que el arranque coincida con el póster y que
   al final la galería se lea de frente.
4. **Etiquetas**: que caigan en su sitio y no se monten.
5. **De noche** (o `?hora=22:30`): galería y ventanas encendidas, luna, estrellas, su reflejo.
6. **Móvil real**: el botón «Ver el vuelo en 3D», que el scroll no se trabe y que el escenario no salte al
   esconderse la barra del navegador.
7. Si va a menos de 5 fps: Chrome sin aceleración por hardware (`chrome://settings/system`).

## Pendiente

- Que Álvaro lo vea pintado (nadie lo ha visto).
- Confirmar con la casa: la galería (medidas, cuántos paños), las ventanas y las chimeneas están a ojo; qué son las
  tiras de dos plantas del Catastro.
- El nivel del agua es el del día del vuelo LiDAR (490 m). Decidir si se deja así (real) o se sube a embalse lleno.
