# Revisión estratégica de producto e identidad

19 de octubre de 2026 · Versión 0.1 · Recomendaciones para discusión, no cambio aprobado de alcance.

## Resultado principal

La maqueta demuestra claridad operativa y una intención de trato respetuoso. Todavía no demuestra una razón suficientemente concreta para preferir el producto frente a un portal de actividades, una comunidad ya existente o una aplicación de amistad. Su centro visible es «elige y reserva un evento». La visión original exige algo más: facilitar el primer contacto y una continuidad deseada por las personas, sin imponer un destino relacional.

Recomendación: probar una propuesta centrada en **pequeños grupos con continuidad voluntaria**, donde una experiencia compartida hace más fácil iniciar y retomar la conversación. La ventaja candidata no es organizar más encuentros ni incorporar más IA; es reducir el esfuerzo de pasar de conocer gente a volver a encontrarse con ella. Esto es una hipótesis que necesita evidencia, no una ventaja competitiva acreditada.

## Evidencia y límites

- Confirmado por el usuario: considera funcional y limpio el prototipo; pide aumentar atractivo, revisar competencia y hacer visible la identidad diferencial.
- Confirmado por código/documentación: catálogo de seis actividades, perfil opcional por intereses, reservas, guion de una pregunta, chat local y solicitudes individuales de reencuentro. Son simulaciones, no resultados sociales.
- Revisado: `src/pages/Discover.tsx`, `Room.tsx`, `Connections.tsx`, datos de ejemplo, estado del producto, plan maestro y captura preparada del prototipo. No se realizó una prueba con usuarios nuevos.
- No verificado: funciones, precios, usuarios, ciudades, resultados o estado operativo actual de competidores. Las solicitudes a sus sitios oficiales fallaron por la política de red (403 de túnel), antes de obtener contenido. El bloqueo no prueba que los sitios estén caídos.
- Se guardaron destinos adicionales de investigación en el borrador de configuración; eso no aplica permisos en la instancia ni equivale a haber consultado las fuentes.
- Referente identificado por el usuario: **Inner Circle**, confirmado por una captura de su ficha «Inner Circle Comunidad y Citas» en Google Play. La captura es evidencia de comunicación visible, no una prueba de su algoritmo, calidad o funcionamiento interno. Timeleft se conserva como referente adicional, no como el producto que el usuario tenía en mente.

Los cuadros de mercado siguientes son un **mapa preliminar basado en posicionamientos conocidos**, no un estudio de mercado actualizado. La falta de una función en este cuadro no significa que un competidor carezca de ella. No declarar exclusividad, superioridad o crecimiento comercial a partir de esta revisión.

## 1. Contra qué compite realmente

El usuario no compara únicamente listas de funciones. También puede elegir seguir en su grupo de WhatsApp, asistir a un taller, volver a una comunidad existente o no intentar conocer a nadie porque el esfuerzo o la exposición le parecen excesivos.

Tres trabajos por distinguir:

1. «Quiero tener un plan o conocer gente hoy»: competir con eventos y logística de encuentro.
2. «Quiero encontrar personas que me encajen»: competir con perfiles, afinidad y descubrimiento.
3. «Quiero construir un círculo con el que resulte natural volver a compartir»: competir con la capacidad de iniciar y sostener experiencias recíprocas.

Recomiendo explorar el tercero como foco inicial, conservando la libertad de que cada vínculo evolucione de distintas maneras. No afirma que el mercado no lo atienda: comunidades y amistades ya cubren parte de ese trabajo.

## 2. Comparativa preliminar y qué debemos comprobar

