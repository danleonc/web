# Nexafia: infraestructura de pruebas y camino a publicación

## Estado verificado · 12 de noviembre de 2026

Se creó en Render el servicio `nexafia-pruebas`, en el workspace del propietario, inicialmente con el commit `79704ff` de `codex/nexafia-desarrollo`. La URL es https://nexafia-pruebas.onrender.com. Se añadió una barrera de acceso descrita abajo; usar solo datos ficticios, pues no es un entorno autorizado para información personal ni lanzamiento público. La compilación y `/api/health` respondieron correctamente. Render creó el proyecto con el nombre de entorno `Production`; esa etiqueta predeterminada no convierte este servicio en producción de Nexafia.

Servicio Node 24.19.0, una instancia de 0,5 CPU y 512 MB, disco persistente de 1 GB montado en `/var/data`, base en `/var/data/entre.sqlite`, despliegue automático desactivado y health check `/api/health`. Arranque: `ENTRE_PUBLIC_ORIGIN="$RENDER_EXTERNAL_URL" npm start`. El propietario autorizó una estimación de USD 7,25 mensuales más impuestos y eventuales excedentes; revisar la facturación real en Render.

Verificación: el archivo SQLite existía y el directorio admitía escritura. Se escribió un marcador sintético, se reinició el servicio, se comprobó que el marcador y el archivo SQLite seguían disponibles en la nueva instancia y se eliminó el marcador. La API de salud volvió a responder. Esto comprueba persistencia de archivos en un reinicio, no una restauración de respaldo ni la integridad de transacciones bajo carga. El correo SMTP, Google y push real no están configurados; Plaza, conexiones y encuentros compartidos siguen desactivados en este despliegue. La UI de la Plaza muestra explícitamente contenido de ejemplo. No se probaron cuentas reales ni WebSocket autorizado en el proveedor. La revisión legal no se ha completado.

### Acceso de pruebas activado en Render

El servidor incorpora una puerta HTTP Basic opcional para pruebas. En Render se configuró `ENTRE_STAGING_PASSWORD` y se desplegó el commit `809d794`. Se comprobó desde fuera que la página, `/api/session` y el acceso WebSocket sin credenciales devuelven 401, mientras `GET /api/health` devuelve 200. El acceso con la clave real aún debe comprobarlo el propietario; el acceso autorizado y WebSocket se probaron en navegador solo en un fixture local. La clave debe ser aleatoria, generada por un gestor de contraseñas o por Render; no usar frases ni reutilizar contraseñas. Acepta el formato alfanumérico generado en el panel, Base64 o Base64URL, con al menos 32 caracteres; el formato por sí solo no garantiza aleatoriedad. El usuario de la puerta es `nexafia`. El secreto se guarda en las variables privadas de Render, no en Git ni en el chat. Si está vacío o tiene formato inválido el proceso no inicia; si la variable falta, la puerta está desactivada. Cambiar código y configuración coordinadamente y verificar la respuesta antes de considerar el acceso protegido.

La puerta cubre la aplicación, la API y WebSocket; solo permite sin clave `GET /api/health`. Es una contraseña compartida para un entorno de datos sintéticos, no reemplaza cuentas individuales, MFA, protección ante fuerza bruta, revisión independiente ni un sistema empresarial de acceso. Navegadores pueden guardar las credenciales durante su sesión. Durante la activación hubo una interrupción temporal por incompatibilidad con el formato generado; se corrigió y el servicio volvió a estar en línea.

Evaluación inicial del 5 de noviembre de 2026, actualizada con el estado interno del 10 de noviembre. Propuesta operativa, no una contratación ni una certificación. Existen versiones compartidas internas de La Plaza, solicitudes, chat privado y encuentros programados, pero siguen desactivadas en el arranque normal y falta completar su operación, pruebas y despliegue. No es una aplicación de citas y no exige declarar intenciones románticas.

**Comprobación del 10 de noviembre:** la pestaña de Render estaba en la creación de un servicio web, paso de configuración, y ofrecía conectar un proveedor Git. Esa pantalla no confirma ningún despliegue y no demuestra si existen o no otros servicios en la cuenta. No se creó ni contrató un servicio durante esta comprobación; no se vinculó GitHub ni se cambió el plan.

## Selección provisional

Para comenzar, evaluar Render con Node 24.19.0 en runtime nativo, una sola instancia pagada `0.5c-512mb`, un disco persistente de 1 GB para SQLite y correo transaccional SMTP. El borrador [render.staging.example.yaml](../deploy/render.staging.example.yaml) no se ha validado ni ejecutado en Render. Es exclusivamente un punto de partida para pruebas con datos sintéticos: el servicio web tendrá URL pública y no queda protegido por el mero hecho de llamarse pruebas. Implantar control de acceso real antes de información privada y antes de invitar a terceros.

La elección de runtime nativo evita asumir que el montaje de un disco de Render será escribible por el usuario sin privilegios de nuestro Dockerfile: permisos y escritura deberán comprobarse en el entorno real. Confirmar el tamaño de memoria con pruebas de carga antes de pensar en apertura. Una instancia con disco no escala horizontalmente y tendrá interrupción durante despliegues; SQLite no es una solución de alta disponibilidad. No añadir instancias ni despliegues simultáneos que escriban en esa base. Diseñar una migración a PostgreSQL cuando la capacidad lo requiera.

