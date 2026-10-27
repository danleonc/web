# Imágenes y convivencia · Afinia

Entrega autorizada por el usuario el 25 de octubre de 2026. El contenido visual sirve para conversar; la votación permite proteger un encuentro sin convertir la popularidad en una sanción de cuenta.

## Qué puede probarse

| Función | Maqueta y GitHub Pages | Piloto con cuentas |
| --- | --- | --- |
| Imagen en comentario de Plaza | Una por respuesta, con texto opcional; local y persistente en este navegador. | La Plaza sigue siendo local. |
| Imagen en publicación de Plaza | Una imagen propia, local y persistente en este navegador. | La Plaza sigue siendo local. |
| Imagen en encuentro | Adjuntar y previsualizar; chat de demostración efímero. | Archivo compartido con los miembros autorizados, si existe una cuenta de moderación configurada. |
| Ocultar y ampliar | Ocultar solo en este navegador; ampliar y descargar. | Igual; retirar por moderación además impide futuras descargas a participantes. |
| Reportar | Registro de prueba local, sin envío ni revisión humana. | Cola persistente, evidencia del mensaje señalado y revisión mediante rol de moderación. |
| Expulsión por mayoría | Votos de personajes explícitamente simulados. | Votos de cuentas presentes, únicos y comprobados en servidor. |
| Suspender, banear y apelar | No se simulan como sanciones reales. | Decisión de moderación justificada y recurso desde la cuenta afectada. |

El laboratorio efímero permite probar votos entre sesiones de desarrollo, pero no imágenes propias ni cola de reportes. El chat privado de demostración conserva texto y stickers; no incorpora archivos privados en esta entrega.

## Imágenes

El selector admite fotos JPG, PNG y WebP estáticas de hasta 20 MiB, 120 megapíxeles y 20 000 px por lado. El tamaño del original es distinto del archivo que se comparte: el usuario no necesita reducirlo antes. Se reconoce el formato por su contenido incluso si la cámara no informa MIME, y se leen las dimensiones antes de decodificar. Cuando el navegador lo permite se pide al decodificador una imagen ya reducida; se respeta la orientación EXIF de las fotos de cámara. Si `createImageBitmap` falta o falla, se utiliza el decodificador de imagen ordinario del navegador.

Se intenta WebP y se pasa automáticamente a JPG si el navegador devuelve otro formato, un resultado vacío o un error de codificación; PNG queda como alternativa final. Si bajar la calidad no basta, la resolución se reduce progresivamente de 1280 a 1024, 800, 640, 480, 320 o 256 px hasta obtener un archivo de hasta 350 KiB. El lienzo no conserva EXIF ni GPS del original; la alternativa JPG aplica fondo blanco donde había transparencia. El selector muestra el progreso y el peso final. Las descargas locales utilizan la extensión del formato realmente obtenido. La descripción opcional tiene hasta 180 caracteres. No se admiten SVG, GIF ni animaciones. No se reciben enlaces remotos de imágenes.

En el servidor se comprueban otra vez formato, dimensiones y animación, con un cuerpo de hasta 2 MiB; se vuelve a codificar con Sharp a WebP y se eliminan metadatos. La resolución también puede reducirse progresivamente si los cambios de calidad no bastan. El cliente envía el MIME real del archivo preparado, de modo que la alternativa JPG funciona en el piloto sin eludir la validación del servidor. Hay hasta dos conversiones simultáneas, caché y concurrencia nativas acotadas. Los límites del piloto son 10 intentos de carga por minuto/cuenta, 20 archivos por encuentro y 200 en total. Incluyen cargas aún no enviadas. Alcanzar un límite rechaza la carga con un mensaje, no borra silenciosamente contenido existente. Un identificador de carga permite reintentar sin duplicar archivos.

Los archivos del piloto se guardan como BLOB en SQLite fuera del directorio público. Cada solicitud exige sesión y pertenencia al encuentro, y respeta bloqueos, expulsiones y restricciones. El servidor comprueba propietario y sala al publicar la referencia. Se sirven como `image/webp`, `nosniff`, `same-origin`, sin caché. El rol de moderación puede acceder a una imagen señalada para revisar su reporte. Retirar impide nuevos accesos a participantes y comunica el retiro a la sala; no puede recuperar copias descargadas anteriormente. No hay un clasificador automático de contenido ni se promete impedir que aparezca material indebido antes de reportarlo.