| Referente | Posicionamiento de referencia, pendiente de verificación actual | Qué nos obliga a resolver | Evidencia a buscar antes de concluir |
|---|---|---|---|
| Inner Circle | La captura aportada presenta «Comunidad y Citas», «calidad antes que cantidad», «conecta con quienes comparten tu estilo de vida» y «match por estilo de vida, no solo por apariencia» | La afinidad, la comunidad y la preferencia por calidad ya se comunican explícitamente; necesitamos distinguir el proceso y el resultado humano que facilitamos | Funcionamiento real, criterios de admisión, formatos de encuentro, seguimiento, seguridad, costos y acceso regional; no deducirlos de sus anuncios. |
| Timeleft | Organización de encuentros presenciales entre desconocidos, asociada a cenas | Un plan concreto reduce fricción; «conocer personas con intereses» no basta como identidad | Modalidades actuales, composición de grupos, juego/facilitación, contactos posteriores, recurrencia, ciudades y modelo de cobro. |
| Meetup | Grupos, comunidades y eventos por intereses | La recurrencia y la pertenencia ya son propuestas conocidas; no podemos apropiarnos de ellas como novedad | Herramientas de organizadores, onboarding del nuevo integrante, formatos online, continuidad, seguridad y diferencias por comunidad. |
| Bumble For Friends / BFF | Conocer personas con una finalidad de amistad | «No somos solo citas» ya tiene alternativas | Producto y marca vigentes, grupos, compatibilidad, modos de conexión, disponibilidad regional y transición a encuentros. |
| Boo | Conexiones asociadas a afinidad/personalidad e intereses | La palabra «afinidad» y los perfiles de personalidad no diferencian por sí mismos | Qué promete realmente, mecanismos de descubrimiento, comunidad, límites, privacidad y explicaciones de compatibilidad. |
| Slowly | Correspondencia pausada con lógica de cartas | Una dinámica propia puede expresar mejor una filosofía que un listado de funciones | Mecánica vigente, expectativas de ritmo, reciprocidad, formas de descubrir interlocutores y prácticas de seguridad. |
| We3 | Formación de pequeños grupos para amistad | Incluso grupos reducidos y afinidad tienen precedentes | Disponibilidad actual, formación y continuidad de grupos, formatos, moderación y acceso geográfico. |
| Breeze | Citas presenciales con énfasis en concretar el encuentro | Resolver un resultado concreto y su logística puede ser más potente que acumular funciones | Flujo vigente, intermediación, seguridad, disponibilidad, pago y seguimiento posterior. |

No confundir lo presencial con una categoría romántica: un encuentro presencial también puede ser de amistad o comunidad. Tampoco lo virtual garantiza profundidad. La propuesta debe competir por el resultado que facilita, no únicamente por el canal.

## 3. Fuerza de los diferenciadores candidatos

Evaluación editorial del concepto, no puntuación de mercado ni resultados medidos.

| Candidato | Fuerza como argumento aislado | Lectura estratégica |
|---|---|---|
| «Conocer personas por intereses» | Baja | Es una expectativa común a muchas alternativas; útil para relevancia, insuficiente para elección. |
| «Sin obligación de buscar pareja» | Baja como exclusividad; alta como principio | Mantenerlo de forma visible, sin afirmar que nadie más lo ofrece. |
| «Con inteligencia artificial» | Baja sin resultado probado | Es fácil de anunciar; puede añadir desconfianza, costo o interrupciones. Medir si ayuda realmente. |
| «Encuentros virtuales» | Baja como defensa | Amplía acceso y reduce desplazamiento; también compite con fatiga de pantalla. |
| «Fotografías que se revelan» | Distintivo visual, potencia incierta | Fácil de recordar/copiar; puede reintroducir evaluación por apariencia y tensión. No convertirlo en promesa principal sin validación. |
| «Pequeños grupos facilitados» | Media como experiencia candidata | Puede reducir el esfuerzo social si está bien ejecutado; ya existen formatos pequeños y facilitados. |
| «Continuidad recíproca fácil» | Media/alta como hipótesis de valor | Solo gana fuerza si produce segundos encuentros con bajo esfuerzo y buena seguridad. Repetición también existe en comunidades. |
| «Primera experiencia segura, ritmo propio y continuidad opcional» | Combinación prometedora, aún no validada | Puede funcionar como un método reconocible si toda la experiencia lo sostiene; no es automáticamente una barrera competitiva. |

Posible defensa a futuro: calidad de facilitación, densidad de cohortes con horarios compatibles, confianza en la comunidad, biblioteca de experiencias evaluadas y operación confiable. No basarla en acumular chats privados, inferir sensibilidad o encerrar contactos en la plataforma.

## 4. Enfoque propuesto

### Público y situación inicial

