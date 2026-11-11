# Solicitudes de eliminación: registro interno

Preparar una cola funcional y separada para solicitar eliminación, no una eliminación automática. La cuenta puede registrar o cancelar su solicitud; una persona con rol de privacidad concedido fuera de la API puede ver la cola y acusar recibo. No se afirma que haya personal operativo ni que los datos o respaldos se hayan eliminado. Función habilitada solo en el entorno interno. El borrado efectivo, sus reglas de retención, autenticación reforzada, seguimiento y revisión jurídica siguen pendientes.

- [x] Probar autorización por sesión y origen, aislamiento, idempotencia, versiones concurrentes, rol específico, cancelación y persistencia.
- [x] Añadir migración, API y asignación local del rol de privacidad sin exponer escalada de permisos.
- [x] Conectar controles internos para la cuenta y la cola autorizada, explicando que registrar o acusar recibo no borra nada.
- [x] Añadir un inventario orientativo de cantidades en la base activa para solicitudes vigentes; restringirlo al rol de privacidad e impedir que consulte su propia solicitud.
- [x] Guardar en una transacción los cambios de solicitud y su historial de recepción, cancelación y reingreso; incluir el historial propio en la copia parcial sin identificar al operador.
- [x] Paginar la cola interna en bloques de 50 solicitudes y probar la consulta de más de 100 registros. La cola puede cambiar entre consultas.
- [ ] Antes de operar: implementar eliminación efectiva y tratamiento de respaldos y evidencias, definir atención y plazos, añadir auditoría completa, autenticación reforzada y revisión legal. No habilitar para público hasta completar estos puntos.

El rol es independiente de moderación y se asigna o retira solamente desde la administración local de la base, usando `node scripts/privacy-operator.mjs grant|revoke USUARIO [RUTA_BASE]`. La cuenta ya debe existir; el script no crea usuarios. Es una herramienta técnica interna, no un procedimiento de producción ni una concesión de acceso ejecutada por este cambio. No se guardan notas libres ni se envían correos. La cola se consulta por páginas de hasta 50 y no es una instantánea: los cambios concurrentes pueden desplazar registros. El historial conserva los cambios de estado posteriores a su incorporación; las solicitudes anteriores se señalan como estado heredado sin inventar eventos. No registra las concesiones de rol ni sustituye una auditoría íntegra o un sistema de seguimiento.

El inventario cuenta relaciones directas, colas vinculadas y coincidencias literales del identificador en estados de sala, mensajes y evidencias. Esa búsqueda no encuentra necesariamente alias u otras referencias y no inspecciona respaldos, proveedores ni datos locales. Recorre contenido de tablas y necesita una estrategia y pruebas de rendimiento antes de operar a escala. No decide qué debe borrarse ni ejecuta la eliminación.

Referencia para revisión profesional en Chile, consultada el 11 de noviembre de 2026: la [Ley 21.719 en la Biblioteca del Congreso Nacional](https://www.bcn.cl/leychile/navegar?f=2026-12-01&i=1209272) indica entrada en vigencia el 1 de diciembre de 2026. El flujo interno anterior no acredita cumplimiento legal ni sustituye el análisis de las normas aplicables y sus excepciones.
