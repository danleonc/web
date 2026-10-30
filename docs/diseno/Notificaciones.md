# Notificaciones de conversaciones

El usuario pide avisos al interactuar en publicaciones donde participa, salvo si
las silencia, y confirma avisos dentro de Nexafia y en el teléfono.

## Experiencia

Campana en cabecera con contador sin leer y centro reutilizando Modal. Publicar
una conversación o responder (texto/imagen/sticker) activa seguimiento automático.
También se puede seguir una conversación desde su detalle. Silenciar detiene
avisos nuevos, marca los anteriores de ese hilo como leídos y persiste hasta
reactivar; responder no reactiva un hilo silenciado. Reactivar no reenvía el pasado.
No avisar de acciones propias, actividad histórica, duplicados o autores bloqueados.
Ocultar/eliminar conversación o bloquear autor impide mostrar esos avisos. Abrir
un aviso lleva al comentario y lo marca leído; marcar todos y limpiar son acciones
explícitas. Durante sala activa se puede leer el centro sin salir del encuentro.

## Alcance actual

Plaza no tiene todavía API compartida. No inventar respuestas o avisos entrantes.
La prueba local solo genera un aviso al pulsar una acción explícita, marcado como
«Aviso de ejemplo», sobre un comentario preescrito existente, sin añadir comentarios.
El motor acepta referencias validadas para conectarlo después al backend de Plaza.
Los estados y preferencias se guardan por cuenta local (o maqueta), sin mezclar
cuentas. No se guardan cuerpos ni imágenes duplicados. Exportación/borrado local
incluye esas preferencias. Migración ausente/corrupta no daña datos anteriores.

## Teléfono

PWA instalable, manifest/iconos y worker dedicado a push, sin caché offline de
HTML/JS para evitar versiones obsoletas. No solicitar permisos al entrar: acción
voluntaria en Notificaciones, por dispositivo. iPhone/iPad requiere iOS/iPadOS16.4+
y app en pantalla de inicio; no prometer que Chromium pruebe Safari físico.

Preparar Web Push del piloto con VAPID por variables privadas, suscripciones SQLite
por cuenta/dispositivo y prueba explícita al propio dispositivo. Sin configuración,
no ofrecer un botón de activación falso. Los avisos fuera de la app requieren backend
HTTPS y origen real; GitHub Pages solo muestra la interfaz. El backend de Plaza y
sus preferencias compartidas deben conectarse antes de notificar interacciones
reales; la prueba push no acredita esa integración. No contratar servicios ni
configurar DNS/proveedores reales en esta tarea.

Payload genérico, sin nombres, publicaciones o imágenes en pantalla bloqueada.
Worker abre solo el mismo origen/ámbito. Sesión, origen, correo confirmado,
restricciones, límites, tamaño y proveedores push permitidos validados en servidor;
no enviar a endpoints arbitrarios. Bajas por dispositivo, logout/recuperación,
suscripciones caducadas y errores sin filtrar claves o endpoints. Sin envíos reales
durante pruebas: transporte inyectado privado y navegadores simulados.

## Diseño

Verde #285d4c, tinta #293e35, fondo #faf9f6, crema #f3f1e8, líneas #e7e8df; Inter
para contenido y Georgia para títulos. Lista clara, sin saturar con cada reacción,
botones44px, campo16px si corresponde, campana sin desbordar cabecera320px.
Agrupar por conversación visualmente si el volumen lo requiere después, sin inventar
reacciones que no existen ahora. Revisar vacío/listo/silenciado/error/permisos y foco.
