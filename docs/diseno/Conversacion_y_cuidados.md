# Conversación, guía y cuidados en las salas

Objetivo autorizado: conversación protagonista, guía discreta y acceso claro a
participantes y seguridad. Se aplica `frontend-design` y el brief de Afinia.

Paleta vigente: verde #285d4c, tinta #293e35, fondo #faf9f6, salvia #edf1e3,
lavanda #eee8f2. Georgia para títulos; interfaz sans para mensajes y controles.
Texto de mensajes a 15 px, campos táctiles a 16 px y acciones de 44 px.

```text
[ tema / estado                 salir ]
[ simulación o conexión | personas y seguridad ]
[ pregunta y tiempo              plegar ]
[ conversación / historial              ]
[ cita opcional                         ]
[ stickers | foto | mensaje | enviar     ]
[ controles de simulación plegados       ]
```

Una sola columna con ancho de lectura contenido. Participantes, normas y
votación se reúnen en un diálogo accesible reutilizando Modal. Silenciar oculta
mensajes solo en esta vista; no expulsa, bloquea ni altera quórum o participación.
Bloquear y denunciar conservan sus alcances actuales, distinguiendo maqueta,
laboratorio y piloto. No se inventa actividad ni una IA generativa.

La pregunta queda visible al plegar controles de la guía. Plegar no desactiva
el guion ni detiene el reloj. En conversación libre se conserva la solicitud
explícita por mayoría para otra pregunta; no se cambia el motor de reglas.

Revisión contra el brief: se mantienen colores, tipografía, stickers, fotos y
respuestas citadas. Se retiran del flujo principal paneles permanentes de ayuda;
las normas y acciones siguen accesibles desde la cabecera. Los controles ficticios
se identifican y quedan separados del historial. Se conserva el borrador al abrir
cuidados o plegar la guía. No se recurre a nuevas imágenes decorativas ni servicios.

## Implementación

Se utiliza una columna de hasta 900 px. La cabecera muestra el alcance local o
compartido y el acceso a «Personas y seguridad». El mensaje de bienvenida solo
aparece con el historial vacío. La escritura de participantes se muestra cerca
del compositor sin fabricar actividad. El historial tiene su propio scroll;
los mensajes entrantes no arrastran la página al final si la persona está leyendo
mensajes anteriores. Un acceso superpuesto permite saltar a los nuevos sin
cambiar el alto del chat.

La guía conserva pregunta y tiempo al plegar sus controles. La explicación y
la extensión pasan a un desplegable. Se mantienen los plazos de 90 + 30 segundos,
las decisiones individuales y la mayoría para otra pregunta. El control del
guion local se integra aquí; el compartido conserva sus permisos de servidor.

`RoomCare` reutiliza Modal y Participants en ambos modos; reúne nombres,
presencia/participación, silenciar/restaurar, normas, reportes/bloqueos según el
modo y votación de expulsión. Un acceso en el chat avisa de una votación activa.
Las simulaciones de presencia y votos se identifican expresamente. Los controles
de simulación permanecen disponibles durante una pausa para probar recuperación.

Silenciar usa IDs de participantes en memoria, sin llamadas al servidor ni
persistencia. El original de una cita silenciada queda no disponible hasta
restaurarlo, sin duplicar su contenido ni borrar la respuesta. No altera el
perfil, bloqueos, quórum, estado de participación ni acceso de otras personas.
La seguridad conserva confirmaciones y reportes locales o del piloto; no se
convierte una votación de sala en un baneo automático de cuenta.

## Validación y límites

Ambas compilaciones y TypeScript correctos, incluidos los 60 stickers.
**61 escenarios distintos aprobados** entre la regresión y las repeticiones
dirigidas: 58 de maqueta/laboratorio y 3 de piloto. Cubren perfil, reservas,
quórum/pausa/recuperación, reglas de ronda, texto/fotos/stickers, citas y gestos,
borradores, silenciar/restaurar, foco y diálogos anidados, historial compartido,
reportes, revisión, baneo apelable y expulsión por mayoría. Los cinco escenarios
nuevos (dos en escritorio/móvil y uno entre tres navegadores) comprueban los
comportamientos añadidos. Se aisló la prueba compartida nueva en otra temática
para no intentar entrar a una sala ya iniciada por la prueba anterior.

Compilación estática bajo `/web/` revisada a 320, 390, 768, 1024 y 1440 px:
conversación, guía plegada, citas y borrador, participantes, acceso directo a
normas y retorno con foco, silenciado y cierre. Sin desbordamiento horizontal,
errores JavaScript ni llamadas API. Campos a 16 px y escala 1. Cuatro auditorías
axe (sala y cuidados a 320/1440 px) sin infracciones detectadas. A 390×430 px se
comprueba el campo enfocado y el borrador conservado; esa altura reducida no
representa un teclado nativo iOS. No se probó un iPhone/iPad físico.

Capturas `afinia-sala-{conversacion,guia-plegada,cuidados,normas}-*.png`,
`afinia-sala-altura-reducida-390.png` y medidas `afinia-sala-revision.json`
en `/workspace/entregables/`. La inspección usa capturas de viewport para revisar
el comportamiento en pantalla, además de las capturas de elementos completos.

Siguiente propuesta: una prueba de usabilidad del recorrido Plaza → conversación
→ invitación/encuentro con unas cinco personas, observando comprensión, comodidad
y deseo de repetir antes de ampliar funciones o contratar infraestructura.
