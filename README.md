# Afinia · prototipo de conexiones humanas

Prototipo navegable con **La Plaza, Conexiones y Encuentros**. **Afinia es el nombre de trabajo de la interfaz, sin validación de marca**; los identificadores técnicos de Entre se conservan para proteger datos existentes. Construido con React, TypeScript y Vite. Interfaz adaptable en español; fechas de ejemplo en la zona `America/Santiago`.

La entrada es La Plaza: publicaciones y respuestas locales, filtros, guardados, invitaciones de ejemplo y enlaces a encuentros relacionados. Conexiones distingue afinidades e invitaciones pendientes; «Seguir conversando» en una respuesta conserva el comentario de origen y permite volver a él o explorar un encuentro relacionado. Encuentros mantiene reservas, recepción y dinámica grupal. **Los espacios nuevos no conectan con personas reales**; están separados del backend de cuentas y salas persistentes. Alcance y próximos pasos: [docs/ECOSISTEMA.md](docs/ECOSISTEMA.md).

## Diseño y UI

El repositorio incluye la skill `frontend-design` de Anthropic en
[`.agents/skills/frontend-design/SKILL.md`](.agents/skills/frontend-design/SKILL.md),
con un [brief de Afinia](.agents/skills/frontend-design/references/afinia.md).
[`AGENTS.md`](AGENTS.md) indica utilizarla en las tareas de interfaz. La copia de
origen, su revisión y licencia se describen en
[UPSTREAM.md](.agents/skills/frontend-design/UPSTREAM.md). La instalación es local
al proyecto y no requiere conectar 21st.dev ni contratar servicios adicionales.
La primera aplicación y su comparación visual se documentan en la
[auditoría de La Plaza](docs/diseno/Auditoria_La_Plaza.md).
La continuación cubre [Conexiones y Encuentros](docs/diseno/Conexiones_y_Encuentros.md),
con estados, acciones y composición móvil más claros.

## Ejecutar

**Nuevo: cuentas y persistencia.** `npm run build:pilot` prepara una compilación separada; `ENTRE_PUBLIC_ORIGIN=http://127.0.0.1:8788 npm start` sirve la web y API con SQLite persistente. La sección **Mi cuenta y encuentros** permite registrar/iniciar/recuperar cuenta y confirmar correo antes de reservar o conversar. El envío real requiere configurar SMTP; no se solicita documento ni biometría. El modo público estático y el laboratorio anterior siguen separados. Instrucciones, límites y preparación para HostGator: [docs/CUENTAS_Y_DESPLIEGUE.md](docs/CUENTAS_Y_DESPLIEGUE.md).

Requisitos: Node.js 24.19.0 (versión utilizada), npm 11 y, para las pruebas, Chromium. La maqueta y el laboratorio no requieren cuentas de proveedores, claves de IA ni servicios externos. El piloto usa SQLite incluido en Node y requiere `ENTRE_PUBLIC_ORIGIN`; ver la guía anterior.

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

Para probar salas compartidas entre navegadores en desarrollo:

```sh
npm run dev:shared
```

Inicia Vite (4173) y una API local (8787). En la app, abrir **Laboratorio local**, preparar alias de prueba y conectar desde tres perfiles independientes de navegador. Las pestañas de una misma sesión cuentan una vez. Esta vista comparte mensajes y presencia reales entre esas sesiones; no aparece en la compilación pública. Alcance, privacidad, reglas y límites: [docs/SALAS_COMPARTIDAS.md](docs/SALAS_COMPARTIDAS.md).

## Recorrido implementado

