/* Genera los *.src.html de las páginas legales y el 404 con una plantilla común (receta de Amaicha y Casa Benito).
   Uso: node scripts/legales.mjs  (después, node construir.mjs)
   Titular: NO consta en ninguna fuente (ref/DATOS-TANES.md): «por confirmar» y a PENDIENTES.md. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const D = JSON.parse(fs.readFileSync(path.join(RAIZ, 'data/tanes.json'), 'utf8'));
const R = JSON.parse(fs.readFileSync(path.join(RAIZ, 'marca/rotulo.json'), 'utf8'));
const C = D.contacto;
const TEL = `<a href="tel:${C.telefono}">${C.telefonoTexto}</a>`;
const ROTULO = `<svg class="legal-marca__rotulo" viewBox="${R.viewBox}" aria-hidden="true" focusable="false"><path fill="currentColor" d="${R.glifos.map((g) => g.d).join('')}"/></svg>`;

const TITULAR = `<dl>
  <dt>Titular</dt><dd><span class="aviso-corto">por confirmar</span></dd>
  <dt>NIF</dt><dd><span class="aviso-corto">por confirmar</span></dd>
  <dt>Domicilio</dt><dd>${D.titular.domicilio}</dd>
  <dt>Nombre comercial</dt><dd>La Casa de Tanes (estudios y apartamentos boutique)</dd>
  <dt>Teléfono</dt><dd>${TEL}</dd>
  <dt>Correo</dt><dd><span class="aviso-corto">por confirmar</span></dd>
  <dt>Registro de turismo</dt><dd>${D.registro} (apartamentos turísticos, Principado de Asturias)</dd>
</dl>
<p class="aviso">PENDIENTE: confirmar con La Casa de Tanes el titular, su NIF y un correo de contacto. Esta web es una propuesta que nadie ha encargado todavía.</p>`;

const paginas = {
  'aviso-legal': {
    titulo: 'Aviso legal',
    cuerpo: `
<p>En cumplimiento del artículo 10 de la Ley 34/2002, de Servicios de la Sociedad de la Información y de Comercio Electrónico (LSSI-CE), estos son los datos del titular de esta web:</p>
${TITULAR}
<h2>Uso de la web</h2>
<p>Esta web informa sobre La Casa de Tanes, estudios y apartamentos turísticos en Tanes (Caso, Asturias). Los precios, la disponibilidad y las condiciones de cada reserva son los que dé la casa al reservar.</p>
<p>El calendario de «Ver fechas» es un <b>simulador</b>: los días ocupados y los precios son supuestos, no reserva nada y no envía ni guarda ningún dato.</p>
<h2>Propiedad intelectual</h2>
<p>Los textos y las fotografías de la casa son del titular o se usan con su permiso. El rótulo «La Casa» se dibuja con la letra Imperial Script; el resto de letras son Sofia Sans Condensed, Ubuntu Sans y Google Sans Code. Todas se usan con su licencia libre (SIL Open Font License).</p>
<p>Las distancias y los tiempos de «Redes alrededor» se han calculado con OSRM (router.project-osrm.org y routing.openstreetmap.de) sobre datos de OpenStreetMap: © colaboradores de OpenStreetMap, con licencia ODbL (<a href="https://www.openstreetmap.org/copyright">openstreetmap.org/copyright</a>). La situación de la casa es la de su parcela en la Dirección General del Catastro.</p>
<p>La lámina de «Redes alrededor» dibuja el relieve con los modelos digitales del terreno MDT05, MDT25 y MDT200 del Instituto Geográfico Nacional (CC BY 4.0, «© Instituto Geográfico Nacional»), y los embalses, los ríos, las carreteras, los pueblos y el límite del Parque Natural de Redes con datos de OpenStreetMap (© colaboradores de OpenStreetMap, ODbL). Los caminos de cada sitio son las rutas de OSRM.</p>
<p>La sección «El espejo de Tanes» usa el relieve (MDT) y la ortofoto (PNOA) del Instituto Geográfico Nacional (CC BY 4.0, «© Instituto Geográfico Nacional»), la cartografía de la Dirección General del Catastro y datos de OpenStreetMap (© colaboradores de OpenStreetMap, ODbL). La escena se dibuja con Three.js (licencia MIT), que va con esta misma web.</p>
<p class="aviso">PENDIENTE: confirmar que todas las fotos son de la casa y se pueden usar (vienen de sus fichas de alojamiento).</p>
<h2>Responsabilidad</h2>
<p>Los enlaces a otras webs (Booking, Google Maps y su ficha de Google) llevan a servicios de terceros con sus propias condiciones.</p>
<h2>Ley aplicable</h2>
<p>Estas condiciones se rigen por la ley española.</p>`,
  },
  privacidad: {
    titulo: 'Política de privacidad',
    cuerpo: `
<h2>Responsable</h2>
${TITULAR}
<h2>Qué datos tratamos y para qué</h2>
<p>Esta web no tiene formularios: no recoge nombres, teléfonos ni correos. Si llamas a la casa o reservas, los datos que des (nombre, teléfono, las fechas y cuántos sois) se usan para gestionar tu estancia y atenderte.</p>
<p>Al alojarte, la ley obliga a registrar los datos de los viajeros y comunicarlos a las autoridades (Real Decreto 933/2021).</p>
<h2>El simulador de fechas</h2>
<p>El calendario de «Ver fechas» funciona solo en tu navegador: no envía ni guarda las fechas ni las personas que elijas.</p>
<h2>Base legal y plazos</h2>
<p>La base es la ejecución de la reserva y, para el registro de viajeros, una obligación legal. Los datos se conservan mientras dura la relación y, después, el tiempo que exige la ley.</p>
<h2>Con quién se comparten</h2>
<p>Con nadie, salvo las plataformas por las que reserves (Booking o Airbnb, con sus propias políticas) y las obligaciones legales (el registro de viajeros), siempre con lo imprescindible.</p>
<h2>Tus derechos</h2>
<p>Puedes pedir el acceso, la rectificación, la supresión, la oposición, la limitación o la portabilidad de tus datos llamando al ${TEL}. Si crees que no se han respetado, puedes reclamar ante la Agencia Española de Protección de Datos (<a href="https://www.aepd.es">aepd.es</a>).</p>
<h2>Lo que guarda esta web en tu navegador</h2>
<p>Una sola cosa: <code>tanes-cookies</code> en el almacenamiento local, para recordar que ya has visto el aviso de cookies. Más detalles en <a href="cookies.html">cookies</a>.</p>`,
  },
  cookies: {
    titulo: 'Política de cookies',
    cuerpo: `
<p>Esta web no usa cookies propias de análisis ni de publicidad.</p>
<h2>Lo que se guarda en tu navegador</h2>
<ul>
  <li><b>tanes-cookies</b> (almacenamiento local): recuerda que has visto el aviso, para no enseñártelo en cada visita. Es técnica y no caduca sola; puedes borrarla desde tu navegador.</li>
</ul>
<h2>Servicios de terceros</h2>
<ul>
  <li><b>Google Fonts</b>: las letras de la web se cargan desde los servidores de Google, que reciben tu dirección IP.</li>
  <li><b>Google Maps</b>: el mapa de «Cómo llegar» solo se carga si pulsas «Ver el mapa». A partir de ese momento, Google puede instalar sus cookies.</li>
  <li><b>Booking y Google</b>: los enlaces a sus fichas abren sus webs, con sus propias cookies.</li>
</ul>
<h2>El rótulo y el lugar en 3D</h2>
<p>El rótulo de la portada y el lugar en 3D se dibujan en tu navegador con archivos que van con esta misma web: no instalan cookies.</p>
<p class="aviso">PENDIENTE (Lugar 3D): si la escena 3D llega a pedir algo a un servicio de fuera, se añade aquí.</p>
<p>Puedes volver a ver el aviso desde «Preferencias de cookies», en el pie de la página.</p>`,
  },
  accesibilidad: {
    titulo: 'Declaración de accesibilidad',
    cuerpo: `
<p>El titular se compromete a que esta web sea accesible conforme a la norma UNE-EN 301 549 (nivel AA de las WCAG 2.1).</p>
<h2>Situación de cumplimiento</h2>
<p class="aviso">PENDIENTE: completar tras la revisión de accesibilidad previa a la publicación.</p>
<p>La web se ha construido para poder usarse entera con el teclado y con lector de pantalla: contrastes de al menos 4,5:1 en el texto, foco visible, textos alternativos en las fotos, botones con nombre y animaciones que se quitan si tu sistema pide reducir el movimiento. El rótulo de la portada y el lugar en 3D son un adorno: la información está también en el texto.</p>
<h2>Contenido de terceros</h2>
<p>El mapa de Google se carga dentro de la página pero no depende de esta web: su accesibilidad es la de su servicio.</p>
<h2>Contacto</h2>
<p>Si encuentras una barrera, llama al ${TEL}. Te daremos la información en un formato accesible.</p>`,
  },
};

const FUENTES = 'https://fonts.googleapis.com/css2?family=Sofia+Sans+Condensed:wght@300..600&family=Ubuntu+Sans:wdth,wght@75..100,300..700&display=swap';
const cabeza = (titulo) => `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="robots" content="noindex, nofollow">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${titulo} · La Casa de Tanes</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${FUENTES}">
<link rel="stylesheet" href="css/base.css">
<link rel="stylesheet" href="css/legal.css">
<link rel="icon" href="marca/favicon.svg" type="image/svg+xml">
<link rel="icon" href="marca/favicon-32.png" sizes="32x32" type="image/png">
</head>`;
const MARCA = `<a class="legal-marca" href="./" aria-label="La Casa de Tanes, a la portada">${ROTULO}<span class="legal-marca__de" aria-hidden="true">de Tanes</span></a>`;

for (const [nombre, p] of Object.entries(paginas)) {
  const html = `${cabeza(p.titulo)}
<body>
<header class="legal-cab">
  <div class="env">
    ${MARCA}
    <a class="volver" href="./">Volver a la portada</a>
  </div>
</header>
<main class="legal">
  <div class="env">
    <h1>${p.titulo}</h1>
${p.cuerpo}
  </div>
</main>
<footer class="legal-pie">
  <div class="env">
    <a href="aviso-legal.html">Aviso legal</a>
    <a href="privacidad.html">Privacidad</a>
    <a href="cookies.html">Cookies</a>
    <a href="accesibilidad.html">Accesibilidad</a>
  </div>
</footer>
</body>
</html>
`;
  fs.writeFileSync(path.join(RAIZ, `${nombre}.src.html`), html);
  console.log(`${nombre}.src.html`);
}

fs.writeFileSync(path.join(RAIZ, '404.src.html'), `${cabeza('Página no encontrada')}
<body class="no-hay">
  <main class="no">
    <a class="no__rotulo" href="./" aria-label="La Casa de Tanes, a la portada">${ROTULO}</a>
    <h1>Esta puerta no da a ninguna estancia</h1>
    <p>La página que buscas no existe o ha cambiado de sitio. La casa sigue donde estaba: en Tanes, sobre el embalse.</p>
    <p class="no__acc"><a class="btn btn--acento" href="./#reservar">Ver fechas</a><a class="btn btn--linea" href="./">Volver a la portada</a></p>
  </main>
</body>
</html>
`);
console.log('404.src.html');
