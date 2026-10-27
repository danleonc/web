# Auditoría visual de La Plaza

Aplicación de `frontend-design` y del brief local de Afinia. Alcance: presentación
inicial, descubrimiento de conversaciones y lectura/participación en una publicación.

## Observación inicial

Capturas y medidas de la compilación bajo `/web/`, con viewport de 900 px de alto:

| Ancho | Alto de bienvenida | Comienzo de primera publicación | Texto de publicación | Filtros | Controles menores de 44 px |
| --- | --- | --- | --- | --- | --- |
| 320 px | 601 px | 1141 px | 12 px | 9 px | 23 |
| 390 px | 471 px | 957 px | 12 px | 9 px | 23 |
| 768 px | 329 px | 795 px | 12 px | 10 px | 25 |
| 1440 px | 356 px | 811 px | 12 px | 10 px | 28 |

La bienvenida, su ilustración y la explicación de los tres espacios consumen la
primera pantalla móvil. Los tamaños pequeños dificultan escanear autores,
intereses y acciones. En las publicaciones ilustradas, el arte aparece antes del
título y retrasa la identificación de la conversación. Los controles necesitan
más área táctil. Las capturas iniciales no mostraron desbordamiento horizontal.

## Dirección y comprobación con el brief

Se conserva la identidad floral, la paleta cálida y la combinación editorial ya
aprobada. El cambio pone en primer plano las historias y preguntas de las
personas, de acuerdo con el propósito de La Plaza. Las ilustraciones acompañan
el contenido; las fotografías propias mantienen su encuadre y vista completa.

Paleta: verde `#2b5948`, tinta `#293e35`, marfil `#f8f8f4`, salvia `#edf1e3`,
albaricoque `#f2e1c9` y lavanda `#e9e2f0`. Se comprueba el contraste en el contexto
de cada control. Títulos con Georgia/`--serif`; cuerpo y controles con las
familias de interfaz actuales. Texto principal de 14–16 px, etiquetas legibles y
campos de 16 px para favorecer la escritura móvil.

Composición elegida, alineada a la izquierda:

```text
Escritorio                         Móvil
[ bienvenida breve | ilustración ] [ bienvenida breve + compartir ]
[ tres formas de conectar        ] [ tres espacios compactos       ]
[ conversaciones | encuentro     ] [ conversaciones + guardadas    ]
[ búsqueda/temas  | consejos      ] [ búsqueda y temas cómodos      ]
[ compartir      |               ] [ compartir                     ]
[ historia | historia            ] [ autor, título, texto, arte     ]
```

Se revisó la propuesta contra el brief: la identidad aprobada permanece; no se
introducen fuentes externas, bibliotecas de componentes ni animaciones
ornamentales. La bienvenida móvil reduce decoración para acercar la conversación.
Los títulos y textos de los ejemplos guían el diseño y se conservan las acciones
funcionales existentes, el consentimiento y las indicaciones de maqueta.

## Ajustes priorizados

- Compactar bienvenida y navegación explicativa en móvil; abreviar su texto.
- Aumentar legibilidad de texto, autores, etiquetas, filtros y búsqueda.
- Dar prioridad a la historia sobre la ilustración de ejemplo, preservando la
  presentación de fotos y la posibilidad de ampliarlas.
- Ampliar objetivos táctiles y mejorar el espacio entre acciones.
- Hacer más cómoda la lectura y escritura de respuestas en los diálogos.

## Resultado y revisión visual

| Ancho | Alto de bienvenida antes → después | Primera publicación antes → después | Botones de Plaza menores de 44 px antes → después |
| --- | --- | --- | --- |
| 320 px | 601 → 384 px | 1141 → 955 px | 23 → 0 |
| 390 px | 471 → 307 px | 957 → 793 px | 23 → 0 |
| 768 px | 329 → 302 px | 795 → 755 px | 25 → 0 |
| 1440 px | 356 → 324 px | 811 → 764 px | 28 → 0 |

Medidas de invitado con viewport de 900 px de alto. El cuerpo pasa de 12 a 14 px,
los filtros de 9–10 a 12 px y el buscador de 11 a 16 px. Los botones contabilizados
son los que tienen dimensiones visibles en La Plaza antes de abrir diálogos.
No es una auditoría de todos los controles del portal.

La revisión de capturas confirmó la jerarquía de las historias, el contraste
visual de la acción principal y la conservación de la identidad. Se acortó de
nuevo el texto de bienvenida después de la primera revisión. La ilustración del
hero se conserva en escritorio y se retira en móvil. El acceso móvil a Encuentros
permanece en las rutas compactas y la navegación inferior. En 320 px los filtros
ocupan dos filas para mantener tamaño y legibilidad; el comienzo de las tarjetas
sigue requiriendo desplazamiento.

La compilación estática bajo `/web/` se revisó a 320, 390, 768 y 1440 px: sin
desbordamiento horizontal, errores JavaScript ni llamadas API. Se comprobó abrir
y cerrar diálogos con Escape, el acceso como invitado, la escritura y guardado de
una respuesta con perfil y los campos de al menos 16 px. Chromium no equivale a
una prueba en iPhone/iPad físico.

Capturas y medidas comparables en `/workspace/entregables/`:
`afinia-plaza-inicio-{before,after}-*.png`,
`afinia-plaza-diseno-{before,after}-*.png`,
`afinia-plaza-dialogo-after-*.png` y
`afinia-plaza-auditoria-{before,after}.json`.

La navegación común, Conexiones y Encuentros quedan como siguiente revisión de
diseño. El alcance de esta entrega no añade usuarios ni intercambios reales.

Verificación final: ambas compilaciones correctas y 28 escenarios aprobados de
`ecosystem`, `plaza-images` y `plaza-invitations` en escritorio/móvil. Incluyen
accesibilidad, navegación, perfil, publicación/edición/borrado, fotos, respuestas,
invitaciones con contexto, regreso con foco y bloqueos.
