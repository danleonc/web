# Agenda, recepción y respuestas con contexto

Plan con `frontend-design` y el brief de Afinia. Se conserva la marca floral,
verde `#2b5948`, tinta `#293f36`, fondo `#f8f8f4`, salvia `#edf1e3`, albaricoque
`#f2e1c9` y lavanda `#eee8f2`. Georgia para títulos, familias de interfaz actuales
para cuerpo de 14 px y controles/campos de 13–16 px, con acciones de 44 px.

```text
Agenda                             Recepción
[tu agenda + aviso de prueba]      [tema + horario de ejemplo]
[reserva guardada / completada]     [presentes / mínimo / máximo]
[fecha / hora / duración / grupo]   [listo para comenzar o faltan personas]
[entrar | detalles | cancelar]      [comenzar o esperar]
                                   [asistencia de prueba / otras opciones]
Mensaje o comentario
[autor]
[cita breve del original, si hay]
[texto / sticker / foto]
[Responder | acciones existentes]
[compositor: respondiendo a… | quitar cita]
```

Alineación a la izquierda, jerarquía entre acción principal y alternativas,
quórum expresado con texto además de cantidad/color, zonas horarias explícitas y
sin prometer eventos reales. Los controles de simulación se conservan separados
de las acciones habituales. La reserva no se reprograma automáticamente.

El usuario confirmó respuestas citadas en salas, chat privado y La Plaza. Se usa
un botón visible y un gesto hacia la derecha en móvil. El gesto respeta el scroll
vertical, el borde del navegador y los botones internos. Texto, stickers e
imágenes pueden responder a otro mensaje. Quitar una cita conserva el borrador;
enviar consume la selección solo si se acepta el envío. La cita permite volver
al original y enfocarlo. No se crean hilos infinitos ni se copia el contenido
original en cada respuesta.

Se guardan referencias por ID. El servidor valida que el destino pertenezca a la
misma sala y sea visible para quien responde; el contexto se resuelve desde los
mensajes disponibles. Un mensaje eliminado, bloqueado o fuera del historial no
reaparece a través de una cita. El historial del piloto conserva referencias sin
migrar el esquema de almacenamiento. La Plaza mantiene persistencia local y la
compatibilidad con comentarios anteriores.

Revisión contra el brief: la cita responde a una necesidad de conversación, sin
introducir un feed nuevo, niveles de respuesta anidados ni aceptación ficticia.
Se reutilizan imágenes, stickers, formularios y diálogos existentes. Se verifican
recorridos reales del servidor, controles táctiles, teclado, foco y móvil antes
de publicar la maqueta estática.

## Revisión visual y resultado

En la primera revisión móvil, la decoración y la explicación de la simulación
seguían retrasando el quórum. Se retira el símbolo ornamental en móvil y se
colocan horario, cantidad, estado y acción principal antes de las explicaciones
y controles de personajes. Con el mínimo, el estado explica que no hace falta
llenar el grupo; por debajo indica cuántas personas faltan. El fin de espera
conserva la reserva y ofrece reintento y alternativas, sin cambiar fecha o grupo.
Agenda distingue categoría, reserva guardada y simulación completada, con
fecha/hora de Santiago, duración, rango y siguiente paso hacia la recepción.

Las citas usan un componente común, un resumen de hasta 160 caracteres y dos
líneas visibles. Las fotos se citan como «Imagen», sin volver a cargar el recurso;
los stickers muestran su descripción. La referencia no conserva autor, texto,
miniaturas ni citas anidadas. El botón del original lo centra y enfoca con una
marca visible. Si no está disponible se muestra un estado no interactivo.

La vista previa permite cancelar sin tocar el borrador. Enviar un sticker
conserva el texto y la foto que ya estuvieran preparados, pero consume la cita
para ese envío. Un fallo local conserva el borrador y el contexto. En el piloto,
los mensajes pendientes de confirmación siguen siendo visibles y se pueden
reintentar o descartar; si el original venció, se indica descartar ese envío y
volver a enviarlo sin cita. Se mantiene la idempotencia aunque el original ya
haya salido del historial. Los datos antiguos sin `replyTo` siguen funcionando.

El gesto requiere intención horizontal hacia la derecha, con umbral de 56 px;
no intercepta scroll vertical, borde izquierdo, selección de texto ni controles
de formulario. La imagen mantiene el toque para ampliar; deslizarla cita sin
abrir el visor. Se corrigió la captura implícita del navegador para no cancelar
el arrastre cuando pasa del párrafo al contenedor. Siempre queda un botón
Responder como alternativa para teclado, ratón y tacto. Una indicación breve en
el compositor explica el gesto en dispositivos de puntero táctil.

La compilación estática bajo `/web/` se revisó en 320, 390, 768 y 1440 px:
Agenda vacía y con reserva, recepción lista y sin mínimo, fin de espera,
conservación de reserva, cita en sala/Plaza/chat privado y retorno con foco,
sin desbordamiento horizontal, errores JavaScript ni llamadas API. Capturas en
`/workspace/entregables/`: `afinia-agenda-*.png`, `afinia-recepcion-*.png` y
`afinia-cita-*.png`; resumen `afinia-agenda-respuestas-revision.json`.
Los gestos se probaron con eventos táctiles nativos de Chromium. No se dispone
de una prueba en dispositivo físico iPhone/iPad.

## Validación final

**152 escenarios distintos aprobados**: 17 reglas, 33 integraciones de servidor,
97 recorridos de maqueta/laboratorio y 5 de piloto con cuentas, entre la regresión
y las repeticiones dirigidas. Los diez escenarios nuevos de navegador cubren
cita, cancelación, persistencia, foco, foto/sticker/texto, borrado, bloqueo,
referencias entre publicaciones y gestos nativos en sala, Plaza y chat privado.
Las pruebas de tres navegadores y del historial de cuentas incorporan respuestas
citadas. Tres escenarios nuevos de servidor cubren referencias falsas/ajenas,
bloqueo en ambos sentidos, reinicio, retención e idempotencia.

El servidor utiliza una misma función de visibilidad para snapshots, historial
y validación de citas. Con cuentas consulta bloqueos persistidos en ambos
sentidos y reutiliza la decisión por remitente dentro de cada actualización;
no depende solo de que la otra cuenta esté conectada. No hay cambio de esquema
SQLite: `replyTo` es opcional dentro del mensaje JSON existente.

La auditoría general de escritorio agotó inicialmente los 30 segundos al
compartir recursos con otros recorridos; repetida sola terminó sin infracciones.
Se ajustó un selector de la prueba compartida para distinguir el texto original
de su nueva cita. Las comprobaciones finales de citas y sala compartida se
hicieron en serie, seguidas por accesibilidad y los cinco escenarios del piloto.
Ambas compilaciones y los 60 recursos de stickers son correctos.

La demo pública sigue siendo estática: sala y chat privado simulados, comentarios
locales. Las referencias compartidas y persistentes se validaron con el servidor
del piloto en local; no se publicó ese backend ni se contrataron servicios.
Siguiente propuesta: mejorar la vista de conversación y la claridad de sus
controles de guía y participantes. Sigue pendiente validar el gesto en el
iPhone/iPad físico del usuario.
