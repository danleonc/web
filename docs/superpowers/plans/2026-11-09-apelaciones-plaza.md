# Apelación de contenido retirado en La Plaza

**Objetivo:** permitir que la persona autora consulte y apele una retirada de su contenido, con revisión por otra persona moderadora. Especificación: `../../../../BETA_NEXAFIA_PROPUESTA.md`.

**Arquitectura:** SQLite v8 registra apelaciones únicas por decisión y revisión auditada. Las rutas usan la cuenta y rol de servidor; no revelan la identidad ni el motivo privado de quien reporta. La restauración no invalida otras retiradas vigentes ni revive contenido eliminado.

- [x] Probar permisos, una apelación por decisión, auditoría, revisión por moderador distinto y persistencia; confirmar fallo inicial.
- [x] Implementar API y migración; comprobar restauración, rechazos y acciones de moderación múltiples sobre el mismo contenido.
- [x] Conectar consulta y revisión a la interfaz interna y verificar en escritorio y móvil. Mantener desactivada en la versión publicada.
