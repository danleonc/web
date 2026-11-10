# Bloqueos de cuentas desde La Plaza

**Objetivo:** permitir bloquear y desbloquear personas de contenido visible, conservando el bloqueo en la cuenta y aplicándolo entre Plaza y encuentros. Especificación: `../../../../BETA_NEXAFIA_PROPUESTA.md`.

**Arquitectura:** reutilizar la tabla `blocks` y las identidades compartidas existentes. La API interna recibe la referencia a un contenido visible, no un identificador arbitrario; valida sesión, origen, dueño y visibilidad. Un bloqueo cierra las sesiones de encuentro propias como el bloqueo existente; desbloquear actualiza almacenamiento e identidad. La UI conserva los patrones y colores actuales.

- [x] Prueba de API con dos cuentas: límites de origen, bloqueo propio, contenido ajeno no visible, bloqueo bidireccional, persistencia, gestión/desbloqueo y aislamiento entre cuentas. Verificar fallo inicial.
- [x] Implementar API y sincronización con encuentros y probar reglas de servidor y regresión de salas.
- [x] Integrar controles de bloqueo/desbloqueo en Plaza interna y probar dos cuentas en escritorio y móvil; conservar la función desactivada fuera del entorno interno.
