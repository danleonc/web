# Diseño de Conexiones y Encuentros

Aplicación de `frontend-design` al recorrido afinidad → invitación → actividad.
Se conserva la identidad floral y editorial aprobada. No se cambian las reglas
ni la persistencia; las conexiones de la maqueta siguen siendo locales.

## Diagnóstico y plan

En 320/390 px, la primera actividad empieza a 1729/1524 px desde el inicio:
dos bloques explicativos separan la bienvenida de la exploración. Las tarjetas
usan cuerpo de 10–12 px y varias acciones no alcanzan 44 px. Las invitaciones
acumulan contexto y botones con poco espacio por columna; la flecha de cada
actividad exige interpretar qué ocurrirá al tocarla.

Paleta: verde acción `#2b5948`, tinta `#293f36`, fondo `#f8f8f4`, salvia
`#edf1e3`, albaricoque `#f2e1c9` y lavanda `#eee8f2`. Georgia/`--serif` para
los títulos y familias de interfaz existentes para cuerpo y controles. Cuerpo
14 px, controles 12–14 px, campos 16 px. Foco visible y sin fuentes externas.

```text
Conexiones                         Encuentros
[bienvenida breve | flor/afinidad]  [título + bienvenida breve | arte]
[Afinidades | Tus invitaciones]    [temas + búsqueda]
[perfil o contexto de invitación]  [fecha / tema / tamaño / acción]
[acción principal y alternativa]   [cómo participar + acceso a Plaza]
[chat de demostración separado]    [principios]
```

Todo se alinea a la izquierda para leer y comparar. En móvil se reduce arte y
texto introductorio, con columnas cómodas según el espacio disponible. Las
invitaciones conservan citas y mensajes largos, estado de ejemplo y retorno al
origen. Las actividades muestran explícitamente fecha, zona horaria, tamaño de
grupo y acción; la reserva permanece separada de la exploración.

Revisión contra el brief: se reutilizan tarjetas, botones, ilustraciones,
diálogos y estados existentes. Se evita añadir métricas de popularidad, perfiles
fotográficos, actividad ficticia o nuevos flujos. Se trasladan las explicaciones
extensas después de las actividades, conservándolas para quien las necesite.
El acento visual sigue estando en la flor y las ilustraciones del producto.

## Revisión de la implementación

La primera revisión detectó que el espacio reservado para la ilustración móvil
seguía añadiendo 180 px vacíos después de ocultarla. Se retiró ese relleno, se
acortó la promesa de bienvenida a «Conoce personas compartiendo» y se simplificó
la explicación previa a los temas. La bienvenida mantiene su ilustración en
escritorio. Las explicaciones sobre participación y el acceso a La Plaza siguen
disponibles después de las actividades.

Las tarjetas de encuentros conservan sus controladores y nombres accesibles.
La flecha aislada da paso a «Conocer encuentro» o «Ver reserva»; ambas acciones
abren el detalle y la reserva se confirma en un paso separado. La tarjeta indica
fecha/hora, horario de Santiago, datos de ejemplo y rango de participantes;
una reserva guardada se distingue con texto e icono, manteniendo visible el
rango del grupo. No se presenta el máximo como quórum necesario.

Las invitaciones muestran primero destinatario y estado de ejemplo, conservan el
aviso de que nadie ha recibido la solicitud y luego muestran conversación,
comentario y mensaje propio. Se destaca «Volver al comentario/conversación»;
el encuentro relacionado y retirar la intención siguen siendo alternativas.
La aceptación recíproca y el chat real continúan pendientes de backend. El chat
de demostración queda separado de las tarjetas de afinidad e invitación.

## Comparación

Vista de invitado, 900 px de alto, antes de abrir diálogos:

| Ancho | Primera afinidad antes → después | Primera actividad antes → después | Botones menores de 44 px Conexiones / Encuentros antes → después |
| --- | --- | --- | --- |
| 320 px | 705 → 682 px | 1729 → 989 px | 10 / 13 → 0 / 0 |
| 390 px | 634 → 649 px | 1524 → 823 px | 10 / 13 → 0 / 0 |
| 768 px | 638 → 658 px | 1252 → 885 px | 10 / 13 → 0 / 0 |
| 1440 px | 621 → 643 px | 1032 → 799 px | 10 / 14 → 0 / 0 |

El cuerpo de las tarjetas pasa de 10–12 a 14 px; sus acciones a 13 px y los
campos a 16 px. Las afinidades ocupan algo más de altura en algunos anchos al
priorizar lectura y tacto. En 320 px la exploración sigue necesitando desplazar
la pantalla. La medida de 44 px solo incluye botones con dimensiones visibles
dentro de estas dos páginas; no es un inventario de controles de todo el portal.

Las actividades y afinidades se distribuyen en una columna hasta 900 px, dos
entre 901 y 1400 px y tres en pantallas más amplias. Las invitaciones usan como
máximo dos columnas para que el contexto tenga espacio.

La revisión de compilación estática bajo `/web/` cubre 320, 390, 768 y 1440 px:
estados vacío, afinidad e invitación guardada; búsqueda sin resultados y
recuperación; invitación de invitado; detalle y reserva previa; retorno al
comentario enfocado. No se observaron desbordamientos horizontales, errores
JavaScript ni llamadas API. Las capturas están en `/workspace/entregables/`,
con nombres `afinia-{connections,discover,pendiente}-*-*.png`, `afinia-detalle-after-*.png` y
`afinia-tarjeta-{connections,discover}-after-*.png`.
Los datos comparables están en `afinia-espacios-auditoria-{before,after}.json`.
Estas comprobaciones usan Chromium; no se probó un iPhone/iPad físico.

Verificación final: compilaciones estática y piloto correctas, incluidos los 60
stickers, y **36 escenarios de navegador aprobados** en escritorio/móvil mediante
`ecosystem`, `journey` y `plaza-invitations`. Cubren navegación, filtros,
estados vacíos, perfil, reserva/cancelación, sala local, continuidad individual,
bloqueos, exportación/reset, invitaciones con contexto, foco y auditorías axe.
La próxima revisión propuesta cubre Mi agenda y la recepción de las salas para
mantener claros reserva, horario y quórum durante todo el recorrido.
