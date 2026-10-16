# Publicación de la demo

Destino autorizado por el usuario: repositorio `danleonc/web` y demo navegable.

- Código fuente: rama `master`.
- Archivos estáticos generados: rama `gh-pages`, directorio raíz.
- Dirección prevista, todavía sin disponibilidad confirmada: `https://danleonc.github.io/web/`.
- Publicación reproducible: `npm run deploy:pages`, desde un checkout con código confirmado y acceso Git de escritura.
- Configuración requerida en GitHub: Settings → Pages → Deploy from a branch → gh-pages → / (root).
- No cambiar la visibilidad del repositorio automáticamente. Si el plan no admite Pages para su visibilidad actual, revisar alternativas con el propietario.

La compilación debe verificarse bajo `/web/`, incluyendo carga de JavaScript/CSS, icono y navegación por fragmentos. Los datos y participantes siguen siendo ficticios y solo se guarda estado local del navegador.

La API de GitHub y la dirección de Pages devolvieron denegación de la política de red del entorno antes de la subida. Se guardaron `api.github.com` y `danleonc.github.io` como adiciones en el borrador de red; guardar el borrador no aplica inmediatamente esos permisos ni activa Pages. El estado remoto se debe comprobar después de habilitar el acceso. No se necesitan nuevos secretos mientras no se diagnostique que la autenticación existente es insuficiente.