Mantener adultos aproximadamente 30+ como segmento a validar, distinguiéndolo de edad mínima de acceso. Elegir una situación concreta de necesidad: personas que quieren ampliar o reconstruir su círculo tras un cambio de etapa, horarios o ciudad. Es un problema de contexto, no un diagnóstico ni una etiqueta de «persona solitaria».

Piloto acotado a una comunidad horaria/idiomática en Chile, con captación dirigida. La ciudad no está decidida. La promesa virtual permite conexiones a distancia; no debemos fingir una masa local que no existe. Si se explora presencialidad, será una etapa con medidas y operación específicas.

### Promesa candidata

«Personas con quienes compartir algo hoy y ganas de volver a encontrarse mañana».

Versión más concreta para la primera pantalla:

**«Conoce gente con la que quieras volver a conversar».**

«Empieza en un grupo pequeño, comparte una experiencia guiada y decide con quién continuar. Sin tener que definir qué vínculo buscas».

Son propuestas creativas a probar. No prometer amistad, atracción o pertenencia garantizada. Mantener la frase del plan («No necesitas saber qué buscas…») como principio o segunda capa, pero acompañarla de una explicación concreta del funcionamiento.

### Método reconocible propuesto

1. **Llegar con una curiosidad:** seleccionar una actividad y el ritmo con que se está cómodo; no completar un diagnóstico de personalidad.
2. **Encontrar un espacio manejable:** grupo pequeño, horario claro, reglas y límites visibles.
3. **Compartir algo que facilite hablar:** una dinámica con principio y final, posibilidad de pasar y guía que interviene solo cuando se pide o corresponde.
4. **Elegir si continuar:** interés privado, revocable, sin ranking público ni interpretación del silencio.
5. **Hacer fácil el siguiente encuentro:** propuesta de actividad/horario con las personas que acepten recíprocamente. No basta con mostrar un indicador «interés guardado».

Lo individual y lo grupal deben coexistir sin obligar a escalar de uno a otro. Una sesión agradable que termina también es un resultado válido.

### Formato inicial para experimentar

Comparar encuentro único frente a una pequeña serie opcional con parte del mismo grupo. Propuesta de prueba: hasta tres sesiones de 35–45 minutos a lo largo de varias semanas, con cupo de cuatro a seis personas. Duración, tamaño y número de sesiones son hipótesis; no nuevas decisiones confirmadas.

La serie no impone compromiso social ni cobra la salida como penalización. Si alguien no vuelve, no comunicar rechazo ni enviar presión. Proponer alternativas honestas cuando no haya cupo o disponibilidad compatible. Un anfitrión humano identificado puede ejecutar el piloto antes de automatizar.

No convertir el futuro MVP en chat grupal abierto indefinido desde el primer día: aumenta exposición, moderación y ruido antes de demostrar el valor de una experiencia limitada.

## 5. Auditoría de identidad y experiencia actual

