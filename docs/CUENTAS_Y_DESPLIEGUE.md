# Cuentas, persistencia y despliegue

La aplicación tiene tres modos separados:

| Modo | Arranque | Datos |
| --- | --- | --- |
| Maqueta pública | `npm run build` → `dist/` | Perfil y reservas ficticios en el navegador. Sin cuentas ni backend. |
| Laboratorio anterior | `npm run dev:shared` | Sesiones y mensajes efímeros para probar conexiones. |
| Piloto con cuentas | `npm run build:pilot` y `npm start` | Cuentas, sesiones, reservas, bloqueos e historial en SQLite. |

El piloto se abre en **Mi cuenta y encuentros**. Los otros recorridos conservan sus etiquetas de maqueta y sus datos locales: no se migran automáticamente a una cuenta. GitHub Pages solo sirve el primer modo; no puede ejecutar la API.

## Ejecutar el piloto

Node.js 24 (ver `.nvmrc`), dependencias del lockfile y disco escribible:

```sh
npm ci
npm run build:pilot
ENTRE_PUBLIC_ORIGIN=http://127.0.0.1:8788 npm start
```

El servidor sirve la web compilada y `/api` en el mismo origen. Escucha en loopback por defecto. No requiere claves de IA. Para participar requiere correo confirmado mediante SMTP configurable; sin configuración se conserva la exploración y se bloquea la participación. Ver [Acceso y correo](ACCESO_Y_CORREO.md). Node SQLite sigue teniendo APIs experimentales en esta versión; el proyecto fija Node 24 y comprueba copias y restauraciones. Es una arquitectura de una sola instancia para un piloto pequeño, no un clúster horizontal.

| Variable | Valor/uso |
| --- | --- |
| `ENTRE_PUBLIC_ORIGIN` | Obligatoria: origen exacto, sin `/` final. HTTPS obligatorio salvo `localhost`/`127.0.0.1`. |
| `PORT` | Puerto interno; 8788 por defecto. |
| `ENTRE_BIND` | `127.0.0.1` por defecto; `0.0.0.0` para un contenedor detrás de proxy. |
| `ENTRE_DATABASE_PATH` | `.data/entre.sqlite` por defecto; `/data/entre.sqlite` en contenedor. Debe estar en un volumen persistente. |

Los datos no deben quedar dentro del directorio público ni en Git. `.data/`, copias y archivos SQLite están ignorados. `dist-pilot/entre-build.json` permite comprobar que se está sirviendo la compilación con cuentas.

## Cuentas y acceso

- Usuario único de 3–30 letras ASCII, números o guiones bajos, sin distinguir mayúsculas. Nombre visible de hasta 30 caracteres. Se exige declaración de mayoría de edad; no hay verificación de edad o identidad.
- Contraseñas de 12–128 caracteres, derivadas con scrypt, sal aleatoria de 128 bits, `N=32768`, `r=8`, `p=1`, salida de 64 bytes. Nunca se guardan contraseñas en texto ni se mandan al navegador hashes almacenados. Máximo cuatro derivaciones concurrentes.
- Sesiones aleatorias de 256 bits, guardadas como SHA-256 en el servidor. Cookie `HttpOnly`, `SameSite=Strict`, restringida a `/api`, cuatro horas; `Secure` cuando el origen configurado es HTTPS. Hasta cinco sesiones por cuenta. Cerrar una sesión la revoca y cierra sus conexiones de sala.
- Alta y recuperación entregan una clave aleatoria de 256 bits una sola vez, con descarga local. Solo se almacena su hash. Recuperar cambia contraseña, rota la clave y revoca las sesiones anteriores. **Sin contraseña ni clave no hay recuperación por correo ni una identidad verificada con la que recuperarla.**
- Validación de campos, rechazo de orígenes ajenos y límites persistentes por IP y usuario: 30 intentos por IP en 10 minutos, 10 por usuario en 15 minutos. No se usa `X-Forwarded-For` como identidad de IP; detrás del proxy el límite de IP puede ser compartido entre todos los usuarios. Ajustarlo exige configurar explícitamente proxies de confianza antes de ampliar el piloto.

