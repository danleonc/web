# Avisos de mensajes privados

Ampliar el mecanismo push interno a mensajes privados entre conexiones aceptadas. Guardar una cola separada por conversación y dispositivo en la transacción del mensaje, agrupar mensajes pendientes y verificar consentimiento, bloqueos y suscripción justo antes del envío. El texto será genérico; al pulsarlo se abrirá Conexiones sin sacar a nadie de una sala.

- [x] Probar destinatarios, privacidad, reintentos idempotentes, bloqueo de conexión, y persistencia de mensajes pendientes.
- [x] Agregar migración v14 y procesar cola con reintentos acotados; evitar perder un mensaje que llegue durante un envío.
- [ ] Antes de publicar: comprobar recepción en teléfonos reales y añadir observabilidad y preferencias detalladas por tipo de aviso.