| Observación verificable | Efecto probable, pendiente de prueba | Cambio recomendado | Prioridad |
|---|---|---|---|
| Portada con frase amplia y grilla de actividades como acción central | Se interpreta como catálogo; cuesta explicar por qué volver | Mostrar en una frase el resultado y, debajo, el método de compartir → elegir → reencontrarse | P0 diseño |
| Ilustración principal de dos personas tomando café; tarjetas de planes convencionales | Recuerda al código visual de encuentros presenciales y puede sugerir cita individual | Composición de pequeño grupo y una actividad compartida distintiva; conservar calidez | P0 identidad |
| Verdes suaves, crema y mensajes de calma dominan | Comunica cuidado; puede sentirse contemplativo, institucional o de bienestar genérico | Contraste, mejor jerarquía, acento cálido y momentos de energía social; conservar accesibilidad y limpieza | P1 visual |
| «Encuentra tu punto de partida» no describe qué ocurre después | Añade ambigüedad a la primera decisión | Probar «Explorar un primer encuentro» y acceso a cómo funciona | P0 comprensión |
| Categorías e intereses amplios; explicación se limita a coincidencia de etiqueta | Personalización poco específica | Explicar actividad, ritmo, disponibilidad y datos declarados que realmente influyen, sin aparentar compatibilidad calculada | P0 producto |
| Preferencia de disponibilidad se guarda pero no se aplica al catálogo | Un usuario podría esperar un ajuste que no sucede; hoy se avisa | En el rediseño conectar preferencia con propuesta real o retirar su uso aparente hasta que exista | P0 coherencia |
| Actividades fechadas 16–18 de octubre ya pasadas al revisar el 19 | Reduce sensación de actualidad y atractivo de prueba | Próximas fechas de ejemplo o sin calendario real; seguir indicando que son sintéticas | P0 maqueta |
| Una sola pregunta del guion y chat de texto ordinario | La sesión no expresa una experiencia propia | Diseñar un guion completo y corto: bienvenida → actividad → conversación → cierre, con controles para pasar/salir | P0 experiencia |
| Reencuentro individual queda en «Tu interés está guardado» | Falta un desenlace concreto; elegir personas puede parecer otra mecánica de matching | Visualizar siguiente paso, reciprocidad y actividad compartida; sumar continuidad grupal opcional | P0 diferenciación |
| No hay evidencia de participantes reales o resultados | No se puede demostrar eficacia ni masa crítica | Mantener etiquetas sintéticas; obtener evidencia del piloto antes de usar testimonios o contadores | P0 honestidad |
| Interfaz móvil concentra mucho espacio en portada antes de actividades | El propósito tarda en convertirse en acción | Reducir altura, explicar método con brevedad y adelantar una experiencia representativa | P1 usabilidad |
| «Entre» no está validado como marca y es una palabra común | Recuerdo/búsqueda y registro inciertos | Evaluar nombres y disponibilidad después de fijar propuesta, sin cambiar marca por estética solamente | P1 marca |

La intención visual actual es coherente con respeto y bajo estrés; no aconsejo sustituirla por estética de citas, mensajes de urgencia, contadores ficticios o estímulos adictivos. Hace falta más carácter y evidencia del tipo de experiencia, no más saturación.

## 6. Brief de identidad propuesto

Personalidad: cercana, curiosa, adulta, con una energía social tranquila. Permite explorar y sorprenderse sin infantilizar, diagnosticar ni prometer intimidad instantánea.

- **Verbal:** acciones concretas (compartir, escuchar, volver, elegir), preguntas ligeras y explicaciones directas. Reducir «auténtico», «significativo» y «afinidad» cuando no se acompañan de un mecanismo o evidencia.
- **Visual:** mantener fondos cálidos y espacio; usar un acento más decidido y contraste legible. Una escena de colaboración o conversación grupal debe expresar la experiencia. Evitar que dos copas, parejas o un café presencial sean la única metáfora.
- **Interacción:** el sistema debe sentirse como una invitación bien preparada: qué pasará, quién guía, cuánto dura, cuánto debo participar y qué puedo decidir después.
- **Confianza:** mostrar controles al momento de necesitarlos. «Diseñado para cuidar tus límites» describe intención; «espacio seguro garantizado» no puede prometerse.
- **Prueba social:** solo historias autorizadas de participantes reales cuando existan, sin exagerar relaciones formadas. Imágenes y nombres sintéticos deben identificarse.
- **IA:** anfitrión identificable y opcional, explicando cuándo opera y qué datos usa. La primera promesa es el resultado humano; la IA es un mecanismo subordinado.

Ejemplo de portada a probar:

> Conoce gente con la que quieras volver a conversar.
>
> Un grupo pequeño. Una experiencia para compartir. La libertad de decidir qué viene después.
>
> [Explorar un primer encuentro] [Ver cómo funciona]

Ejemplo de tarjeta con información útil:

> **Una historia entre todos**
> Creamos una historia breve para romper el hielo y descubrir coincidencias.
> 4–6 personas · 40 min · virtual · puedes escuchar o pasar.
> Te lo proponemos porque elegiste creatividad y conversación; coincide con tu disponibilidad declarada.
> Primera sesión opcional de una serie. Podrás decidir después si quieres repetir.

La última razón solo se muestra cuando el sistema aplica realmente esos filtros. En la maqueta, el contenido seguiría indicando que es un ejemplo.

## 7. Qué conservar, replantear y diferir

