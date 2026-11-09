# Reportes y moderación de La Plaza

**Objetivo:** permitir denunciar publicaciones y respuestas reales y revisarlas con rol autorizado, manteniendo la función limitada al entorno de prueba. Especificación: `../../../../BETA_NEXAFIA_PROPUESTA.md`.

**Arquitectura:** migración SQLite v7 con reportes específicos de Plaza y visibilidad del contenido; evidencia tomada del servidor; rutas de reportes protegidas y decisiones humanas auditadas. La interfaz reutiliza los componentes de convivencia existentes. No convertir automáticamente denuncias en sanciones.

**Límites:** sin exposición pública; sin suplantación de autor ni evidencia; bloqueo bidireccional; reportes propios rechazados; límites y deduplicación; ningún acceso a la cola sin rol; no prometer atención humana inmediata.

- [x] Pruebas de API entre múltiples cuentas y moderador: permisos, origen, deduplicación, evidencia frente a edición/borrado, no ocultación automática, resolución y persistencia. Observar fallo.
- [x] Implementar migración, cola y decisiones de ocultar/cerrar, auditoría y límites; verificar migración de datos existentes y regresión de servidor.
- [x] Conectar reportes y revisión a la interfaz interna, probar en escritorio y móvil; mantener desactivada por defecto.

La moderación de Plaza permite cerrar o retirar contenido, pero no implementa sanciones de cuenta ni apelaciones de retiradas de Plaza. Las restricciones y apelaciones de encuentros existentes no sustituyen esos flujos. Quedan pendientes una política de retención de evidencia, medidas antispam de publicación, procesos humanos y responsables. La existencia de la cola no garantiza revisión ni atención inmediata.

Las pruebas del entorno interno deben ejecutar escritorio y móvil en procesos separados para reiniciar la base y el límite real de correo entre proyectos: `npx playwright test --config playwright.real-plaza.config.ts --project desktop`, seguido por el mismo comando con `--project mobile` (tras compilar con `VITE_ENTRE_PLAZA_REAL=1`).
