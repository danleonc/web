# Conexiones e invitaciones reales

**Objetivo:** habilitar solicitudes entre cuentas con aceptación expresa, mensajes privados autorizados y revocación por bloqueo. Especificación: `../../../../BETA_NEXAFIA_PROPUESTA.md`.

**Arquitectura:** persistencia SQLite v9, una solicitud por pareja, decisiones por el destinatario y mensajes idempotentes solo tras aceptación. Se reutiliza la API interna y sus verificaciones de cuenta/origen y bloqueo. El contenido no tiene cifrado de extremo a extremo. Mantener desactivado en producción hasta completar controles, interfaz y operación.

- [x] Pruebas de API entre tres cuentas: solicitud desde contenido visible, aceptación explícita, rechazos, duplicados, aislamiento, persistencia y bloqueo; confirmar fallo inicial.
- [x] Implementar migración, estados, mensajes y revocación atómica al bloquear. Probar autorización, reintentos y migraciones existentes.
- [x] Conectar invitaciones y mensajes a la interfaz interna, con pruebas de dos cuentas en móvil/escritorio y estados de consentimiento.

Incremento interno: se habilitan mensajes de texto, reporte y bloqueo. Mientras la sección está visible se consultan periódicamente conexiones y mensajes (aproximadamente cada cuatro segundos después de terminar la solicitud anterior); no es entrega instantánea. Se implementó el aviso push genérico para mensajes, pendiente de configuración y prueba real de dispositivo. La lista está limitada y falta paginación. No hay cifrado de extremo a extremo, retención definida, exportación/eliminación de cuenta ni adjuntos. Los controles de publicación y despliegue siguen pendientes.
