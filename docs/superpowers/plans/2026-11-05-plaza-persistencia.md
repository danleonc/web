# Persistencia de La Plaza

**Objetivo:** sentar la base de publicaciones y respuestas compartidas sin habilitar una Plaza pública incompleta. Especificación: `../../../../BETA_NEXAFIA_PROPUESTA.md`.

**Arquitectura:** ampliar SQLite mediante migración v6 y añadir un módulo de almacenamiento de Plaza. La autenticación, API, interfaz y moderación se conectarán en incrementos posteriores antes de abrir a usuarios.

**Restricciones:** no datos ficticios presentados como reales; respetar bloqueos en ambos sentidos y propiedad; no exigir intención romántica; mantener datos existentes.

- [x] Crear pruebas con dos cuentas y reinicio para publicaciones, respuestas, propiedad y bloqueo; comprobar fallo inicial.
- [x] Añadir migración y módulo de persistencia: límites de texto, autorización por propietario, orden acotado, filtros de bloqueo y borrado en cascada.
- [x] Ejecutar pruebas específicas y servidor completo, verificar compilación y revisar los cambios. No conectar al sitio público hasta contar con API, interfaz y moderación.
