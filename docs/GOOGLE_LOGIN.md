# Acceso con Google · configuración del piloto

Implementado como alternativa al usuario/contraseña. La integración está preparada;
no se ha creado un proyecto de Google Cloud, configurado credenciales reales,
desplegado el backend ni probado una cuenta real de Google. El usuario pidió
expresamente dejar preparada la configuración.

## Preparar Google Cloud

1. En [Google Cloud Console](https://console.cloud.google.com/auth/overview), crear
   o elegir un proyecto para Afinia y configurar la marca/pantalla de consentimiento:
   nombre, contacto de soporte, audiencia y URLs reales que correspondan.
2. Para un piloto externo en modo de prueba, añadir las cuentas Google de quienes
   vayan a probarlo como usuarios de prueba. Revisar los requisitos de publicación
   o verificación que indique Google antes de abrir a otras personas.
3. Crear un cliente OAuth de tipo **Aplicación web**. Esta integración usa flujo
   de servidor, no el SDK JavaScript ni ventanas emergentes.
4. Registrar la URI de redirección exacta:

   ```text
   https://DOMINIO-DEL-PILOTO/api/auth/google-callback
   ```

   Debe coincidir con `ENTRE_PUBLIC_ORIGIN` más `/api/auth/google-callback`, con
   el mismo esquema, dominio y puerto. No añadir `/web/` ni usar GitHub Pages como
   callback: se necesita el backend del piloto. Para pruebas en tu propio equipo
   puede registrarse un origen loopback HTTP con puerto exacto; el despliegue
   público exige HTTPS.
5. Guardar ID y secreto del cliente en el servidor. No enviar el secreto por chat,
   subirlo a Git ni introducirlo en variables `VITE_*`.

`https://entre.polysdeals.com` continúa siendo solo una propuesta de dominio del
piloto. No se ha creado ese subdominio ni cambiado DNS. Elegir el origen real antes
de registrar el callback definitivo en Google.

Solo se solicitan los ámbitos **openid** y **email**. No se requiere habilitar
Gmail API ni acceder a mensajes, contactos, archivos o fotografía de perfil.
Referencia oficial del protocolo:
[OAuth 2.0 para aplicaciones web de servidor](https://developers.google.com/identity/protocols/oauth2/web-server).

## Variables del servidor

| Variable | Uso |
| --- | --- |
| `ENTRE_PUBLIC_ORIGIN` | Origen público exacto, sin ruta ni barra final. |
| `ENTRE_GOOGLE_CLIENT_ID` | ID del cliente OAuth web, terminado en `.apps.googleusercontent.com`. |
| `ENTRE_GOOGLE_CLIENT_SECRET` | Secreto del cliente, privado del servidor. |

`server/pilot.ts` lee estas variables; Compose las transmite desde su entorno o
`.env` privado. El callback se deriva del origen y no acepta destinos arbitrarios.
Si faltan ambas credenciales, Google no se ofrece como botón activo y se conserva
la vía de contraseña/correo. Una configuración parcial detiene el arranque con
un error claro. No se contrataron servicios ni se activó facturación.

## Qué experimenta la persona

- «Continuar con Google» abre el selector de Google mediante una redirección
  completa, compatible con móvil. Al volver se conserva el espacio visitado.
- Una cuenta nueva elige alias público y declara 18+. No se usa el nombre legal,
  foto de Google ni fecha de nacimiento; tampoco se verifica identidad civil/edad.
- Para Gmail y correos de Google Workspace con dominio hospedado validado en el
  token, el correo queda confirmado por Google. Una dirección externa usada para
  una cuenta Google requiere además confirmación propia por SMTP: no se presupone
  que Google siga siendo autoridad sobre esa dirección.
- El correo permanece privado. Las cuentas nuevas de Google no reciben contraseña
  local ni clave local de recuperación: vuelven a entrar con Google. Recuperar la
  cuenta de Google corresponde al proveedor.
- Cancelar, expirar o fallar vuelve a Afinia con explicación y permite reintentar.
  Un token inválido nunca inicia sesión. Una sanción conserva sus efectos y su
  posibilidad de apelación al entrar con Google.

## Cuentas existentes y vinculación

No se fusionan cuentas por coincidencia de correo. Si ya hay una cuenta con esa
dirección confirmada, se pide entrar con su acceso anterior y utilizar
**Vincular cuenta de Google** desde Mi cuenta. Se exige sesión vigente, cuenta
habilitada, el mismo correo confirmado y un sujeto de Google que no pertenezca
a otra cuenta. La cuenta y sus reservas/historial/bloqueos permanecen intactos.
Cerrar sesión mientras se vincula invalida esa autorización.

La identidad se guarda con el identificador estable `sub` de Google, no con el
correo como clave de login. Un cambio de correo del proveedor no mueve ni fusiona
cuentas silenciosamente: requiere resolver el cambio con el responsable del
piloto usando el acceso anterior si existe. Gestión de cambio/desvinculación de
proveedores queda como función posterior; no se ofrece una opción incompleta.

La redirección no se inicia durante un encuentro activo. El borrador de publicación
de La Plaza se conserva en `sessionStorage` de esa pestaña por hasta diez minutos,
con control de titular y validación al restaurarlo; se elimina al consumirlo.
Al cambiar de cuenta se limpia el borrador de la vista. No se guardan contraseñas,
códigos de correo ni borradores de chats en ese mecanismo. Los mensajes efímeros
siguen perdiéndose al recargar o salir, como en el resto del prototipo.

## Protección y datos

OAuth usa código de autorización con PKCE S256, `state` y `nonce` aleatorios,
cookie de navegador HttpOnly/SameSite=Lax y flujo de un uso con diez minutos de
vigencia. En HTTPS la cookie lleva prefijo `__Host-`, Secure, Path=/ y ningún
Domain, para impedir su fijación mediante cookies de dominio desde subdominios.
La cookie de sesión existente conserva HttpOnly/SameSite=Strict.

La biblioteca JOSE valida firma RS256 contra las claves públicas de Google,
emisor, audiencia, destinatario autorizado, tiempos y nonce. El servidor intercambia
el código en un endpoint HTTPS fijo, con secreto y verificador PKCE. No se guarda
ni devuelve a la interfaz el ID token o los tokens de acceso/renovación de Google.
El cliente solo recibe su cookie de sesión de Afinia. El retorno usa rutas internas
permitidas; los secretos nunca se incorporan al bundle estático.

El intento de acceso se limita por IP y se guarda temporalmente en SQLite. La
migración v4 conserva datos anteriores, añade vínculo con `sub` y flujos temporales;
los flujos caducados se eliminan. Las copias contienen estado de autenticación:
seguir manteniéndolas privadas. Evitar registrar la query del callback en logs del
proxy, y revisar configuración de dominio, TLS y política de datos antes del piloto.

La demo pública sigue sin backend. Explica Google y la política de acceso desde
«Acceso»; no contiene un botón que simule entrar con una cuenta Google real.
La Plaza y Conexiones siguen como prototipos locales, separados del servicio de
salas con cuentas. Esta integración no implementa su persistencia compartida.

## Pruebas y activación pendiente

Los tests de servidor y navegador usan un proveedor simulado **solo en fixtures**:
intercepta el selector, entrega códigos y firma tokens con claves RSA de prueba.
La validación JOSE, PKCE, state, nonce, cookies y permisos reales del servidor se
mantienen activos. La producción usa exclusivamente los endpoints de Google.
No se enviaron credenciales ni tokens a Google durante estas pruebas.

Para activar: crear el cliente web, registrar el callback, configurar las dos
credenciales en un backend HTTPS y probar allí con las cuentas autorizadas.
Verificar entrada, cancelación, retorno, vinculación, sesión y restricciones antes
de ampliar el piloto. Las pruebas locales no equivalen a esa comprobación real.
