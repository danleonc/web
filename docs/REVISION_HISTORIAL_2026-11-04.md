# Revisión de pruebas de historial

Durante la auditoría local en Windows, tres pruebas que envían más de 50 mensajes en ráfaga fallaron esperando la última actualización. En el caso aislado se registró cierre 1013 «Conexion lenta» en emisor y receptor: el servidor aplicó el límite de 128 KiB de datos pendientes al emitir estados sucesivos.

Las pruebas de `accounts`, `rooms` y `replies` ahora esperan el ACK del mensaje y la actualización del destinatario antes de enviar el siguiente. Siguen verificando que se retengan los últimos 50 mensajes, la persistencia tras reiniciar y el tratamiento de citas e idempotencia. No cambia el comportamiento de producción ni se debilita la protección frente a conexiones lentas.

Verificación local: 51 pruebas de servidor aprobadas; builds de demo y piloto aprobados; pruebas dirigidas de `ecosystem` y `plaza-invitations`, 20 aprobadas con salida 0 en escritorio y móvil. Una ejecución anterior de navegador quedó abierta; su causa no está determinada. Esto no constituye una prueba de carga, ni valida que una ráfaga equivalente sea aceptada sin interrupción, ni reemplaza la validación en dispositivos o con participantes reales.
