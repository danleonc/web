# Oferta concentrada y anfitrión de sala — prototipo

Implementación autorizada tras las conversaciones sobre diferenciación, quórum y ritmo de participación. Fecha de registro: 19 de octubre de 2026.

## Qué cambia

- Tres convocatorias destacadas: **Historias y cultura**, **Crear y descubrir**, **Vida cotidiana y pequeños planes**. Cada una tiene una dinámica concreta y deja abierta la evolución de la conversación.
- Una franja semanal compartida de ejemplo y sesiones de 40 minutos. La fecha ilustrativa se calcula para el próximo jueves; no es una reserva real ni se utiliza para reprogramar compromisos de usuarios.
- Los IDs históricos permanecen en el catálogo interno para no perder reservas/evaluaciones guardadas. Tres encuentros anteriores se archivan y dejan de multiplicar la oferta visible. No se añade creación libre de salas ni una modalidad premium para fragmentarla.
- Portada orientada a compartir y volver, ilustración grupal y explicación del recorrido.
- Recepción con mínimo, máximo, tiempo de espera y salidas explícitas.
- Guía opcional con preguntas limitadas, tiempos definidos y decisiones expresas del participante/grupo.
- Interés grupal opcional y revocable en la evaluación, además de interés individual. No se inventan aceptaciones ni se crean nuevas citas.

## Recepción y quórum de prueba

El formato es de **3 a 6 personas**. La guía no cuenta. El participante local está presente y por defecto se muestran tres personajes ficticios presentes; los controles de simulación permiten añadir o retirar asistentes.

Se puede comenzar con el mínimo alcanzado sin cubrir el máximo. La recepción espera hasta cinco minutos y después comienza con quórum o muestra falta de mínimo. «Simular fin de espera» prueba esa decisión sin tener que esperar. El inicio toma como referencia el vencimiento original de recepción para que volver a una pestaña suspendida no reinicie un encuentro ya vencido.

Sin mínimo: volver a probar la recepción, salir conservando reserva, explorar otras convocatorias o cancelar por decisión propia. No se reprograma ni se fusiona con otro grupo automáticamente. No hay pagos o devoluciones en este prototipo.

Si baja el quórum durante la sesión: se pausa la comunicación y se ofrece hasta un minuto para reconexión. Si se recupera, vuelve la conversación libre sin insertar otra pregunta. Si no, finaliza la simulación de ese formato. No se transforma en una interacción individual sin informar. Los personajes bloqueados no pueden añadirse de nuevo mediante los controles de simulación.

## Participación y tiempo de guía

Reglas deterministas implementadas en `src/room/engine.ts`. Son parámetros iniciales para prueba, no resultados de validación con grupos reales.

- Máximo de tres preguntas preescritas por temática; no generación ni análisis de mensajes mediante IA.
- Primera pregunta al comenzar con guía activada.
- Ronda de respuesta de 90 segundos; una única extensión compartida de 30 segundos, limitada también por el final de la sesión.
- «Listo por ahora», «Paso esta pregunta», «Solo escucho» y «Quiero participar». Escuchar cuenta como presencia para el quórum, no como obligación de responder.
- Enviar texto o un sticker registra una contribución, sin declarar que la persona terminó. No revoca una decisión explícita de escuchar o pasar.
- La ronda termina si todos los presentes están listos, pasan o escuchan; también vence al terminar su tiempo.
- El vencimiento marca «sin respuesta en esta ronda» a quienes no contribuyeron, sin inferir desinterés o consentimiento. El chat continúa aceptando mensajes tardíos.
- Después de la ronda hay conversación libre. Una pregunta adicional exige mayoría estricta de presentes, incluyendo quienes escuchan: `floor(presentes / 2) + 1`. Cada persona tiene un voto. Sin mayoría no hay nueva pregunta y el chat sigue disponible. Los votos de ejemplo se prueban manualmente; no representan decisiones reales.
- Desactivar el guion mantiene conversación libre. Reactivarlo no inserta una pregunta sin la decisión de grupo indicada.
- Indicador de escritura efímero: cuatro segundos desde la última señal. No extiende plazos, no marca respuestas ni revela contenido al anfitrión. Escribir, no escribir o enviar afecto no sustituye ninguna aceptación de contacto, fotografía o reencuentro.
- La sesión tiene un máximo de 40 minutos. Al cerrar ofrece evaluación o salida; no guarda opiniones ni reencuentros automáticamente.

## Demostración y límites

Todos los asistentes, votos y respuestas ajenas son ficticios. Hay controles separados para probar asistencia, escritura, finalización de turnos y votos. El usuario puede ver lo que pasaría sin hacer creer que hay otras personas conectadas.

La simulación de sala y sus mensajes viven en memoria y se reinician al cerrarla/recargar. Los plazos usan timestamps y se comprueban periódicamente y al recuperar visibilidad; no son una garantía de tiempo real de servidor. El estado persistido conserva perfil, reservas de ejemplo, decisiones de reencuentro y preferencias de stickers. Los campos nuevos de evaluación son opcionales y compatibles con datos anteriores.

En producción siguen pendientes: autenticación, presencia verificable, servidor como autoridad de reloj/estado, transacciones de cupo, deduplicación de eventos, votos asociados a identidades autorizadas, permisos/bloqueos en cada envío, notificaciones, retención y revisión operativa/legal. La IA futura deberá trabajar dentro de estos límites y con datos expresamente autorizados. Este cambio no contrata un proveedor ni necesita claves.

## Verificación

- `npm run build`: TypeScript y compilación.
- `npm run test:rules`: pruebas del motor, incluyendo mínimos/máximos, vencimiento de recepción, extensión única, indicadores de escritura, participación voluntaria, mayoría explícita, límite de preguntas, reconexión y duración total.
- `npm test`: primero reglas y luego recorridos de navegador en escritorio/móvil. Playwright solo recoge `*.spec.ts`, manteniendo separado el runner de reglas de Node.
- Las pruebas de navegador usan reloj controlado para recorrer esperas sin esperas reales; también verifican stickers, migración, exportación/borrado, continuidad y comprobaciones automáticas axe. No acreditan seguridad de producción ni accesibilidad integral.

## Resultado de la entrega

Compilación correcta; 13 pruebas del motor y 32 recorridos de navegador en escritorio/móvil. Se revisó además la compilación estática bajo `/web/`: tres temas, recepción, reloj, guía, sticker renderizado y continuidad grupal, sin errores observados de carga o JavaScript. Las comprobaciones axe cubren portada, perfil, recepción, guía y selectores de stickers; no constituyen certificación integral de accesibilidad. La propagación de GitHub Pages requiere comprobación independiente del sitio remoto.
