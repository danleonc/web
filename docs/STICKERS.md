# Stickers en salas y chat individual de demostración

Requisito confirmado por el usuario el 19 de octubre de 2026: las personas también se expresan con stickers; deben estar disponibles en salas y chats privados, con un catálogo amplio y variado. Se registra como **R33**, prioridad de la comunicación del producto. La implementación actual corresponde al prototipo; no crea mensajería entre usuarios reales.

## Implementado

- **144 stickers vectoriales estáticos propios, en 12 colecciones**: Entre nos, Michis, Perritos, Un empujoncito, Vida cotidiana, A celebrar, Así me siento, Con calma, Humor cósmico, Cuidarnos, A mi ritmo y Pequeños planes.
- Ilustraciones SVG con transparencia y expresiones en español, incluidas algunas expresiones chilenas. No son caracteres emoji enviados como texto.
- Selector común a sala y chat individual de prueba: categorías, búsqueda por texto/palabras asociadas sin exigir acentos, favoritos, los 24 más recientes y vista previa con confirmación de envío.
- Los mensajes identifican el sticker por un ID del catálogo. Nunca se acepta una URL arbitraria como contenido de sticker.
- Etiquetas accesibles, teclado, Escape y foco de retorno. No hay animaciones ni sonidos automáticos.
- Texto en borrador conservado al enviar stickers; el envío no exige adjuntar texto.
- Favoritos y recientes se guardan solo en el navegador, se comparten entre las vistas, se incluyen en la exportación JSON y se borran con el reinicio del prototipo.
- Compatibilidad con perfiles guardados antes de esta función: los nuevos campos se inicializan vacíos, conservando el perfil y las reservas. IDs desconocidos de preferencias se descartan.
- El chat individual se abre desde **Mis conexiones → Probar chat privado**. Es una demostración separada de las solicitudes de reencuentro; no simula que otra persona haya aceptado contacto.
- Mensajes de texto y stickers quedan en memoria y se pierden al cerrar su sala o chat. No se exporta contenido de conversaciones.

## Catálogo y ampliación

La fuente editorial es `src/chat/sticker-packs.json`. Cada colección tiene un ID, un nombre, palabras de búsqueda, motivo gráfico, color y doce expresiones. Los SVG se generan con `node scripts/generate-stickers.mjs` y quedan en `public/stickers/`. El generador usa únicamente formas y texto definidos para este proyecto; no descarga packs, memes, marcas ni personajes ajenos. Mantener la revisión de derechos y contenido al añadir materiales de terceros en el futuro.

Los IDs actuales son `<colección>-<posición>`. Para conservar favoritos y referencias, **no reordenar ni reutilizar posiciones publicadas**. Nuevas colecciones o expresiones deben añadir IDs estables; si un recurso se retira, el receptor debe admitir un estado de sticker no disponible. El objetivo es variedad útil y calidad, sin inflar el número mediante duplicados indistinguibles.

La versión inicial incluye expresión de límites («Prefiero pasar», «Prefiero no contar», «Sin presión») y de afecto sin obligación romántica. Enviar afecto no supone consentimiento ni prueba atracción. La IA no recibe ni deduce preferencias personales a partir del uso de stickers.

## Contrato propuesto para mensajería real — pendiente

- Mensaje discriminado: texto o sticker. Para sticker, `sticker_id`, versión de catálogo, emisor, conversación y timestamps generados/controlados por servidor.
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

## Verificación de esta entrega

- Compilación TypeScript/Vite correcta.
- **22 pruebas aprobadas** en Chromium de escritorio y móvil: las 16 anteriores y seis ejecuciones nuevas de catálogo, selección, envío, borrador, favoritos, recientes, chat individual, diálogos anidados, exportación, borrado y accesibilidad automática.
- Compilación servida bajo `/web/`: envío en sala y chat individual verificado y **144/144 SVG** con respuesta correcta y tipo `image/svg+xml`.
- Los 144 archivos son XML SVG válidos y no contienen scripts, imágenes externas ni HTML incrustado.
- Estas comprobaciones validan el prototipo, no un servicio de mensajería entre personas reales ni un cumplimiento integral de accesibilidad.
