# Nexafia · avisos de conversaciones y teléfono

## Qué está implementado

La campana abre un centro con contador sin leer, lectura, acceso al comentario,
marcar todo y limpiar avisos. Publicar o responder sigue automáticamente el hilo;
se puede seguir manualmente desde su detalle. Texto, imagen y sticker cuentan como
respuestas. Silenciar persiste hasta reactivar, marca lo anterior como leído y no
se revierte por seguir comentando. Reactivar no recupera lo omitido. No se generan
avisos de respuestas propias, históricas o duplicadas; los bloqueados, ocultos o
eliminados no se muestran. En sala activa no se abandona el encuentro al abrir un
aviso. Los estados locales se aíslan por cuenta y la exportación solo incluye el
ámbito actual de notificaciones; borrar datos locales incluye esos estados.

**Plaza sigue siendo local, incluso en la compilación piloto.** No hay eventos de
otras personas entregados por un backend de comunidad. «Probar un aviso de ejemplo»
es una acción explícita: sigue una conversación ficticia y referencia un comentario
preescrito, sin publicar una respuesta nueva. Se etiqueta como ejemplo. No se
programan avisos falsos, métricas de actividad o recordatorios automáticos.

## Teléfono: preparación y alcance

Se añaden manifest, iconos de la marca y worker push. El worker no cachea HTML/JS,
por lo que no congela versiones de la app. No pide permisos al entrar. Una cuenta
habilitada en un piloto configurado puede activar, probar y desactivar su propio
dispositivo desde Notificaciones. Se admiten cinco por cuenta y se limitan las
pruebas. La prueba es al endpoint del dispositivo autenticado, sin aceptar texto,
destino o identidad arbitrarios del cliente.

**La demo de GitHub Pages no envía push.** Para recibir con la app cerrada hay que
publicar frontend y backend del piloto en el mismo origen HTTPS, configurar VAPID
y probar con un teléfono real. No se han contratado servicios, cambiado DNS,
configurado claves de producción ni enviado notificaciones a dispositivos reales.

La entrega de interacciones reales requiere además conectar el backend de Plaza:
persistir seguimiento/silencio por cuenta en servidor, guardar eventos de comentarios
validados y emitir avisos solo a sus participantes habilitados. Esas preferencias
compartidas deben aplicarse antes de cada envío, también para teléfono; no bastan
las preferencias locales de esta maqueta. El adaptador compartido debe mantener
un cursor/identificador de evento y el inicio de seguimiento o reactivación para
no reenviar el pasado; el reducer local deduplica solo sus 50 referencias retenidas.
No se presenta la prueba push como esa integración ya terminada.

## Configuración VAPID del servidor

La integración usa Web Push 3.6.7. Variables privadas:

| Variable | Uso |
| --- | --- |
| ENTRE_VAPID_PUBLIC_KEY | Clave pública del emisor, que se entrega al navegador |
| ENTRE_VAPID_PRIVATE_KEY | Clave privada, solo en el servidor |
| ENTRE_VAPID_SUBJECT | Contacto mailto: o HTTPS válido del responsable |

Generar una vez **en el servidor elegido**, conservar las claves y completar el
contacto. El script crea un archivo nuevo con permisos `0600`, no sobrescribe ni imprime el secreto:

```sh
node scripts/generate-push-keys.mjs deploy/.env.push
```

Editar el archivo privado para completar ENTRE_VAPID_SUBJECT. No subirlo a Git,
compartirlo por chat o usar VITE_* para la clave privada. Incorporar las variables
al despliegue privado existente; Compose ya las transmite. Cambiar las claves
requiere reactivar las suscripciones de los dispositivos.

Ejemplo al ejecutar directamente en el servidor, con origen real y compilación piloto:

```sh
npm run build:pilot
set -a
. deploy/.env.push
set +a
ENTRE_PUBLIC_ORIGIN=https://DOMINIO-DEL-PILOTO npm start
```

Sin las tres variables, no se ofrece activación. Configuración parcial o claves
no emparejadas detienen el arranque. El dominio anterior propuesto no se ha creado;
no usar GitHub Pages como origen de la API. La configuración de Google es separada.

## Activar en el dispositivo

1. Entrar al piloto HTTPS, confirmar correo y declarar mayoría de edad.
2. En iPhone/iPad: abrir con Safari, Compartir → Añadir a pantalla de inicio,
   abrir desde ese icono. Requiere iOS/iPadOS 16.4 o posterior.
3. Abrir Notificaciones → En tu teléfono → Activar avisos en este dispositivo.
4. Aceptar el permiso y usar Enviar prueba a mi dispositivo. Confirmar recepción
   real antes de invitar participantes; una respuesta del proveedor no demuestra
   por sí sola que la notificación haya aparecido en pantalla.
5. Desactivar desde el mismo panel cuando se desee. Denegar el permiso no vuelve
   a solicitarlo automáticamente; se cambia desde los ajustes del sistema/navegador.

No se necesita abrir una cuenta de App Store ni publicar una app nativa para este
flujo web. La compatibilidad debe comprobarse en el dispositivo real.

## Datos y protección

SQLite migra v1–v4 a v5 conservando cuentas, reservas e historiales y añade
suscripciones por usuario/sesión de registro. Las suscripciones se conservan al
reiniciar. Cerrar sesión revoca las asociadas a esa sesión; recuperar cuenta revoca
sus dispositivos. La sesión de Afinia/Nexafia no se amplía por activar push. Una
suscripción puede recibir avisos genéricos tras expirar la sesión, pero leer la
cuenta sigue requiriendo acceso. Un cambio de cuenta limpia la suscripción del
navegador; una reconexión a la misma cuenta solo vuelve a vincular un consentimiento
ya existente, sin pedir permiso por sí sola.

Endpoints de Google/Apple/Mozilla/Microsoft permitidos, HTTPS, sin credenciales o
puertos arbitrarios; claves de cifrado de formato/curva válidos, cuerpo acotado,
sesión/origen/correo/restricción y límites comprobados. No se devuelve ni registra
el endpoint, sus claves o el secreto VAPID en errores. La base/copia contiene
suscripciones y claves de cifrado del receptor: mantenerla privada como el resto
de datos del piloto. Borrar la maqueta local no borra las suscripciones del servidor;
se desactivan desde el panel del dispositivo o cerrando sesión.

El payload de prueba es genérico, sin nombres, títulos de publicaciones o fotos.
El worker no acepta URL externa del payload: enfoca la app existente y abre el
centro sin sacar a nadie de una sala, o abre el mismo ámbito/origen si está cerrada.
Las pruebas de transporte/navegador usan fixtures privados, no un proveedor o
permisos reales. No se ha probado entrega real en Safari/iPhone físico.

Referencias: [Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)
y [Notifications API](https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API).
