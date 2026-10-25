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

## Resultado de esta publicación

- Fuente subida correctamente a `origin/master`: commit inicial `41c4847f7f25700031c32bbd77a6fc90e72c89f4`.
- Archivos de la compilación subidos correctamente a `origin/gh-pages`: `98e9451cb00ae47a6b06682a98a263670b241b64`.
- Verificación Git: ambas referencias remotas existen y coinciden con los commits enviados.
- Validación: compilación, 16 pruebas de navegador y prueba de aplicación estática bajo `/web/` correctas, sin fallos de carga de JS/CSS/icono ni de recarga de navegación.
- Pendiente: activar o comprobar GitHub Pages. La solicitud `gh api repos/danleonc/web/pages` sigue devolviendo `Forbidden` desde la política de red del entorno. Esto no demuestra que Pages esté desactivado ni que las credenciales sean inválidas. No se ha confirmado que la URL pública responda.

El propietario puede completar la activación en `https://github.com/danleonc/web/settings/pages` seleccionando **Deploy from a branch → gh-pages → / (root) → Save**. Los requisitos del plan/visibilidad se deben respetar sin hacer público el repositorio automáticamente. Después se debe comprobar la dirección que GitHub muestre y su despliegue antes de dar la demo por disponible.

## Laboratorio compartido · 19 de octubre de 2026

El código fuente incluye una API local y una vista de desarrollo para probar presencia, texto, stickers y quórum entre navegadores. `npm run deploy:pages` sigue publicando solo la maqueta estática: no sube el servidor ni habilita usuarios conectados. La vista compartida se excluye del build público. Para probarla en desarrollo, consultar `docs/SALAS_COMPARTIDAS.md`; su despliegue como servicio requiere una etapa posterior.

## Cuentas y persistencia · preparación para HostGator

Se añade un build separado `npm run build:pilot` y un servidor `npm start` que sirve web/API con SQLite persistente. Se preparan Docker, Compose, una referencia de proxy y copias consistentes. El soporte de HostGator confirmó al usuario que el Plan Personal compartido no es adecuado para Node.js 24, procesos permanentes y WebSocket. Se necesita un VPS u otro alojamiento compatible. No se han contratado servicios, accedido al hosting ni cambiado archivos del sitio, DNS, SSL o correo de `polysdeals.com`.

El destino provisional propuesto es `entre.polysdeals.com`, pendiente de confirmar y crear. GitHub Pages continúa sirviendo exclusivamente la maqueta; publicar `gh-pages` no habilita las cuentas. La ejecución en un contenedor local no demuestra publicación en HostGator. Ver `docs/CUENTAS_Y_DESPLIEGUE.md` para requisitos y pasos.

## Afinia · tres espacios · 25 de octubre de 2026

El build estático incorpora La Plaza, Conexiones y Encuentros con la identidad de Afinia. La entrada predeterminada es La Plaza; `#discover` sigue abriendo Encuentros y se conservan los enlaces anteriores. Publicaciones, respuestas e invitaciones de esta iteración son locales al navegador y no requieren otro proveedor para probar la maqueta. Las cuentas y salas del piloto siguen siendo un build separado. Esta entrega no despliega un servidor ni modifica DNS o archivos de `polysdeals.com`.