1. Descubrir tres convocatorias ficticias por temas amplios; filtrar por categoría, buscar sin exigir acentos y filtrar por intereses declarados.
2. Completar un perfil de prueba en dos pasos. Alias, intereses y límites son opcionales. No se pregunta qué relación buscas. Se exige declaración de mayoría de edad para avanzar; **no es verificación de edad o identidad**.
3. Reservar un encuentro, revisar la agenda y cancelar una reserva con confirmación.
4. Entrar a la recepción local, comprobar un quórum de 3–6 asistentes ficticios e iniciar el encuentro. Escribir mensajes, enviar stickers o una imagen, mostrar explícitamente una respuesta ficticia y activar o retirar un guion de anfitrión. No hay IA.
5. Adjuntar una imagen en publicaciones o comentarios de La Plaza (con texto opcional en las respuestas) o en la sala, ocultar/reportar contenido y bloquear personajes. La maqueta guarda reportes locales y permite simular votos de expulsión; no los envía a un equipo humano. En el piloto con cuentas hay cola de revisión, expulsión compartida, suspensiones/baneo y apelación con roles de moderación. Ver [Imágenes y convivencia](docs/IMAGENES_Y_CONVIVENCIA.md).
6. Evaluar comodidad y expresar interés individual o grupal por reencontrarse con personajes ficticios. No se fabrican aceptaciones recíprocas. Se puede retirar el interés.
7. Editar perfil, descargar datos de prueba y borrarlos con confirmación desde «Cómo funciona».

Las fotos de galería o cámara se reducen automáticamente antes de compartir. Se admiten originales JPG, PNG o WebP de hasta 20 MB; el cargador elige un formato compatible con el navegador y reduce calidad y resolución cuando hace falta. No es necesario comprimirlas manualmente.

La recepción, los tiempos y las decisiones de la guía se pueden probar: preguntas de 90 segundos, una extensión de 30 segundos, pasar/escuchar/listo, mayoría para otra pregunta y contingencias por falta de quórum. El banco tiene hasta tres preguntas por temática. Detalles: [docs/GUIA_SALAS.md](docs/GUIA_SALAS.md).

Todo está etiquetado como prototipo. Los cupos y fechas de la maqueta son ilustrativos, y sus salas pueden abrirse sin esperar al horario de ejemplo. La sincronización entre navegadores se prueba únicamente en el laboratorio local separado.

## Acceso y confianza

Exploración abierta y participación del piloto con cuenta, correo confirmado y
declaración 18+. La confirmación no acredita identidad ni edad. Se conserva el
alias público y la dirección queda privada. La demo estática explica el flujo
desde **Acceso** y conserva sus pruebas locales; no simula cuentas o envío real.

Configuración SMTP, protección de códigos, migración v3 y límites:
[Acceso y correo](docs/ACCESO_Y_CORREO.md). El acceso directo con Google está implementado en el piloto y requiere configurar
un cliente OAuth web. No verifica identidad civil ni edad.
[Configuración y pruebas de Google](docs/GOOGLE_LOGIN.md).

## Conversación y cuidados en las salas

La sala prioriza el historial y el compositor. **Plegar guía** mantiene la
pregunta visible y el plazo en marcha; **Mostrar controles** recupera listo,
pasar, escuchar y la solicitud por mayoría de otra pregunta. «Cómo funciona la
guía» reúne reglas y extensión; en la sala local también permite desactivar el
guion. No se incorpora IA generativa.

**Personas y seguridad** reúne presencia, participación, normas y votación.
Silenciar mensajes afecta solo a tu vista hasta salir, con restauración desde
el mismo panel; no cambia bloqueos, quórum ni votos. Los reportes y bloqueos
conservan el alcance de cada modo. Una votación activa tiene acceso visible en
el chat aunque el panel esté cerrado. Abrir controles conserva el borrador.

El historial sigue los mensajes nuevos cuando ya estás al final. Si estás
leyendo más arriba, ofrece **Ver mensajes nuevos**, sin mover la página.
El chat público sigue siendo una simulación local; los envíos compartidos se
prueban en laboratorio o piloto. Diseño: [Conversación y cuidados](docs/diseno/Conversacion_y_cuidados.md).

## Respuestas con contexto

En las salas, el chat privado de prueba y los comentarios de La Plaza, toca
**Responder** para citar un mensaje. En móvil también puedes deslizarlo hacia
la derecha. La vista previa permite quitar la cita sin borrar el borrador;
al enviar, la referencia queda asociada a esa respuesta. Tocar la cita vuelve
al original y lo enfoca. Puedes responder con texto, stickers y, donde ya se
admiten, imágenes.

Las citas guardan el ID, sin duplicar el contenido original. Si se elimina,
se bloquea o sale del historial, aparece «Mensaje original no disponible».
La Plaza y los chats de la demo siguen siendo locales. El piloto de salas
compartidas valida el origen en servidor y conserva referencias en el historial.
Diseño y alcance: [Agenda, recepción y respuestas](docs/diseno/Agenda_recepcion_y_respuestas.md).

