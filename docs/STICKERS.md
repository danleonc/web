# Stickers en La Plaza, salas y chat individual

Requisito confirmado por el usuario el 19 de octubre de 2026: las personas también se expresan con stickers; deben estar disponibles en salas y chats privados, con un catálogo amplio y variado. Se registra como **R33**, prioridad de la comunicación del producto. La Plaza y el chat individual siguen siendo locales; las salas compartidas admiten stickers con validación del servidor en los modos de desarrollo y piloto. La demo pública es estática.

## Implementado

- **60 stickers / diez colecciones**: Moka, Pipo, Tuerca, Órbita, Lila, Gota, Michi Rosa, Nico, Flama y Babú. Seis expresiones por personaje, sin rótulos. Por solicitud del usuario se retiraron los 144 stickers anteriores.
- Ilustraciones WebP transparentes de 320 × 320, sin rótulos. No son caracteres emoji enviados como texto.
- Selector común a La Plaza, salas y chat individual: personajes/colecciones, búsqueda por expresión sin exigir acentos, colecciones favoritas, favoritos manuales y por frecuencia, los 24 más recientes y vista previa con confirmación.
- Los mensajes identifican el sticker por un ID del catálogo. Nunca se acepta una URL arbitraria como contenido de sticker.
- Etiquetas accesibles, teclado, Escape y foco de retorno. No hay animaciones ni sonidos automáticos.
- Texto en borrador conservado al enviar stickers; el envío no exige adjuntar texto.
- Favoritos, recientes, frecuencia de uso y colecciones elegidas se guardan solo en el navegador, se comparten entre las vistas, se incluyen en la exportación JSON y se borran con el reinicio del prototipo.
- Compatibilidad con perfiles guardados antes de esta función: los nuevos campos se inicializan vacíos, conservando el perfil y las reservas. IDs desconocidos de preferencias se descartan.
- El chat individual se abre desde **Mis conexiones → Probar chat privado**. Es una demostración separada de las solicitudes de reencuentro; no simula que otra persona haya aceptado contacto.
- Mensajes de salas locales y chat individual de prueba quedan en memoria. Los comentarios de La Plaza se conservan localmente. El piloto con cuentas conserva historial en servidor según `CUENTAS_Y_DESPLIEGUE.md`; no confundirlo con la demo estática.

## Catálogo y ampliación

La fuente editorial es `src/chat/sticker-packs.json`. Cada colección tiene un ID, nombre, palabras de búsqueda, motivo, color, formato WebP y seis expresiones con posiciones estables. Los recursos publicados se versionan en `public/stickers/`. El generador SVG anterior fue retirado junto con sus archivos; el procedimiento de extracción de las ilustraciones se describe al final.

Los IDs actuales son `<colección>-<posición>`. Para conservar favoritos y referencias, **no reordenar ni reutilizar posiciones publicadas**. Nuevas colecciones o expresiones deben añadir IDs estables; si un recurso se retira, el receptor debe admitir un estado de sticker no disponible. El objetivo es variedad útil y calidad, sin inflar el número mediante duplicados indistinguibles.

Las expresiones incluyen saludos, risa, afecto, sorpresa, descanso y agobio. Enviar afecto no supone consentimiento ni prueba atracción. La IA no recibe ni deduce preferencias personales a partir del uso de stickers.

## Contrato de mensajería compartida y ampliaciones

- Mensaje discriminado: texto, sticker o imagen. Para sticker, `sticker_id`, versión de catálogo, emisor, conversación y timestamps generados/controlados por servidor.
- Validar ID vigente, pertenencia a la conversación, consentimiento de contacto y bloqueos en **cada envío**, exactamente como con texto. Un sticker no puede eludirlos.
- Controles de tasa, deduplicación, moderación y denuncia aplicables a todos los tipos. Spam con stickers también es abuso.
- Distribución de assets propios/cacheables, sin búsquedas de proveedores externos que reciban términos o actividad privada sin consentimiento/base aplicable.
- Política editorial y licencias por colección. La carga de packs de usuarios y GIFs animados queda fuera de este cambio; requeriría validación de archivos, tratamiento de SVG activo, derechos, moderación y límites de recursos.
- Preservar bloqueo inmediato, accesibilidad y movimiento reducido si se añaden animaciones. No introducir personalización de terceros ni lectura del historial como requisito para encontrar un sticker.

## Criterios de aceptación

1. Catálogo completo accesible en ambas vistas; categoría y búsqueda reducen resultados correctamente.
2. Seleccionar no envía hasta confirmar; un envío aparece una vez como imagen con descripción textual accesible.
3. Se mantiene el borrador de texto; favoritos/recientes pasan entre vistas y sobreviven recarga sin guardar mensajes privados.
4. Cerrar el selector devuelve el foco al botón que lo abrió. En el chat individual, Escape cierra primero el selector y conserva el diálogo de conversación.
5. Migración, exportación y borrado no pierden datos existentes ni dejan preferencias después del reinicio.
6. Los recursos se sirven también bajo la ruta `/web/` de GitHub Pages sin llamadas a bibliotecas externas.

La IA avanzada, los packs de terceros y la mensajería de producción siguen pendientes de sus respectivos requisitos; esta función no acredita seguridad o privacidad de un servicio con usuarios reales.

## Verificación de la entrega inicial · 19 de octubre de 2026

