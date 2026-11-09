# Conexión interna de La Plaza

**Objetivo:** comprobar una Plaza de texto compartida entre cuentas sin habilitarla para el público hasta completar moderación, seguridad y funcionalidades pendientes. Especificación: `../../../../BETA_NEXAFIA_PROPUESTA.md`.

**Diseño:** reutilizar colores, tipografía, hero y botones de Nexafia. La conversación es el centro; en móvil las tarjetas ocupan todo el ancho. Mostrar carga, vacío y error; no incluir personas ni publicaciones inventadas. Los adjuntos e invitaciones no se presentan como activos.

**Arquitectura:** un componente independiente usa la API interna y solo se monta con un indicador explícito en una compilación de pruebas; el fixture activa la API únicamente para pruebas. La compilación pública y el servidor normal continúan intactos.

- [x] Crear prueba de navegador con dos cuentas, publicación, respuesta y recarga; comprobar fallo.
- [x] Implementar lectura, publicación, respuesta y edición/eliminación propias mediante API; aislar estado por cuenta y gestionar errores.
- [x] Verificar navegador en escritorio y móvil, compilaciones y regresiones. No publicar ni habilitar en producción antes de moderación y demás controles.

La prueba aislada de la nueva interfaz requiere compilar con `VITE_ENTRE_PLAZA_REAL=1` y ejecutar `npx playwright test --config playwright.real-plaza.config.ts`. El fixture habilita la API con datos temporales. Después se debe volver a compilar sin ese indicador para las pruebas convencionales. No ejecutar simultáneamente suites que compartan `test-results` o el puerto 4190.

Pendientes para la apertura: reportes y moderación de Plaza, bloqueo desde la interfaz, cuotas, sincronización continua, exploración sin sesión, paginación, imágenes/stickers, solicitudes y conversación privada real. La interfaz interna actual es de texto y no es la versión completa acordada.

Revisión propia: se corrigieron respuestas de red fuera de orden y la confirmación cuando una escritura se guarda pero falla la actualización posterior; se probaron en escritorio y móvil. La batería general tuvo 125/126 y un caso falló al navegar por `ERR_NETWORK_CHANGED`; el caso pasó al repetirse aisladamente. No habilitar para usuarios hasta completar los controles pendientes.