## Stickers

Hay **60 stickers en diez colecciones de personajes sin frases**. El selector ofrece búsqueda, colecciones favoritas, estrellas manuales, favoritos por frecuencia de uso, recientes y confirmación antes de enviar. También se puede responder con stickers en **La Plaza**, conservando el borrador de texto. En las salas, abrir el botón de stickers junto al mensaje. Para probarlos también en una conversación individual: **Conexiones → Probar chat privado** (requiere un perfil de prueba). Este chat no implica que alguien haya aceptado una solicitud ni contacta a otras personas.

Los favoritos y recientes se comparten entre ambas vistas; los mensajes siguen siendo efímeros. Detalles, catálogo, ampliación y requisitos de la mensajería real: [docs/STICKERS.md](docs/STICKERS.md).

## Datos y privacidad

Perfil, reservas, evaluaciones, bloqueos, solicitudes, publicaciones/respuestas/guardados/invitaciones de Plaza y las preferencias de stickers (favoritos, colecciones, frecuencia de uso y recientes) se guardan en `localStorage` bajo `entre.prototype.v1`. Los mensajes de salas y chats individuales de prueba solo viven en memoria y se pierden al abandonarlos o recargar. No ingresar datos sensibles ni utilizar el prototipo con usuarios reales. Las imágenes locales viven en IndexedDB y los reportes locales tienen su propio registro. La descarga JSON incluye referencias de imágenes y reportes; los archivos se descargan individualmente desde su vista ampliada. La función de borrar también limpia las imágenes y reportes locales, sin borrar cuentas del piloto.

La maqueta pública no utiliza backend. El laboratorio añade una API local con presencia y mensajería compartidas en memoria, sin cuentas de producción ni persistencia. No hay IA generativa, notificaciones, pagos ni protección de fotografías. Los límites de perfil son controles de la experiencia de prueba. Antes de un piloto se necesitan servicios desplegados, revisión jurídica y controles de seguridad verificables.

## Verificar

```sh
npm run typecheck
npm run build
npm test
npm run test:pilot
```

Playwright usa el Chromium disponible en `/usr/bin/chromium` en este entorno. En otra máquina puede definirse `CHROMIUM_PATH` apuntando a su ejecutable. Si no hay navegador de sistema, ejecutar `npx playwright install chromium` y `PLAYWRIGHT_BUNDLED_BROWSER=1 npm test`.

El runner ejecuta primero las pruebas del motor y las pruebas de integración de servidor con Node, y después los tests de navegador. Playwright arranca Vite en 4173 y la API local en 8787 si no hay instancias existentes. La prueba compartida usa tres contextos independientes; los recorridos de maqueta se ejecutan en escritorio y móvil: reserva, perfil, chat, guion, evaluación, reencuentro, bloqueo, búsquedas, cancelación, exportación, borrado, almacenamiento inválido, acceso directo a sala y foco de diálogos. También realizan comprobaciones automáticas WCAG A/AA con axe en las pantallas principales. No sustituyen la evaluación manual con tecnologías de asistencia ni acreditan cumplimiento completo de accesibilidad.

## Organización

- `src/App.tsx`: navegación, estado global y acciones de usuario.
- `src/pages/`: Plaza, encuentros, perfil, agenda, conexiones y sala/evaluación.
- `src/plaza/`: temas, conversaciones/personas de ejemplo, ilustraciones e invitación con consentimiento.
- `src/ecosystem.css`: identidad y adaptación de los tres espacios, incluida la navegación móvil.
- `src/data.ts`: actividades y personajes sintéticos, fechas y catálogos.
- `src/room/`: reglas deterministas de sala, hook de reloj y paneles de recepción, guía y participación.
- `src/chat/`: catálogo, selector y compositor común de texto/stickers, mensajes y chat individual de demostración.
- `server/`, `src/shared/` y `src/pages/SharedRoom.tsx`: API volátil de desarrollo, protocolo y laboratorio entre navegadores.
- `src/media/` y `src/safety/`: imágenes, normas, reportes, votaciones y consola/apelación del piloto.
- `server/features.ts`, `server/moderation.ts`, `server/images.ts`: permisos, revisión y normalización de archivos.
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