En la maqueta los archivos se guardan en IndexedDB `afinia.images.v1`, con hasta 10 MiB. Eliminar una respuesta elimina su imagen; eliminar una publicación también elimina los archivos de sus respuestas. Desplazar una respuesta al superar las últimas 100 libera su imagen si no la usa otro elemento. Eliminar una publicación elimina su archivo; los adjuntos de chat se eliminan al abandonar la sala. Quitar o reemplazar un adjunto sin publicar también libera el archivo cuando ya no pertenece a una publicación. En los comentarios, la foto del borrador vive en memoria y solo se guarda al publicar; cambiarla, quitarla, cerrar o cancelar no deja archivos en IndexedDB. Si falla el guardado, la foto y el texto se conservan para reintentar. En el editor de publicaciones, un borrador cerrado puede conservar su adjunto; recargar pierde ese borrador y puede dejar su archivo local hasta el borrado completo. El reset limpia el almacén. Las referencias permanecen en `entre.prototype.v1.plaza`; ocultos en `afinia.hidden-images.v1`; reportes locales en `afinia.reports.v1` (últimos 50). La exportación JSON incluye referencias y reportes, **no los binarios**: cada imagen puede descargarse desde su vista ampliada. Los ajustes locales no borran datos del servidor.

## Encuadre de la vista previa

Las fotos llenan el ancho de la vista previa y de las tarjetas de Plaza. El marco conserva las proporciones habituales: verticales hasta 3:4, cuadradas y horizontales hasta 1,91:1. Las fotos más estrechas o panorámicas se encuadran desde el centro para evitar franjas laterales; el encuadre es visual, sin modificar el archivo guardado. «Ver completa» muestra la foto entera antes de adjuntarla y después de publicarla. Las tarjetas muestran la imagen de borde a borde y los chats mantienen un ancho adaptado a la conversación.

## Expulsión del encuentro

1. Una cuenta presente solicita retirar a otra, elige una conducta y confirma. La solicitud incluye el voto a favor de quien la abre.
2. Se fija el conjunto de otros presentes; la persona señalada no vota en su propia solicitud. Se requieren al menos dos electores.
3. El umbral es `max(2, floor(electores / 2) + 1)`. Con tres o cuatro asistentes se necesitan dos votos; con cinco o seis, tres. No cambia si alguien se desconecta. Las pestañas de una cuenta no dan votos adicionales.
4. Hay 60 segundos para votar. El voto es único, no se cambia y solo puede emitirse estando presente. El silencio no suma. Se muestran participación total, umbral y voto propio; los votos de otras cuentas no se transmiten al navegador.
5. Al alcanzar el umbral, la persona sale, se cierran todas sus conexiones a ese encuentro, pierde acceso a su historial y no puede volver a entrar. Se recalcula el quórum y se aplica la pausa existente si quedan menos de tres. El resto de su cuenta no se banea.
6. Si se agota el plazo o todos votan sin alcanzar el umbral, no hay expulsión. Hay dos minutos entre solicitudes. Reiniciar o reconectar conserva plazo, votos y expulsiones; cerrar el encuentro cancela una votación pendiente.

Bloquear, denunciar y salir siguen disponibles sin esperar la votación. Un desacuerdo respetuoso no es motivo de sanción; las normas prohíben organizar votos de hostigamiento. La mayoría no prueba una infracción ni sustituye una revisión. No hay detección automática de coaliciones. Las expulsiones locales son solo demostraciones de esa visita, sin identificación ni control de acceso real.

## Reportes y revisión

En el piloto se puede reportar una conducta o un mensaje concreto del grupo. No se permite señalar un mensaje de otro autor ni inventar evidencia enviada por el navegador: se guarda el contenido del mensaje en el servidor. Los reportes de conducta incluyen la explicación del remitente y requieren evaluación, no se presentan como hechos probados. El reporte no oculta por sí solo ni sanciona automáticamente. Cada cuenta tiene hasta cinco reportes nuevos por hora; se deduplican por sala, autor del reporte, persona, motivo y mensaje. Hay hasta 5000 registros; la cola muestra 50 priorizando pendientes.

