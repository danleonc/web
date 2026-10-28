# Acceso por cuenta y correo confirmado

La participación del piloto requiere sesión válida, correo confirmado y
declaración de mayoría de edad. No se recogen documentos, rostro, RUT, huellas
ni fecha de nacimiento. No se afirma verificar identidad civil ni edad.

La vía implementada conserva usuario/contraseña y recuperación por clave,
añadiendo confirmación de correo (incluye direcciones Gmail). El acceso directo
con Google queda pendiente: requiere su propia integración y configuración.
No se muestra un botón que simule ese acceso.

## Experiencia

- Visitantes pueden explorar temas, publicaciones ilustrativas y encuentros.
- Crear cuenta requiere declarar 18+. La cuenta queda pendiente hasta confirmar
  correo y ratificar la declaración al solicitar el código.
- En el piloto, compartir o preparar perfil sin acceso abre la cuenta conservando
  la página. Tras confirmar se puede continuar con el alias de esa cuenta.
- El titular ve «Correo confirmado» y la aclaración de que identidad/edad no se
  han verificado. El correo solo se devuelve en su sesión autenticada.
- La demo estática muestra «Acceso» y una explicación. Sus acciones siguen siendo
  pruebas locales: no crea cuentas, no confirma correos ni realiza llamadas API.
- La Plaza y Conexiones siguen siendo prototipos locales, también dentro de la
  compilación piloto. Los permisos de la interfaz no las convierten en servicios
  compartidos. Persistencia y entrega reales de esos espacios siguen pendientes.

## Envío real por SMTP

Configurar estas variables únicamente en el servidor o en un archivo `.env`
privado para Compose. No subirlas a Git ni pegarlas en el chat:

| Variable | Uso |
| --- | --- |
| `ENTRE_SMTP_HOST` | Servidor de correo del proveedor elegido. |
| `ENTRE_SMTP_PORT` | 465 para TLS implícito, o 587 con STARTTLS obligatorio. |
| `ENTRE_SMTP_USER` | Usuario de autenticación SMTP. |
| `ENTRE_SMTP_PASSWORD` | Contraseña de SMTP o credencial de aplicación. |
| `ENTRE_MAIL_FROM` | Dirección remitente autorizada por el proveedor. |

El transporte usa Nodemailer, validación TLS normal, autenticación y tiempos de
espera acotados. No admite puerto 25 ni desactivar certificados mediante estas
opciones. El contenido es texto plano, sin seguimiento ni enlaces de acceso.
Configurar también SPF/DKIM/DMARC según el proveedor y comprobar recepción real,
spam y cuotas. No se ha conectado un buzón real ni probado su entregabilidad.
No se contratan servicios ni se modifica DNS automáticamente.

Sin host configurado la web puede arrancar y explorarse, pero el envío aparece
no disponible y la participación permanece pendiente. Una configuración parcial
con host definido detiene el arranque con un error, evitando un falso envío.
Compose transmite estas variables; no se incluyen valores reales en el repositorio.

## Reglas y protección

El código tiene ocho dígitos, caduca a los diez minutos y admite cinco intentos.
Solo funciona para la cuenta/sesión que lo solicitó y una sola vez. Reenviar
requiere al menos un minuto e invalida el anterior. Hay límites persistentes por
cuenta, dirección e IP. Un fallo de entrega invalida el código y no concede acceso.
Una dirección confirmada pertenece a una sola cuenta; solicitudes pendientes de
otras cuentas no la bloquean permanentemente.

Se almacena un HMAC del código con secreto aleatorio del proceso, nunca su texto
ni el secreto en la base o logs. Al reiniciar se conservan las confirmaciones,
pero se invalidan los códigos pendientes: se debe solicitar otro respetando la
espera. Este mecanismo corresponde a la arquitectura de una instancia del piloto;
varias instancias requieren coordinar claves y el estado antes de escalar.

API y WebSocket consultan la confirmación en servidor. Se bloquean reservas,
historial, archivos, reportes/moderación y entrada/envíos de sala para cuentas
pendientes; sesión, confirmación y apelación conservan sus propios controles.
Las cuentas restringidas no pueden realizar acciones sociales aunque su correo
esté confirmado. No hay aceptación de flags de verificación enviados por cliente.
Los bloqueos de sala, moderación, sanciones y apelaciones existentes se mantienen.

Los límites por IP usan la conexión del servidor, sin confiar en cabeceras
reenviadas del cliente. Detrás de un proxy pueden compartirse; deben revisarse
junto con la configuración del proxy y el volumen del piloto antes de abrirlo.

## Datos, actualización y pruebas

SQLite migra de v1/v2 a v3, conservando cuentas, sesiones, reservas e historiales.
La nueva tabla guarda correo, fecha de confirmación/declaración y estado temporal
del código. Las cuentas antiguas quedan pendientes hasta confirmar un correo;
no se les atribuye verificación anterior. Respaldar antes de actualizar.

El correo y sus estados forman parte de las copias privadas del servidor. La
retención, exportación y eliminación de datos de cuenta deben definirse antes
de producción; la confirmación no resuelve esas obligaciones ni el control legal
de edad. No se ha desplegado el backend ni habilitado usuarios reales.

Los tests usan entrega inyectada en memoria o buzón efímero del fixture local.
Ningún endpoint de producción devuelve códigos ni permite consultar ese buzón.
No se enviaron correos a terceros durante la implementación.
