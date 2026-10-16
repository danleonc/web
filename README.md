# Entre · prototipo de conexiones humanas

Primer prototipo navegable de la plataforma. **Entre es un nombre de trabajo, sin validación de marca.** Construido con React, TypeScript y Vite. Interfaz adaptable en español; fechas de ejemplo en la zona `America/Santiago`.

## Ejecutar

Requisitos: Node.js 24.19.0 (versión utilizada), npm 11 y, para las pruebas, Chromium. No requiere cuentas de proveedores, claves de IA, variables de entorno, base de datos ni servicios externos.

```sh
npm ci
npm run dev -- --port 4173 --strictPort
```

Desde el entorno cloud, trabajar en `/workspace/web`. Si el directorio de caché de npm del usuario no es escribible:

```sh
npm --cache /workspace/.npm-cache ci --no-audit --no-fund
```

Si reinstalas dependencias mientras Vite está ejecutándose, detén esa instancia y vuelve a iniciarla para renovar su caché de módulos.

Para compilar: `npm run build`. El resultado queda en `dist/`. Para probar la compilación: `npm run preview -- --port 4174 --strictPort`.

## Recorrido implementado

1. Descubrir seis actividades ficticias; filtrar por categoría, buscar sin exigir acentos y filtrar por intereses declarados.
2. Completar un perfil de prueba en dos pasos. Alias, intereses y límites son opcionales. No se pregunta qué relación buscas. Se exige declaración de mayoría de edad para avanzar; **no es verificación de edad o identidad**.
3. Reservar un encuentro, revisar la agenda y cancelar una reserva con confirmación.
4. Entrar a una sala local. Escribir mensajes, mostrar explícitamente una respuesta ficticia y activar o retirar un guion de anfitrión. No hay IA.
5. Probar bloqueo y denuncia simulada. Bloquear oculta mensajes del personaje y lo excluye de posibles reencuentros. La denuncia no se envía ni guarda y no existe equipo de moderación.
6. Evaluar comodidad y expresar interés por reencontrarse con personajes ficticios. No se fabrican aceptaciones recíprocas. Se puede retirar el interés.
7. Editar perfil, descargar datos de prueba y borrarlos con confirmación desde «Cómo funciona».

Todo está etiquetado como prototipo. Los cupos y fechas son ilustrativos, y las salas pueden abrirse sin esperar al horario de ejemplo. No existe sincronización entre dispositivos.

## Datos y privacidad

Perfil, reservas, evaluaciones, bloqueos y solicitudes se guardan en `localStorage` bajo `entre.prototype.v1`. Los mensajes de sala solo viven en memoria y se pierden al abandonar la sala o recargar. No ingresar datos sensibles ni utilizar el prototipo con usuarios reales. La descarga JSON contiene los datos persistidos; la función de borrar reinicia únicamente el estado de este prototipo.

No hay backend, autenticación, autorización de servidor, chat real, IA generativa, notificaciones, pagos ni protección de fotografías implementados. Los límites de perfil son controles de la experiencia de prueba, no una garantía de seguridad contra usuarios reales. Antes de un piloto se necesitan servicios reales, revisión jurídica y controles de seguridad verificables.

## Verificar

```sh
npm run typecheck
npm run build
npm test
```

Playwright usa el Chromium disponible en `/usr/bin/chromium` en este entorno. En otra máquina puede definirse `CHROMIUM_PATH` apuntando a su ejecutable. Si no hay navegador de sistema, ejecutar `npx playwright install chromium` y `PLAYWRIGHT_BUNDLED_BROWSER=1 npm test`.

Los tests arrancan Vite en el puerto 4173 si no hay una instancia existente. Ejecutan el mismo recorrido en escritorio y móvil: reserva, perfil, chat, guion, evaluación, reencuentro, bloqueo, búsquedas, cancelación, exportación, borrado, almacenamiento inválido, acceso directo a sala y foco de diálogos. También realizan comprobaciones automáticas WCAG A/AA con axe en las pantallas principales. No sustituyen la evaluación manual con tecnologías de asistencia ni acreditan cumplimiento completo de accesibilidad.

## Organización

- `src/App.tsx`: navegación, estado global y acciones de usuario.
- `src/pages/`: descubrir, perfil, agenda, conexiones y sala/evaluación.
- `src/data.ts`: actividades y personajes sintéticos, fechas y catálogos.
- `src/store.ts`: carga, validación básica y guardado del estado local.
- `src/components.tsx`: diálogos nativos, avatares y estados vacíos.
- `src/Illustration.tsx`: ilustraciones SVG propias; no se cargan fotos de terceros.
- `src/styles.css`: diseño, adaptación móvil, foco y movimiento reducido.
- `tests/journey.spec.ts`: pruebas funcionales y de accesibilidad automática.
- `docs/STATUS.md`: alcance, trazabilidad y próximos pasos.

El checkout ya está aislado por la plataforma. Utilizar este directorio; no es necesario crear un worktree. El estado de publicación se registra en `docs/DEPLOYMENT.md`; subir código o una rama de archivos estáticos no acredita que la web esté publicada.

## Publicar la demo en GitHub Pages

La compilación usa rutas relativas para funcionar bajo `/web/` y conserva la navegación por fragmentos (`#agenda`, `#profile`, etc.).

Con los cambios de código ya guardados en un commit y acceso de escritura al remoto `origin`:

```sh
npm run deploy:pages
```

Este comando compila y publica únicamente `dist/` en la rama `gh-pages`, sin modificar la rama de código, su índice ni forzar actualizaciones. La rama se marca como generada; el script se detiene si ya existe una rama `gh-pages` ajena a este proyecto. Requiere Git y una identidad de autor configurada.

En GitHub, abrir **Settings → Pages → Build and deployment**, elegir **Deploy from a branch**, rama **gh-pages**, carpeta **/ (root)** y guardar. Es una acción única; disponibilidad y precio dependen de la visibilidad del repositorio y el plan de GitHub. No cambiar la visibilidad del repositorio para publicar sin una decisión expresa.

La dirección prevista es `https://danleonc.github.io/web/`. Solo puede anunciarse como disponible después de comprobar que GitHub Pages terminó el despliegue y sirve la aplicación. El sitio seguirá siendo una demo sin usuarios reales. No almacena secretos ni requiere backend.