## Reservas, horarios y salas

Las tres temáticas iniciales conservan el primer horario que se crea en la base de datos; reiniciar no cambia la fecha. Los horarios se muestran en `America/Santiago`. No hay todavía un panel para programar convocatorias sucesivas.

Las reservas se guardan por cuenta mediante una transacción `BEGIN IMMEDIATE`: máximo seis por temática, una por cuenta y horario, sin duplicados ni sobreventa. Cancelar libera la plaza; no se puede cancelar mientras la cuenta siga conectada a esa sala. Solo una cuenta con reserva puede abrir su sala. Las reservas de la maqueta no habilitan este acceso.

La recepción abre cinco minutos antes y espera hasta cinco minutos después del horario de inicio. No se inicia antes de la hora. A partir de la hora puede comenzar con tres conectados, sin llenar los seis cupos. Al vencer la espera inicia con quórum o termina por falta de asistentes. No cambia fecha ni convierte el grupo en una cita individual. Después solo pueden reconectar integrantes del grupo. Se conservan las reglas de 90 segundos, extensión única, mayoría, pausa de un minuto y máximo 40 minutos.

Cada cuenta cuenta una vez, incluso desde dispositivos distintos. Al arrancar, el servidor carga las salas y marca a todos desconectados; los votos y la escritura no se restauran como activos. Las salas en curso entran o permanecen en su plazo de reconexión. El tiempo total del encuentro no se reinicia. Los mensajes y los recibos de envío se guardan antes de confirmar la entrega.

## Historial y datos

Cada sala conserva sus últimos 50 mensajes y 200 identificadores de reintento. Solo sus miembros pueden consultar el historial; la API no admite un identificador de usuario para consultar datos ajenos. Bloquear se guarda por cuenta, filtra el historial en ambos sentidos y obliga a quien bloquea a salir; otra sesión de la misma cuenta mantiene el bloqueo.

Después de cinco minutos sin conexiones se archiva la sala. Los historiales archivados se eliminan automáticamente a los 30 días. Cuentas, reservas y bloqueos permanecen guardados; todavía no hay eliminación/exportación de cuenta en servidor. El botón de borrar/exportar de la maqueta solo afecta al navegador. Los mensajes no tienen cifrado de extremo a extremo. El piloto incorpora reportes persistentes, consola por rol, sanciones justificadas y apelación; su implementación no proporciona un equipo de revisión. Se debe asignar un responsable antes de invitar participantes. No hay verificación de identidad ni IA analizando conversaciones. Ver [Imágenes y convivencia](IMAGENES_Y_CONVIVENCIA.md).

## Imágenes y moderación

Se incorporan imágenes normalizadas de acceso privado, votaciones de expulsión, reportes con evidencia limitada, suspensiones/baneo revisados y apelación. Configurar un moderador desde la CLI habilita las imágenes compartidas; no hay un administrador predeterminado. Reglas, límites y procedimiento: [IMAGENES_Y_CONVIVENCIA.md](IMAGENES_Y_CONVIVENCIA.md). La Plaza y su registro de reportes siguen siendo locales incluso con cuentas.

## Copias y restauración

La base usa claves foráneas, migración automática v1/v2/v3/v4 → `user_version=5`, WAL y transacciones. Copiar únicamente el `.sqlite` mientras funciona puede perder información del WAL. Usar la copia consistente:

```sh
node scripts/backup-db.mjs .data/entre.sqlite backups/entre-fecha-unica.sqlite
```

El destino debe ser nuevo; no se sobrescriben copias. La copia se crea con permisos 0600 e incluye hashes de contraseña, sesiones y mensajes: mantenerla privada, cifrarla en su almacenamiento de respaldo y limitar acceso. El archivo no se sube al repositorio. La programación, almacenamiento externo y retención de copias quedan pendientes del proveedor.