- Conservar: no forzar intención relacional; límites y consentimiento; transparencia; perfil corregible; grupos; experiencias; posibilidad de vínculo individual; salida sin penalización; accesibilidad; capacidad internacional futura.
- Replantear mediante prueba: equilibrio entre grupos y uno a uno; formato de sesiones; foco del catálogo; identidad gráfica; protagonismo de fotografías; continuidad programada; momento del perfil inicial.
- Diferir por ahora, sin descartarlo: agentes personales coordinados, recomendaciones avanzadas, audio/vídeo de producción, monetización compleja, crecimiento internacional operativo y encuentros presenciales automatizados.
- No vender como ventaja ya lograda: IA que entiende a las personas, diagnóstico de afinidad, soledad reducida, amistades garantizadas o funciones ausentes en toda la competencia.

La revelación gradual de fotos sigue en el plan. Recomiendo evaluarla como experimento posterior, con consentimiento y derivados de servidor, sin ponerla como eje de identidad. Cambiar su prioridad requiere decisión documentada; no se elimina silenciosamente.

## 8. Validación de potencia y decisión de inversión

No asignar una puntuación a la «potencia» comercial sin datos. Separar cuatro preguntas:

| Pregunta | Experimento económico | Señal principal | Cómo decide |
|---|---|---|---|
| ¿Se entiende y se distingue la propuesta? | Dos portadas con el mismo nivel de fidelidad: catálogo actual frente a continuidad guiada; primera exposición alternada entre personas | Explicación espontánea de qué hace, para quién y por qué elegirlo | Si sigue pareciendo «otro portal de eventos», ajustar mecanismo y mensaje antes de añadir funciones. |
| ¿La experiencia propia ayuda a conversar? | Guion revisado frente a conversación libre, con grupos comparables y facilitadores/horarios equilibrados | Comodidad, participación voluntaria, deseo de repetir y seguridad percibida | No adoptar IA compleja si guion o facilitación humana resuelven lo mismo con mejor costo. |
| ¿La continuidad tiene demanda? | Ofrecer un segundo encuentro voluntario con el mismo grupo frente a otra actividad con personas nuevas | Elección y asistencia real al segundo encuentro, con denominadores | Una intención positiva no cuenta como reencuentro realizado. |
| ¿Es sostenible? | Piloto con registro de minutos humanos y costos variables; oferta de valor/pago transparente | Costo por encuentro repetido y disposición conductual a pagar | No escalar adquisición si requiere subsidio o facilitación humana que el precio no puede sostener. |

Diseño sugerido, no tamaño de muestra estadísticamente suficiente: 8–12 pruebas de comprensión/usabilidad; luego varias cohortes pequeñas durante tres o cuatro semanas. Un piloto así sirve para detectar problemas y estimar señales, no para demostrar superioridad o tasas poblacionales. Definir antes del ensayo la unidad de asignación (grupo), ventana de seguimiento, hipótesis y reglas de decisión. No contar observaciones de un mismo grupo como usuarios independientes al evaluar efectos.

Métrica de resultado candidata: participantes con al menos un segundo encuentro recíproco realizado dentro de 30 días / participantes que completaron un primer encuentro y tuvieron 30 días de seguimiento. Informar también sobre todas las personas inscritas para no ocultar abandono inicial. No penalizar a quien no quiera repetir: complementar con satisfacción y valor del encuentro único.

Guardarraíles: incomodidad, presión por continuar, denuncias, bloqueos, participación voluntaria, fallos de moderación, accesibilidad y costo. Registrar definiciones y denominadores; pocas denuncias por sí solas no demuestran seguridad. No aumentar retención mediante insistencia o mayor lectura de chats.

Posibles criterios de abandono/pivote, propuestos para acordar antes del piloto: los usuarios entienden el mensaje pero no eligen/atienden el segundo encuentro; el valor depende de un facilitador tan intensivo que no es sostenible; la serie se percibe como obligación; el beneficio frente a un grupo convencional no aparece. En esos casos, especializar segmento/actividad o concentrarse en la experiencia puntual sin prometer continuidad superior.

## 9. Backlog para la siguiente versión de diseño

