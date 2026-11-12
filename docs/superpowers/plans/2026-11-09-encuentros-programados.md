# Convocatorias reales de Encuentros

**Objetivo:** permitir que una persona moderadora programe convocatorias futuras y que las cuentas reserven y se conecten a cada una sin modificar reservas anteriores. Especificación: `../../../../BETA_NEXAFIA_PROPUESTA.md`.

**Arquitectura:** una convocatoria tiene un identificador propio, una temática aprobada y hora/cupo inmutables. SQLite v12 registra convocatorias, cancelaciones y una oferta compatible con reservas e historial; las salas y reservas usan el identificador de la convocatoria. Las convocatorias y su UI siguen siendo internas hasta completar gestión operativa y despliegue.

- [x] Probar alta solo por moderación, fechas/cupos válidos, origen, múltiples fechas por temática, reserva, capacidad, reinicio y acceso a sala; confirmar fallo inicial.
- [x] Implementar migración y API de convocatorias, resolución de temática y rutas de reservas/salas sin alterar las convocatorias históricas ni la maqueta existente.
- [x] Conectar programación y reserva a la interfaz interna; probar al menos dos cuentas, móvil/escritorio y ausencia de asistentes ficticios.
- [x] Permitir cancelación anticipada por moderación, bloquear nuevas reservas e ingresos y conservar aviso con motivo en la cuenta de cada persona inscrita.
- [x] Permitir recorrer la lista interna en páginas de hasta 200 convocatorias, incluidos avisos de cancelación propios.
- [ ] Implementar y operar avisos externos fiables, verificar su entrega y definir respuesta para cancelaciones urgentes; el aviso interno requiere que la persona entre a Nexafia.

La paginación usa desplazamiento: si cambia la lista entre consultas, una convocatoria puede moverse entre páginas. No es una instantánea y la pantalla lo advierte. La API limita el desplazamiento a menos de un millón; antes de operar a esa escala se necesita otro método y evaluación de rendimiento.
