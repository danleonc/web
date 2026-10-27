# Brief de diseño y UI de Afinia

Este documento aporta el contexto del producto a la skill `frontend-design`.
Las decisiones más recientes del usuario y la implementación vigente tienen
prioridad sobre esta referencia. No es una orden de rediseñar todo el portal.

## Propósito y público

Afinia facilita conexiones humanas a través de conversaciones, intereses y
experiencias compartidas. Permite participar a ritmos distintos y sin exigir
definir una intención de amistad o romance. Las personas pueden llegar con
curiosidad, timidez o poca experiencia con aplicaciones sociales.

El diseño debe ayudar a entender dónde participar, cómo empezar y cómo continuar
una conversación con consentimiento mutuo. El contenido sirve para conectar.

## Dirección visual aprobada

El usuario valora la limpieza, la claridad y la funcionalidad de la maqueta.
También pidió reforzar su atractivo visual. La identidad vigente combina una
marca floral, verde profundo, fondos crema, acentos de albaricoque y lavanda,
tipografía editorial y personajes expresivos.

Parte de los patrones que la skill cita como posibles lugares comunes ya forma
parte de una dirección explícita del producto. Mantén esas decisiones mientras
resuelves jerarquía, legibilidad y composición con intención. Puedes proponer
una evolución fundamentada cuando la tarea incluya revisar esa dirección.

Valores actuales de referencia en `src/styles.css`:

| Uso | Valor actual |
| --- | --- |
| Acción principal, verde | `--green: #285d4c` |
| Texto principal | `--ink: #293e35` |
| Fondo general | `#faf9f6` |
| Superficie crema | `--cream: #f3f1e8` |
| Líneas y divisores | `--line: #e7e8df` |
| Foco visible | `#a46743` |

Estos valores describen el punto de partida, no obligan a copiar un color en un
contexto que pierda contraste. Revisa el contraste de texto, estados y controles.

El texto de interfaz usa Inter y alternativas del sistema; los títulos usan
`--serif` con Georgia y Times New Roman. Mantén una escala coherente, con títulos
editoriales y cuerpo fácil de leer. Si se plantea cambiar familias tipográficas,
evalúa coherencia, licencias, rendimiento y disponibilidad de los archivos.

## Tres espacios conectados

- **La Plaza:** compartir y responder a tu ritmo, con páginas finitas, texto,
  imágenes y stickers. Una conversación puede dar paso a una invitación.
- **Conexiones:** revisar afinidades e invitaciones, conservar su origen y
  decidir si continuar. Los estados de contacto deben entenderse con claridad.
- **Encuentros:** experiencias en grupos pequeños, con horario, cupo, quórum y
  salida comprensibles. Los temas amplios concentran a la comunidad inicial.

Un recorrido de referencia es comentario → «Seguir conversando» → invitación
con contexto → Conexiones → volver al comentario o explorar un encuentro.
La reserva es una decisión separada de cada participante.

## Lenguaje y estados

Escribe en español claro, con verbos concretos y nombres consistentes durante el
recorrido. Una acción principal por contexto; las secundarias deben ser fáciles
de encontrar. Explica el siguiente paso, el resultado y la recuperación de un error.

Contempla estados vacío, carga, listo, error, deshabilitado y éxito según la
función. Distingue invitación pendiente, contacto habilitado y chat de prueba.
La maqueta no simula aceptaciones, destinatarios conectados o actividad humana.
Conserva las indicaciones de ejemplo/local cuando corresponda.

## Fotos y stickers

Las fotos usan encuadres que llenan el ancho y permiten ver la imagen completa.
Reutiliza `PhotoFrame`, `ImagePicker` e `ImageView`. Los comentarios admiten una
foto con texto opcional y guardan el archivo al confirmar la respuesta.

Los 60 stickers de diez personajes sin rótulos están aprobados por el usuario.
Reutiliza el catálogo, selector, favoritos manuales y frecuentes y colecciones
preferidas. Conserva IDs y preferencias en cambios visuales. Los recursos tienen
siluetas revisadas, transparencia, margen seguro y nombres con huella de contenido.
`npm run check:stickers` verifica los archivos distribuidos.

## Accesibilidad y móvil

Comprueba la composición en 320, 390 y 1440 píxeles cuando el alcance lo requiera.
Incluye tamaños de texto largos, desplazamiento del diálogo y navegación inferior.
Los botones deben resultar cómodos al tacto; apunta a 44 píxeles para acciones
principales e iconos interactivos y evita objetivos superpuestos.

Conserva foco visible, etiquetas accesibles, navegación con teclado y semántica
adecuada. Reutiliza `Modal` para apertura, Escape y retorno del foco, incluidas
las capas anidadas. Considera teclado móvil, ampliación de imágenes y orientación
vertical. Respeta `prefers-reduced-motion`; las animaciones deben ayudar a entender
una transición o confirmar una acción.

Las pruebas de Chromium móvil no equivalen a haber probado un iPhone físico.

## Componentes y estructura

Antes de añadir un patrón, revisa `src/components.tsx`, `src/styles.css`,
`src/ecosystem.css`, `src/safety.css`, `src/chat/`, `src/media/` y `src/plaza/`.
Trabaja con React, TypeScript y el CSS existente. Reutiliza componentes y
variables cuando corresponda, evitando especificidades que se anulen entre sí.

Una biblioteca externa, como 21st.dev, puede aportar referencias o componentes
cuando esté disponible y resulte útil para la tarea. Adapta cada pieza al brief,
la accesibilidad y el rendimiento. Esta skill funciona con los recursos locales
del repositorio y no exige una cuenta de 21st.dev.

## Proceso proporcional al cambio

1. Lee la petición y el estado actual. Identifica el objetivo del recorrido y las
   decisiones que ya tienen aprobación del usuario.
2. Para cambios de diseño amplios, redacta un plan breve de jerarquía, composición,
   paleta, tipografía y estados. Para un ajuste pequeño, concreta el cambio local.
3. Implementa usando los componentes pertinentes y mantén las funciones autorizadas.
4. Revisa capturas o la interfaz renderizada. Evalúa qué se entiende primero, si
   la acción principal destaca, si el contenido respira y si el foco y el móvil
   funcionan. Ajusta los problemas observados.
5. Ejecuta las comprobaciones necesarias para el cambio. Lee `package.json` y las
   pruebas existentes. Evita ejecuciones simultáneas que compitan por recursos y
   no cambies el código servido durante una prueba de navegador.
6. Comunica el resultado, la verificación y la siguiente mejora propuesta.

Los detalles técnicos de la maqueta, el backend y los límites vigentes se
consultan en `README.md`, `docs/STATUS.md`, `docs/ECOSISTEMA.md` y
`docs/IMAGENES_Y_CONVIVENCIA.md`.