El proxy del proveedor puede hacer que el límite actual por IP se comparta entre visitantes; no confiar en cabeceras de proxy arbitrarias. Hay que configurar una solución de IPs y límites en el borde que se pueda verificar antes de recibir público.

Fuentes: [servicios web y WebSocket](https://render.com/docs/websocket), [discos persistentes y snapshots](https://render.com/docs/disks), [Blueprint](https://render.com/docs/blueprint-spec), [planes de cómputo](https://render.com/docs/compute-plans), [runtime nativo](https://render.com/docs/native-runtimes).

## Estimación inicial, no cotización

| Concepto | Referencia | Estado |
| --- | --- | --- |
| Un servicio siempre activo | Render publica desde USD 7/mes para 0,5 CPU y 512 MB | Precio de referencia; comprobar factura y condiciones |
| Disco de 1 GB | USD 0,25/GB/mes según documentación de costos de Render | Capacidad mínima propuesta, puede crecer |
| Correo transaccional | Resend gratuito: 3.000/mes y 100/día | Requiere cuenta, dominio verificado y prueba de entrega; no contratado |
| Subtotal ilustrativo | USD 7,25/mes por **un** servicio y disco, si se cumplen esas tarifas y se usa correo gratuito | No incluye impuestos, transferencias excedentes, backups externos, dominio ni otros cargos |
| Dos ambientes activos | USD 14,50/mes usando dos servicios y dos discos iguales | Solo infraestructura indicada; probar separación y costos reales |

Fuentes: [referencia de precio del servicio](https://render.com/articles/best-railway-alternatives), [precio del disco](https://render.com/articles/how-much-does-cloud-application-hosting-cost-for-small-businesses), [precios de Resend](https://resend.com/pricing?product=transactional). Mantener una reserva orientativa de CLP 30.000–50.000 al mes para infraestructura y revisar conversión, impuestos, cuotas, soporte y condiciones antes de contratar. No incluye desarrollo, moderación, difusión ni asesoría jurídica.

## Antes de provisionar el entorno de pruebas

- [ ] Disponer de una cuenta Render del propietario y medio de pago, revisar importe final y región. No compartir credenciales por chat.
- [ ] Revisar qué commit se desplegará: el repositorio local contiene cambios no publicados. La integración de un repositorio remoto no incluye automáticamente archivos locales sin subir.
- [ ] Confirmar que un acceso restringido protege tanto la web como API y WebSocket. Si aún no existe, utilizar exclusivamente datos sintéticos; no asumir privacidad por tener una URL poco conocida.
- [ ] Crear el servicio de pruebas separado del futuro entorno de producción, con una base distinta. Conservar el sitio actual y no modificar DNS o correo existentes.
- [ ] Configurar `ENTRE_PUBLIC_ORIGIN` con el origen HTTPS exacto; no guardar secretos en el repositorio. Configurar SMTP solo mediante el almacén de secretos del proveedor; comprobar que el proceso puede escribir SQLite y WAL en el disco montado.
- [ ] Verificar `/api/health`, TLS, cuenta, confirmación de correo, dos sesiones, reserva, WebSocket, reconexión, reinicio y persistencia con datos sintéticos. La plantilla habilita solamente la funcionalidad actualmente existente.
- [ ] Antes de datos reales: programar copia consistente de SQLite mediante `scripts/backup-db.mjs`, almacenarla cifrada fuera del servicio y probar una restauración aislada. Los snapshots de disco del proveedor no sustituyen una copia consistente de base de datos.
- [ ] Preparar alertas, límites de gasto, retención, acceso a secretos, responsable operativo, moderación y recuperación ante incidentes.

La verificación de correo mediante SMTP es independiente de la verificación de edad o identidad. El correo real y los permisos de entrega todavía no se han probado. Render indica que su plan gratuito bloquea los puertos SMTP 25, 465 y 587; evaluar con el servicio pagado y un proveedor adecuado. [Restricción de SMTP](https://render.com/changelog/free-web-services-will-no-longer-allow-outbound-traffic-to-smtp-ports).

## Apertura solo después de completar producto

1. La Plaza compartida: publicaciones y respuestas persistentes, permisos de dueño, bloqueos y reportes efectivos, sin contenido ficticio presentado como real.
2. Conexiones: solicitudes aceptadas explícitamente, rechazo y revocación; chat privado real solo entre personas autorizadas.
3. Encuentros: programación de convocatorias, reservas y salas reales, cancelación, capacidad, quórum y manejo de desconexiones.
4. Cuenta y datos: perfil, controles de privacidad, exportación y eliminación en servidor, retención y procedimientos operativos.
5. Seguridad y confianza: moderación humana con cobertura real, procedimientos de abuso y revisión legal de términos, privacidad y tratamiento de datos en Chile.
6. Pruebas integrales con múltiples cuentas, teléfonos y escritorio, recuperación de copias, límites de capacidad y costo; preparar una URL de producción y verificarla después del despliegue.

No hay usuario, demanda, ingreso, cumplimiento jurídico ni prueba de proveedor reales acreditados por este documento.