| ID | Cambio propuesto | Relación con requisitos existentes | Aceptación del diseño | Estado |
|---|---|---|---|---|
| E01 | Portada con promesa concreta y método visible | R01, R29 | Persona nueva explica actividad, grupo y decisión posterior sin necesitar que se le cuente el plan | Propuesto |
| E02 | Experiencia insignia con guion completo | R09, R12, R13 | El prototipo muestra preparación, actividad, conversación y cierre, con opción de pasar | Propuesto |
| E03 | Continuidad grupal y/o individual recíproca | R11, R15 | Se entiende qué ocurre tras expresar interés y cómo se retira; sin crear aceptaciones reales ficticias | Propuesto |
| E04 | Preferencias aplicadas de forma honesta | R06, R07 | Cada motivo visible corresponde a un filtro/regla real; no inferencia sensible | Propuesto |
| E05 | Más carácter visual y menor altura móvil | R28, R29 | Jerarquía clara, contraste y teclado preservados; primera actividad visible con menos desplazamiento | Propuesto |
| E06 | Fechas y disponibilidad de demostración coherentes | R12 | Ninguna fecha pasada se presenta como próxima; cupos no se comunican como demanda real | Propuesto |
| E07 | Instrumentar el experimento de comprensión y continuidad | R29, R30 | Registro mínimo con consentimiento y sin recoger conversaciones privadas por defecto | Propuesto |

No se modificó ni publicó la aplicación como parte de esta revisión. No conviene desarrollar el backend completo antes de validar al menos comprensión y formato de experiencia. Una propuesta visual alternativa puede prepararse después con estas hipótesis y validarse en paralelo a entrevistas, manteniendo la maqueta actual como referencia.

## 10. Fuentes, estado de consulta y actualización pendiente

Material primario revisado: solicitud del usuario de 19/10/2026; Plan Maestro reconstruido de 14/10/2026; base de ejecución de 15/10/2026; código y documentación de la maqueta; captura del producto. Las conclusiones de UX son una inspección experta, no investigación de comportamiento.

Destinos oficiales solicitados el 19/10/2026, sin acceso al contenido por error 403 de política de red:

- https://timeleft.com/
- https://www.meetup.com/
- https://bumble.com/bff
- https://boo.world/
- https://slowly.app/
- https://www.we3app.com/
- https://breeze.social/

Estos enlaces son destinos de investigación, no citas que respalden una observación ya verificada. Una vez aplicado el acceso, registrar por producto URL final, fecha, descripción textual, flujo, canales, recurrencia, seguridad visible, datos requeridos, precio consultado con moneda/mercado y límites del acceso. Una landing oficial no prueba calidad del servicio ni tracción. No registrarse, contactar personas o pagar sin necesidad/autorización específica.

El referente del usuario ya está identificado: Inner Circle. Su captura permite examinar mensajes y estilo visual. Sigue pendiente consultar fuentes oficiales accesibles para verificar funciones, disponibilidad y estado actual; se intentó acceder a https://www.theinnercircle.co/ el 19/10/2026 y la política de red devolvió 403 antes de obtener contenido.


## 11. Actualización con la captura de Inner Circle aportada por el usuario

### Evidencia visible y límites de interpretación

La imagen muestra una ficha titulada **«Inner Circle Comunidad y Citas»**, editor **Circle Imperium B.V.**, y una serie de piezas promocionales. No disponemos de enlace de la ficha ni contexto regional/temporal verificado. La fecha de incorporación al análisis es 19/10/2026, no una fecha acreditada de actualización de la app.

