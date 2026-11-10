# Avisos push de cancelaciones

Objetivo: avisar de una cancelación a los dispositivos habilitados de personas con reserva, sin incluir datos privados en el aviso. Alcance interno: una instancia SQLite, entrega con reintentos limitados, no garantía de visualización.

- [x] Probar que la cancelación crea una cola persistente únicamente para dispositivos suscritos de asistentes, que sobrevive al reinicio y respeta baja y errores.
- [x] Crear migración v13 y guardar la cola en la misma transacción que la cancelación.
- [x] Procesar la cola en segundo plano, con concurrencia acotada, reintentos, caducidad y limpieza al cerrar el servidor.
- [ ] Antes de publicar: configurar VAPID y HTTPS, probar en teléfonos reales, añadir observabilidad y determinar cómo operar fallos de entrega y cancelaciones urgentes.
