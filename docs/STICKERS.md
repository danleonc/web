# Stickers en La Plaza, salas y chat individual

Requisito confirmado por el usuario el 19 de octubre de 2026: las personas también se expresan con stickers; deben estar disponibles en salas y chats privados, con un catálogo amplio y variado. Se registra como **R33**, prioridad de la comunicación del producto. La Plaza y el chat individual siguen siendo locales; las salas compartidas admiten stickers con validación del servidor en los modos de desarrollo y piloto. La demo pública es estática.

## Implementado

- **204 stickers / 22 colecciones**, incluidos 60 nuevos stickers de personajes sin rótulos y los 144 clásicos. Colecciones clásicas: Entre nos, Michis, Perritos, Un empujoncito, Vida cotidiana, A celebrar, Así me siento, Con calma, Humor cósmico, Cuidarnos, A mi ritmo y Pequeños planes.
- Nuevos personajes WebP transparentes de 320 × 320, sin rótulos; los clásicos mantienen SVG y expresiones en español. No son caracteres emoji enviados como texto.
- Selector común a La Plaza, salas y chat individual: personajes/colecciones, búsqueda por expresión sin exigir acentos, colecciones favoritas, favoritos manuales y por frecuencia, los 24 más recientes y vista previa con confirmación.
- Los mensajes identifican el sticker por un ID del catálogo. Nunca se acepta una URL arbitraria como contenido de sticker.
- Etiquetas accesibles, teclado, Escape y foco de retorno. No hay animaciones ni sonidos automáticos.
- Texto en borrador conservado al enviar stickers; el envío no exige adjuntar texto.
- Favoritos, recientes, frecuencia de uso y colecciones elegidas se guardan solo en el navegador, se comparten entre las vistas, se incluyen en la exportación JSON y se borran con el reinicio del prototipo.
- Compatibilidad con perfiles guardados antes de esta función: los nuevos campos se inicializan vacíos, conservando el perfil y las reservas. IDs desconocidos de preferencias se descartan.
- El chat individual se abre desde **Mis conexiones → Probar chat privado**. Es una demostración separada de las solicitudes de reencuentro; no simula que otra persona haya aceptado contacto.
- Mensajes de salas locales y chat individual de prueba quedan en memoria. Los comentarios de La Plaza se conservan localmente. El piloto con cuentas conserva historial en servidor según `CUENTAS_Y_DESPLIEGUE.md`; no confundirlo con la demo estática.

## Catálogo y ampliación

La fuente editorial es `src/chat/sticker-packs.json`. Cada colección tiene un ID, nombre, palabras de búsqueda, motivo, color y expresiones con posiciones estables (doce en los clásicos y seis en los personajes). Los SVG se generan con `node scripts/generate-stickers.mjs` y quedan en `public/stickers/`. El generador usa únicamente formas y texto definidos para este proyecto; no descarga packs, memes, marcas ni personajes ajenos. Mantener la revisión de derechos y contenido al añadir materiales de terceros en el futuro.

Los IDs actuales son `<colección>-<posición>`. Para conservar favoritos y referencias, **no reordenar ni reutilizar posiciones publicadas**. Nuevas colecciones o expresiones deben añadir IDs estables; si un recurso se retira, el receptor debe admitir un estado de sticker no disponible. El objetivo es variedad útil y calidad, sin inflar el número mediante duplicados indistinguibles.

La versión inicial incluye expresión de límites («Prefiero pasar», «Prefiero no contar», «Sin presión») y de afecto sin obligación romántica. Enviar afecto no supone consentimiento ni prueba atracción. La IA no recibe ni deduce preferencias personales a partir del uso de stickers.

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

El campo opcional `format` del catálogo permite WebP sin cambiar el contrato de IDs; su ausencia conserva SVG. `scripts/generate-stickers.mjs` solo regenera los clásicos. `scripts/extract-character-stickers.mjs` extrae las ilustraciones de cinco hojas revisadas de 4 × 3, las normaliza a 320 × 320 con transparencia y conserva el mapeo editorial de poses. Recibe las cinco rutas locales en orden; los originales de generación se conservan fuera del repositorio en el entorno. Las imágenes WebP publicadas son la fuente de distribución y están versionadas.