| Observación de la captura | Interpretación de comunicación | Lo que no demuestra |
|---|---|---|
| «Calidad antes que cantidad» | Prioriza una experiencia selectiva y una promesa de relevancia | Calidad objetiva de sus usuarios, resultados o recomendaciones. |
| «Conecta con quienes comparten tu estilo de vida» | Afinidad como criterio central de elección | Cuáles son sus señales reales ni cómo se ponderan. |
| «Match por estilo de vida, no solo por apariencia» | Ya ocupa el territorio verbal de afinidad más allá de fotos | Que la apariencia no influya, ni una eficacia medida del algoritmo. |
| «Comunidad y Citas» | Combina comunidad con finalidad romántica explícita | Que todas las relaciones sean románticas o que no permita amistad. |
| «Tu solicitud fue aprobada» en una pieza | Representa acceso/aprobación como parte de pertenecer | Criterios de admisión, verificación de identidad, seguridad o ausencia de discriminación. |
| Personas fotografiadas, azul intenso, negro y tipografía de alto impacto | Identidad enérgica, aspiracional y reconocible | Que esa estética convierta mejor, ni que debamos copiarla. |
| Valoraciones y descargas de tienda visibles | Hay indicadores agregados presentados en la ficha capturada | Usuarios activos, masa crítica en Chile, relaciones logradas, retención o rentabilidad. |

Esto modifica el punto de partida de la comparación: Inner Circle no debe reducirse a «portal de eventos presenciales». A partir de lo visible, también vende afinidad y pertenencia. Nuestra propuesta necesita una diferencia más específica que «intereses, calidad, comunidad y algo más que apariencia».

### Diferencia que podemos intentar construir y probar

Hipótesis de enfoque: **hacer fácil compartir una primera experiencia y repetirla de manera recíproca**, con personas que no necesitan declarar un destino relacional. En el piloto, la afinidad sirve para preparar una experiencia manejable; no se presenta como diagnóstico de qué persona sería una pareja adecuada.

Tres pilares propuestos:

1. **Descubrimiento sin destino predeterminado.** Comunicar de forma positiva la libertad de explorar, manteniendo límites claros. No prometer que Inner Circle prohíba otros vínculos: ese extremo no está verificado.
2. **Afinidad que se descubre participando.** Una dinámica compartida completa debe mostrar cómo resulta conversar y colaborar; no depender únicamente de fotografías, etiquetas o perfiles supuestamente compatibles. Hay que contrastar si Inner Circle y otras alternativas ya ofrecen mecanismos similares antes de afirmar exclusividad.
3. **Continuidad con control.** Facilitar un próximo encuentro individual o grupal cuando exista interés recíproco, con salida sencilla. No basta un botón de «quiero repetir», ni es una capacidad ya implementada en la demo.

Cada pilar aislado es copiable y puede existir en otros productos. La posible ventaja sería una ejecución consistente para un segmento concreto y resultados observados de comodidad, reciprocidad y repetición. La combinación todavía no constituye superioridad probada ni una barrera competitiva.

### Identidad: qué aprender y qué evitar

La captura presenta una promesa en frases breves, fuertes y visualmente consistentes. Nuestra portada puede aprender de esa precisión y del protagonismo de personas participando. Conviene mantener calidez y accesibilidad, dar más energía a la composición y mostrar una escena o actividad propia reconocible.

No recomiendo adoptar un discurso de «personas que valen la pena», superioridad personal o aprobación elitista. Podemos seleccionar por contexto, disponibilidad, consentimiento y necesidades de la actividad sin asignar valor humano. La seguridad exige controles y operación; no se deduce de pertenecer a una comunidad seleccionada.

Dirección candidata de identidad:

> **Conoce gente con la que quieras volver a compartir.**
>
> Empieza con una experiencia en un grupo pequeño. Descubre con quién conectas y decide qué viene después.

Debajo, una explicación concreta de la actividad y del siguiente paso. Mantener el principio de no tener que definir qué vínculo se busca. Evitar añadir a la promesa resultados románticos, amistades garantizadas o propiedades de IA sin evidencia.

### Prueba de diferenciación específica

Mostrar, con orden alternado, la captura promocional de Inner Circle, nuestra maqueta actual y un concepto alternativo del mismo nivel de fidelidad. Preguntar qué espera que ocurra, qué diferencia entiende, cuál elegiría para una situación real y qué le haría desconfiar. Este ejercicio compara comunicación; no permite concluir que nuestro servicio funciona mejor. La eficacia requiere después un piloto y resultados conductuales.

Los sitios www.theinnercircle.co, theinnercircle.co y play.google.com se añadieron a los destinos solicitados en el borrador de red, preservando los anteriores. No se consultó su contenido online ni se cambiaron funciones de la aplicación como resultado de esta captura.
