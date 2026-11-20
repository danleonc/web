# Revisión de seguridad de Nexafia — 20 de noviembre de 2026

## Alcance y resultado

Revisión del repositorio `web` en la rama `codex/nexafia-desarrollo`, de su configuración de arranque y de respuestas públicas limitadas. No es una prueba de penetración independiente ni acredita seguridad total o cumplimiento legal. El sitio está protegido como entorno de pruebas; el resultado no autoriza abrirlo al público.

## Cambios preparados y probados localmente

- Cabeceras en todas las respuestas HTTP, incluida la barrera de pruebas: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: same-origin`, y `Permissions-Policy`, con cámara permitida solo al propio sitio para no impedir la selfie. Se anuncia HSTS por un año cuando está configurado HTTPS; no incluye subdominios ni precarga.
- Registro estructurado de fallos de inicio de sesión o recuperación y de límites alcanzados en esos procesos, sin contraseñas, usuarios, tokens, correos ni direcciones IP. Se emite por el registro del proceso: esto no crea alertas, conservación independiente ni vigilancia continua.
- Pruebas automatizadas de cabeceras, separación entre HTTP local y HTTPS configurado, límite de acceso y ausencia de datos sensibles en los eventos.

**Estado del despliegue:** el commit `a284000` se desplegó en Render el 20 de noviembre de 2026. Render informó que el servicio estaba activo y el endpoint de salud respondió 200 desde la instancia. La compilación y 199 pruebas del servidor pasaron localmente; esto no constituye una auditoría externa ni una prueba integral de todos los flujos publicados.

## Protecciones existentes revisadas

- **Acceso y sesiones:** scrypt con sal aleatoria, límite de intentos por cuenta y dirección de conexión, límite de cálculos simultáneos, sesión aleatoria con hash almacenado, expiración a cuatro horas y cookie HttpOnly, SameSite Strict y Secure en HTTPS. La recuperación rota su clave y revoca sesiones anteriores.
- **Recuperación:** no existen enlaces temporales de restablecimiento. Se emplea una clave de recuperación de alta entropía, de un uso y rotación, que no caduca por tiempo; guardarla de forma segura es esencial. Es distinto de un enlace temporal y debe evaluarse si conviene introducir otro mecanismo antes de producción. Los códigos de confirmación de correo duran diez minutos, con límite de intentos.
- **Transporte:** el servidor exige origen público HTTPS salvo localhost. En la prueba pública, HTTP respondió 301 hacia HTTPS. Debe verificarse el comportamiento de HSTS publicado tras el despliegue y la configuración TLS del proveedor.
- **CSRF y CORS:** mutaciones y WebSocket revisados exigen un `Origin` permitido; las cookies son SameSite Strict y los formularios de autenticación exigen JSON. No se comprobó una cabecera permisiva de CORS ni se usa un token CSRF independiente. La validación de origen reduce el riesgo, pero una revisión completa de todas las rutas y una defensa adicional mediante tokens siguen pendientes.
- **XSS:** React escapa el texto y no se encontraron usos de `dangerouslySetInnerHTML`, `innerHTML`, `eval` o `new Function` en la búsqueda realizada. Existe CSP en archivos estáticos, con scripts limitados al propio sitio; se permite `unsafe-inline` para estilos. Esto no constituye una prueba exhaustiva de XSS.
- **Base de datos:** SQLite con claves foráneas, modo WAL, permisos locales privados para la base y consultas parametrizadas en las rutas revisadas. La base no está servida por el directorio estático. No se verificaron los permisos efectivos, cifrado en reposo, acceso del proveedor ni todos los flujos y consultas.
- **Administración:** las rutas revisadas de moderación, privacidad y gestión de encuentros comprueban sesión y rol en el servidor; se requiere origin válido para mutaciones. La concesión de roles no se expone como API pública. Falta autenticación reforzada para administradores y revisión operativa de privilegios.
- **Archivos:** se aceptan JPG, PNG y WebP, comprobando firma y tipo declarado, con máximo de 2 MB de entrada, límite de píxeles, rechazo de animación y conversión en servidor a WebP. Existen cuotas y restricciones de acceso. Esto no equivale a un análisis antivirus o detección de contenido abusivo.
- **Secretos:** no se encontraron secretos de proveedor en las variables `VITE_` inspeccionadas; los valores VAPID públicos o ID de cliente público no son secretos. La plantilla `.env.example` está versionada sin credenciales reales de SMTP, y los archivos `.env` privados y bases están ignorados por Git.
- **Secretos en historial:** se revisaron 1.321 objetos blob alcanzables de los refs locales después de actualizar referencias, con patrones acotados para claves privadas, GitHub, AWS, Stripe, Resend y asignaciones comunes. Dos coincidencias de asignaciones corresponden a fixtures de prueba. No se identificó una credencial real comprometida; no se revocó ninguna. Un análisis por patrones no detecta todas las filtraciones posibles y no cubre repositorios o sistemas externos no inspeccionados.
- **Dependencias:** `npm audit` reportó cero vulnerabilidades conocidas en la fecha de revisión. Todas las dependencias de ejecución tienen referencias detectadas; los paquetes `@types` y TypeScript se utilizan indirectamente por el compilador. No se retiraron paquetes basándose solo en búsqueda textual. La ausencia de avisos conocidos no demuestra ausencia de vulnerabilidades.
- **Precios y pagos:** no se encontró una integración funcional de pagos en el alcance inspeccionado. No hay precios ni cobros que puedan verificarse en el servidor todavía; cualquier integración futura debe validar importes, moneda, productos, idempotencia y eventos del proveedor en el backend.
- **Depuración:** el entrypoint de laboratorio rechaza `NODE_ENV=production`; el arranque de cuentas no expone un interruptor de depuración identificado. Esto no verifica todas las opciones del proveedor.

## Riesgos y próximos pasos por prioridad

1. **Antes de admitir usuarios reales:** copia consistente cifrada fuera del servicio, prueba periódica de restauración y responsable de incidentes. La copia automática de migración en el mismo disco no protege frente a pérdida del proveedor o disco.
2. Verificar en Render los valores efectivos sin divulgarlos, servicios con acceso al disco, HTTPS/HSTS, CDN/proxy y quién administra las credenciales. La autenticación Basic de pruebas no tiene limitador dedicado; configurar protección de fuerza bruta en el borde con IP cliente confiable, evitando bloquear a todos tras el proxy.
3. Revisar la identidad de IP detrás del proxy: actualmente se usa `req.socket.remoteAddress` para varios límites. En un proxy puede representar al intermediario y compartir cuota entre usuarios. No confiar ciegamente en cabeceras reenviadas sin validar el proxy.
4. Crear alertas operativas, retención y revisión de eventos; el registro nuevo por sí solo no vigila incidentes ni vincula intentos por origen. Revisar el equilibrio con privacidad y límites de volumen.
5. Añadir autenticación multifactor y gestión de roles auditada para administradores; inventariar y limitar accesos a Render, dominio, correo y GitHub.
6. Valorar tokens CSRF adicionales y auditar todas las rutas HTTP y WebSocket con pruebas adversariales, además de mejorar CSP para eliminar estilos inline cuando sea factible.
7. Revisar renovación/caducidad del mecanismo de recuperación sin dejar cuentas existentes sin acceso y establecer un procedimiento para credenciales expuestas: revocar en el proveedor, sustituir sin interrupción y verificar la baja de las antiguas.
8. Ejecutar un escáner de secretos especializado con reglas actualizadas, análisis de dependencias continuo y pruebas de penetración independientes antes de abrir el servicio.
9. Añadir los controles de pagos al implementar esa funcionalidad; no hay pagos reales verificados hoy.

## Verificación realizada

- `npm run test:server`: 166 pruebas aprobadas; posteriormente se amplió y volvió a ejecutar la prueba específica de eventos y límites.
- `npm run build:pilot`: compilación correcta.
- `npm audit`: cero avisos conocidos reportados en la consulta.
- HTTP público redirige a HTTPS; la barrera pública respondió 401 a una solicitud no autenticada. No se hicieron intentos de intrusión contra cuentas reales.
- Fuentes técnicas: [OWASP Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html), [OWASP CSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html), [OWASP File Upload](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html), [Node.js Security Best Practices](https://nodejs.org/learn/getting-started/security-best-practices).

## Continuación: endurecimiento adicional

En el código posterior a esta revisión se añadió una comprobación complementaria de Fetch Metadata: una solicitud marcada `Sec-Fetch-Site: cross-site` no pasa la validación de origen, incluso si presenta un Origin incluido en la lista; los clientes sin esa cabecera siguen sujetos a la comprobación estricta de Origin. Esto no es un token CSRF y no mitiga XSS.

Se limitó la recepción de cabeceras y solicitudes y el número de cabeceras. Se reforzó la entrega de archivos estáticos para rechazar archivos o carpetas ocultos, mapas de código y rutas cuyo destino real salga de la carpeta publicada. El riesgo de exposición de archivos ocultos se reproducía si por error existían dentro de esa carpeta; no se encontró evidencia de que estuvieran publicados realmente.

Se agregó un flujo de GitHub Actions para auditoría de dependencias, pruebas de servidor y compilación en pushes/PR y programación. El archivo está preparado en la rama de desarrollo; su ejecución depende de que GitHub Actions esté habilitado. Las ejecuciones programadas de GitHub Actions utilizan la rama predeterminada, por lo que no debe darse por activa la programación hasta integrar el flujo allí y verificarla en GitHub.

Las pruebas locales incluyen 169 pruebas de servidor y la compilación del modo compartido. El conjunto no acredita una auditoría externa ni demuestra el funcionamiento en Render. Los compromisos de operación y las limitaciones anteriores siguen vigentes.


### Escaneo especializado

Se ejecutó localmente Gitleaks 8.30.1 sobre todos los refs Git locales con salida censurada. Señaló cuatro coincidencias históricas de tipo genérico en tres archivos de pruebas; al revisar sus contextos, las cuatro corresponden a claves fijas para fixtures de prueba. Esto no confirma que la configuración desplegada sea distinta: los valores efectivos de Render no se inspeccionaron. No se detectó una clave real comprometida ni se revocó ninguna. Las reglas automáticas pueden tener falsos positivos y falsos negativos.

Se añadió Gitleaks a GitHub Actions con acciones fijadas a una revisión, permisos de solo lectura y comentarios y artefactos desactivados. En pushes analiza el rango seleccionado por la acción, y no debe confundirse una ejecución exitosa con una revisión exhaustiva de todo el historial. La programación semanal requiere que el flujo esté en la rama predeterminada.

### Errores internos en moderación e imágenes

Se corrigieron dos respuestas que devolvían literalmente mensajes de excepciones inesperadas. Los errores de negocio expresamente autorizados mantienen sus explicaciones; errores internos de SQLite, bibliotecas u otros componentes devuelven un mensaje genérico. Se probaron fallos de base de datos inyectados en moderación y carga de imágenes, junto con mensajes válidos de rechazo de archivos. Estos controles no constituyen monitoreo ni resolución automática de incidentes.

Se reforzó además la política de contenido del sitio para impedir objetos incrustados y marcos, manteniendo las excepciones existentes para los estilos actuales. Las pruebas comprueban esas directivas; eliminar `unsafe-inline` requiere trabajo adicional sobre los estilos y una revisión funcional posterior.

### Identidad de cliente detrás de proxies (trabajo local)

El código incorpora resolución común de IP para límites de autenticación, confirmación de correo, Google, solicitudes de la app y Web Push. Por defecto no confía en `X-Forwarded-For`; se usa la conexión directa. La variable opcional `ENTRE_TRUSTED_PROXIES` acepta direcciones o subredes CIDR explícitas separadas por comas. Solo cuando el par inmediato y los saltos posteriores están en esa lista se recorre la cadena desde la derecha; ante datos inválidos se usa el par directo. No se admiten rangos `/0`. La configuración errónea puede permitir suplantación o bloqueos compartidos, incluidas redes compartidas y accesos internos: no inferir confianza solo por ser una red privada.

**El código está desplegado, pero la confianza en proxies no está configurada.** Antes de activarla, identificar y verificar rangos reales de los intermediarios que se conectan a la instancia, cómo se agregan y sanean las cabeceras, acceso por dominio personalizado y `onrender.com`, y tráfico interno; probar intentos con cabeceras falsificadas desde distintos orígenes. Si esos rangos o garantías no pueden establecerse, mantener la función desactivada y abordar los límites en un borde confiable. [Render advierte sobre la necesidad de verificar los proxies](https://render.com/articles/how-to-proxy-analytics-through-your-own-domain). No registrar direcciones en bruto; los límites existentes conservan su propio tratamiento de claves. Las pruebas locales no prueban la infraestructura real.

### Límites de Web Push (trabajo local)

Los cuatro límites de alta y prueba de push ahora guardan una huella de su clave en lugar de direcciones o identificadores en texto. Al volver a usar una clave anterior, su contador se traslada de forma transaccional; si existen ambos registros activos, se suman conservadoramente y se mantiene la expiración más tardía. Las entradas antiguas que no se vuelvan a usar siguen hasta el vencimiento y limpieza normal. La huella es SHA-256 sin clave, por lo que es seudonimización, no anonimización ni cifrado. Cambio desplegado en `a284000`; el despliegue no verifica por sí solo el envío real de notificaciones.

### Verificación operativa posterior

El 20 de noviembre una solicitud HTTPS pública sin credenciales devolvió 401 y las cabeceras HSTS, protección de marcos y tipo de contenido. La ejecución de GitHub Actions del commit desplegado `a284000` aprobó dependencias, pruebas y compilación, pero falló el escaneo de secretos al detectar una contraseña fija de una prueba contra un usuario inexistente. La siguiente ejecución pasó, pero examinó otro commit y no descarta el hallazgo anterior. Se comprobó el contexto: era un dato ficticio de prueba; se reemplazó por un valor aleatorio generado durante la prueba sin desactivar el detector. El dato histórico permanece en Git y las búsquedas históricas pueden volver a señalarlo. Esto no acredita ausencia de otros secretos.

### Señal para la puerta de pruebas

El servidor registra `staging_gate_suspicious` al recibir diez intentos fallidos con cabecera de autorización en una ventana fija de un minuto. Agrupa HTTP y WebSocket por instancia, sin datos de la credencial, dirección ni usuario, y emite como máximo un evento por ventana activa; las solicitudes sin credenciales no se cuentan. El contador vive en memoria, se pierde al reiniciar y no identifica atacantes individuales. Es una señal en los registros, no una alerta automática ni un límite de intentos. Puede haber falsos positivos y no sustituye un control de fuerza bruta en un borde confiable. El código debe desplegarse y verificarse antes de atribuirlo al servicio.