Para restaurar: detener la instancia, conservar una copia del estado actual, elegir una copia comprobada y configurar `ENTRE_DATABASE_PATH` apuntando a ese archivo en un directorio privado escribible. No mezclar con WAL/SHM de otra base. Comprobar salud, iniciar sesión y verificar reservas e historial antes de volver a abrir acceso. Las pruebas automatizadas restauran una copia independiente; no se ha recuperado aún una instancia en HostGator.

## HostGator y polysdeals.com

El usuario indicó HostGator y el dominio de su antigua tienda `www.polysdeals.com`. El soporte confirmó que tiene un **Plan Personal de hosting compartido**, inadecuado para Node.js 24, procesos permanentes y WebSocket, y recomendó evaluar un VPS. No se ha accedido al hosting ni modificado la tienda, DNS, certificados o correo.

Antes de publicar, elegir y disponer de un **VPS u otro alojamiento con Node.js 24, procesos permanentes, WebSocket y almacenamiento persistente**. El dominio puede conservarse en HostGator aunque el backend esté en otro proveedor. El plan actual puede mostrar la maqueta, pero no ejecutar este backend. No se contrata ni cambia el plan automáticamente.

Se prepara `entre.polysdeals.com` como destino de prueba propuesto, sin crear DNS ni sustituir `www`. El dominio final y el acceso de despliegue deben confirmarse con el propietario. Un VPS compatible podría usar Docker o Node más un gestor de procesos; el TLS y el proxy WebSocket deben configurarse mediante las herramientas del proveedor.

Archivos preparados:

- `Dockerfile`: Node 24, compilación separada, runtime sin usuario root y volumen `/data`.
- `deploy/compose.yml`: una instancia, volumen nombrado, puerto en loopback, sistema de archivos de solo lectura y límite de memoria.
- `deploy/nginx.conf.example`: referencia de proxy con WebSocket para un VPS con Nginx y certificado ya instalado. **No es un virtual host listo para reemplazar la configuración generada por cPanel/Apache.**

Ejemplo para un servidor compatible, una vez confirmados dominio y TLS:

```sh
ENTRE_PUBLIC_ORIGIN=https://entre.polysdeals.com docker compose -f deploy/compose.yml up -d --build
```

Esto arranca solo el servicio interno. No crea DNS ni certificados. Antes de conectar el dominio, conservar una copia de la antigua tienda y revisar la configuración de correo. No cambiar registros MX ni reemplazar el virtual host existente a ciegas. Los accesos se deben configurar por un mecanismo seguro; nunca enviar contraseñas o claves por el chat.

## Comprobación

```sh
npm run build
npm test
npm run test:pilot
```

La prueba de navegador del piloto usa una base temporal aislada y omite el horario **solo en su fixture de tests**, para comprobar registro, recuperación, reserva y mensajería sin esperar a la fecha programada. No hay endpoint público que cambie el reloj o ignore el horario.

La siguiente etapa es confirmar compatibilidad del hosting, desplegar una instancia privada y comprobar HTTPS/WebSocket, reinicio y copias desde dispositivos reales. Después: gestión de convocatorias, asignación y validación de moderación, sincronización de Plaza y controles de datos de cuenta antes de invitar participantes.


## Acceso con Google

El piloto admite inicio con Google y vinculación explícita a una cuenta existente.
Configurar `ENTRE_GOOGLE_CLIENT_ID` y `ENTRE_GOOGLE_CLIENT_SECRET` en el servidor;
registrar en Google el callback exacto derivado de `ENTRE_PUBLIC_ORIGIN`.
Sin esas variables se conserva la vía de usuario/correo, sin botón Google activo.
Procedimiento, permisos y límites: [Acceso con Google](GOOGLE_LOGIN.md).


## Avisos en el teléfono

El esquema vigente v5 añade suscripciones push por cuenta/dispositivo. La activación
es voluntaria y requiere configurar VAPID; sin sus variables el piloto conserva
el acceso anterior y no ofrece activación. PWA, requisitos de iPhone, privacidad,
baja/prueba y alcance pendiente de Plaza en [Notificaciones](NOTIFICACIONES.md).