La consola de **Mi cuenta y encuentros → Revisión de convivencia** solo aparece a moderadores, y la API comprueba el rol por separado. Permite cerrar sin sanción, retirar la imagen, retirar de ese encuentro, suspender de 1 a 168 horas o banear la cuenta. Toda decisión requiere justificación y conserva una acción de auditoría. Una expulsión directa del moderador también se guarda y respeta el quórum. La decisión de cuenta cierra conexiones existentes y bloquea nuevos accesos a comunidad, archivos, reservas e historial; login, recuperación y apelación siguen accesibles.

La persona ve motivo y duración, y puede apelar una vez por sanción desde su cuenta. Moderación puede mantener la decisión o levantar esa restricción con justificación. Una apelación antigua no puede levantar una sanción posterior. Una suspensión caduca según el reloj del servidor; el baneo continúa hasta revisión. Son controles por cuenta, sin verificación de identidad ni prevención de registrar otra cuenta.

No se nombra un equipo humano por implementar una consola. Antes de usarla con participantes hay que designar responsables, acordar disponibilidad de revisión, comunicación de decisiones, plazos y protocolo de casos graves. No existe una garantía de atención inmediata. La consola no permite sancionar a otra cuenta moderadora; esos casos requieren intervención del responsable del servicio fuera de este flujo.

## Asignar moderación de forma explícita

No existe un endpoint de autopromoción ni una cuenta administrativa predeterminada. Registrar la cuenta que deba moderar y, con acceso privado al servidor y a su archivo SQLite, ejecutar:

```sh
node scripts/moderator.mjs promote USUARIO_EXISTENTE .data/entre.sqlite
# Revocar ese rol:
node scripts/moderator.mjs revoke USUARIO_EXISTENTE .data/entre.sqlite
```

En Compose, usando la misma base del volumen:

```sh
docker compose -f deploy/compose.yml exec entre node scripts/moderator.mjs promote USUARIO_EXISTENTE /data/entre.sqlite
```

Asignar el rol no verifica ni contrata a esa persona. La carga de imágenes compartidas permanece deshabilitada hasta que exista al menos un moderador configurado. Revocar el último detiene nuevas cargas; no borra imágenes anteriores. El rol aparece al actualizar la sesión. Los fixtures de navegador crean un moderador **solo en su base temporal de prueba**, nunca en `npm start`.

## Persistencia y siguiente etapa

SQLite migra automáticamente de versión 1 a 2 al abrir la base, conservando cuentas, sesiones, reservas e historiales; respaldar primero una instancia existente. Reportes y archivos siguen la retención de su sala (30 días tras archivar). Restricciones, apelaciones y registro de decisiones permanecen; la política de retención de estas evidencias administrativas, exportación y borrado de cuenta todavía deben definirse antes de producción. Las copias de seguridad incluyen imágenes y evidencias y requieren la misma protección que las conversaciones.

Siguiente: comprobar estas reglas con un grupo cerrado de prueba y un responsable de convivencia, ajustar abusos y comprensión, y después conectar La Plaza e invitaciones al backend con estos mismos permisos y flujos de reporte. La funcionalidad de seguridad compartida de esta entrega se limita a los encuentros del piloto.

Los controles para solicitar una expulsión se despliegan al necesitarlos, para mantener la conversación despejada. Una votación nueva abre ese panel automáticamente; los resultados se comunican en la sala. La revisión de una apelación muestra también el motivo y tipo de la decisión original. Bloquear un personaje desde Plaza también lo excluye de las salas locales.

## Comentarios con imágenes

En La Plaza, abrir una conversación → «Añadir una imagen» → revisar/describir → «Adjuntar a mi respuesta» → «Guardar respuesta». Se admite una foto sola o con hasta 700 caracteres de texto. Se puede cambiar, quitar o ampliar antes de publicar. Los stickers se envían como respuesta independiente y conservan el texto y la imagen del borrador. Publicar una respuesta vacía sin foto está deshabilitado. Las respuestas publicadas permiten ver la imagen completa, descargar, ocultar y reportar; su autor puede eliminar la respuesta. El reporte sigue siendo local y no implica revisión humana.