- Compilación TypeScript/Vite correcta.
- **22 pruebas aprobadas** en Chromium de escritorio y móvil: las 16 anteriores y seis ejecuciones nuevas de catálogo, selección, envío, borrador, favoritos, recientes, chat individual, diálogos anidados, exportación, borrado y accesibilidad automática.
- Compilación servida bajo `/web/`: envío en sala y chat individual verificado y **144/144 SVG** con respuesta correcta y tipo `image/svg+xml`.
- Los 144 archivos son XML SVG válidos y no contienen scripts, imágenes externas ni HTML incrustado.
- Estas comprobaciones validan el prototipo, no un servicio de mensajería entre personas reales ni un cumplimiento integral de accesibilidad.

## Actualización · 26 de octubre de 2026 · Personajes y La Plaza

- Se añaden **60 ilustraciones transparentes WebP**, seis expresiones para cada uno de diez personajes inspirados en la referencia artística proporcionada por el usuario: Moka, Pipo, Tuerca, Órbita, Lila, Gota, Michi Rosa, Nico, Flama y Babú. No llevan frases ni rótulos. Se conservan los 144 SVG clásicos y sus IDs: **204 stickers / 22 colecciones**. Los nuevos IDs son estables y el servidor los valida a partir del mismo catálogo.
- Las ilustraciones se generaron con la herramienta de imágenes de OpenAI a partir de la referencia del usuario y fueron revisadas visualmente. Se distribuyen como recursos locales, sin un proveedor externo de stickers ni envío de búsquedas a terceros. No se presume exclusividad o verificación de derechos sobre la referencia aportada.
- Selector con carrusel de personajes, ilustraciones sin etiquetas superpuestas, búsqueda, vista previa y confirmación. Marcar una colección la lleva al comienzo del carrusel. Si no hay favoritos individuales, la primera colección guardada se abre por defecto.
- «Favoritos» es la primera división: reúne primero las estrellas manuales y después hasta doce stickers usados, ordenados por número de envíos; el desempate usa los 24 recientes y el ID estable. Se abre por defecto una vez que hay favoritos o uso. Quitar una estrella elimina la prioridad manual; un sticker usado puede seguir apareciendo por frecuencia, explicado en la interfaz.
- Frecuencia y colecciones favoritas se guardan solo en este navegador con las preferencias existentes; se exportan y se borran al reiniciar. Se descartan IDs desconocidos y conteos inválidos, sin borrar perfiles anteriores. No se analizan mensajes ni se sincronizan hábitos con el servidor.
- **La Plaza permite respuestas con stickers** desde el mismo selector. Seleccionar no publica: hay que confirmar «Enviar sticker». El borrador de texto se mantiene; el comentario se guarda localmente y puede eliminarse. Los comentarios de ejemplo siguen siendo ficticios; no se añadió una comunidad pública real.
- Las imágenes en comentarios se evaluaron como una ampliación útil: una por respuesta, con compresión existente, texto alternativo, ocultar/denunciar, límites y borrado coherente de archivos. **No están implementadas en esta entrega**; las imágenes continúan disponibles en publicaciones y salas.

### Recursos y regeneración

El campo `format` del catálogo indica WebP sin cambiar el contrato de IDs. El campo `assets` enumera los seis archivos de cada colección con una huella de su contenido; las URLs cambian al reparar el dibujo y los IDs permanecen estables. `scripts/extract-character-stickers.mjs` extrae las ilustraciones de cinco hojas revisadas de 4 × 3, las normaliza a 320 × 320 con transparencia y conserva el mapeo editorial de poses. Recibe las cinco rutas locales en orden; los originales de generación se conservan fuera del repositorio en el entorno. Las imágenes WebP publicadas son la fuente de distribución y están versionadas.

## Actualización · Retiro de las colecciones anteriores

Por solicitud expresa del usuario se eliminaron del catálogo las doce colecciones antiguas, sus 144 SVG y el generador que las producía. Quedan únicamente los 60 stickers nuevos en diez colecciones, con los mismos IDs. La validación existente limpia automáticamente referencias retiradas de estrellas, recientes, frecuencia de uso y colecciones favoritas al cargar el navegador; preserva perfiles, reservas y preferencias de los personajes vigentes. El servidor rechaza nuevos envíos con IDs retirados; los mensajes históricos que los referencien muestran «Sticker no disponible». Las cifras y referencias a los clásicos en los apartados históricos anteriores describen entregas previas.

## Actualización · Recortes limpios y comprobación de recursos

Se revisaron las 60 ilustraciones sobre fondo oscuro. La cuadrícula inicial cortaba detalles propios e incluía extremos del vecino en algunos archivos. Las cinco láminas se repararon con la herramienta de imágenes, separando las siluetas y manteniendo personajes, expresiones y orden. La extracción selecciona el componente principal y los detalles cercanos, conserva dos píxeles del contorno suavizado y descarta restos ajenos; rechaza personajes que toquen el límite de su celda o componentes ambiguos. Después ajusta el conjunto a 280 × 280 dentro de una imagen transparente de 320 × 320 con 20 píxeles libres por lado.

`npm run check:stickers` revisa los recursos reales: transparencia y margen vacío, tamaño, presencia del personaje, ausencia de una segunda silueta considerable, nombres y huellas de contenido y correspondencia exacta con el catálogo. Ambas compilaciones lo ejecutan antes de generar la web. Esta comprobación geométrica complementa la revisión visual; no determina por sí sola si un detalle dibujado tiene sentido. El procedimiento de extracción prepara y valida todo en un directorio temporal antes de sustituir las imágenes publicadas. Las preferencias y los mensajes siguen referenciando los mismos IDs.

La ampliación de imágenes en comentarios ya está implementada en la maqueta: foto opcional junto al texto y envío de stickers independiente, conservando el borrador. Consultar [Imágenes y convivencia](IMAGENES_Y_CONVIVENCIA.md).
