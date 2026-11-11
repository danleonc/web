# Solicitudes de eliminación: registro interno

Preparar una cola funcional y separada para solicitar eliminación, no una eliminación automática. La cuenta puede registrar o cancelar su solicitud; una persona con rol de privacidad concedido fuera de la API puede ver la cola y acusar recibo. No se afirma que haya personal operativo ni que los datos o respaldos se hayan eliminado. Función habilitada solo en el entorno interno. El borrado efectivo, sus reglas de retención, autenticación reforzada, seguimiento y revisión jurídica siguen pendientes.

- [x] Probar autorización por sesión y origen, aislamiento, idempotencia, versiones concurrentes, rol específico, cancelación y persistencia.
- [x] Añadir migración, API y asignación local del rol de privacidad sin exponer escalada de permisos.
- [x] Conectar controles internos para la cuenta y la cola autorizada, explicando que registrar o acusar recibo no borra nada.
- [ ] Antes de operar: implementar eliminación efectiva y tratamiento de respaldos y evidencias, definir atención y plazos, añadir auditoría completa y paginación de cola, autenticación reforzada y revisión legal. No habilitar para público hasta completar estos puntos.

El rol es independiente de moderación y se asigna o retira solamente desde la administración local de la base, usando `node scripts/privacy-operator.mjs grant|revoke USUARIO [RUTA_BASE]`. La cuenta ya debe existir; el script no crea usuarios. Es una herramienta técnica interna, no un procedimiento de producción ni una concesión de acceso ejecutada por este cambio. No se guardan notas libres ni se envían correos. La cola muestra como máximo 100 solicitudes y solo registra el último acuse: no sustituye un sistema de seguimiento ni una auditoría íntegra.

Referencia para revisión profesional en Chile, consultada el 11 de noviembre de 2026: la [Ley 21.719 en la Biblioteca del Congreso Nacional](https://www.bcn.cl/leychile/navegar?f=2026-12-01&i=1209272) indica entrada en vigencia el 1 de diciembre de 2026. El flujo interno anterior no acredita cumplimiento legal ni sustituye el análisis de las normas aplicables y sus excepciones.
