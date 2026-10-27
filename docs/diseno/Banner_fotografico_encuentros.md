# Banner fotográfico de Encuentros

Aplicación de `frontend-design` al primer banner de Encuentros, según la
propuesta aceptada por el usuario. El objetivo es comunicar cercanía humana
mediante una escena de apariencia fotográfica, con adultos diversos y gestos
naturales, participando desde sus propios espacios. La actividad sigue siendo
online. La escena generada es ilustrativa y se identifica como tal; no es una
foto de miembros, un testimonio ni una captura de funciones del producto.

Se conserva la paleta de Afinia: verde `#2b5948`, tinta `#293f36`, fondo
`#f8f8f4`, salvia `#edf1e3`, albaricoque `#f2e1c9` y lavanda `#eee8f2`.
Georgia para los títulos y familias actuales para controles y cuerpo. La luz,
la ropa y los interiores de la escena deben encajar con esa paleta.

```text
Escritorio                         Móvil
[ título + descripción | escena ]  [ escena breve                  ]
[ explorar / perfil    |        ]  [ título, descripción y acciones]
[ tamaño del grupo     | origen ]  [ tamaño del grupo + origen     ]
[ temas y actividades           ] [ temas y actividades           ]
```

La fotografía ocupa el lado derecho en escritorio, con texto y controles sobre
un fondo uniforme. En móvil aparece como una franja breve del mismo banner,
sin ocultar la acción principal ni superponer texto sobre rostros. Una leyenda
legible informa el origen generado. Los recursos se sirven localmente como
WebP en varios tamaños para reducir peso y sin proveedores externos en runtime.

Revisión contra el brief: se cambia el recurso principal, no el sistema de
identidad completo. La escena debe mostrar personas desde lugares distintos,
sin una mesa compartida que sugiera una cita presencial, ni interfaz falsa que
prometa funciones de vídeo. Se evita una pose de publicidad o una estética de
aplicación de citas. Las figuras de las actividades y los stickers quedan como
recursos de apoyo; esta entrega empieza por el banner acordado.

## Implementación y revisión

Se genera una composición fotográfica de tres adultos usando sus portátiles en
espacios distintos. Se revisa la imagen completa y los recortes del banner: los
rostros permanecen visibles, el texto tiene fondo uniforme y las acciones no
se superponen a la fotografía. La leyenda «Escena ilustrativa · creada con IA»
permanece visible. No se usan nombres, testimonios, actividad ni perfiles de
personas reales.

La escena original se conserva en el espacio de generación; el repositorio
incluye tres versiones WebP optimizadas, de 480, 768 y 1280 px (24 528, 47 248 y
96 676 bytes). Vite genera sus nombres con huella de contenido. `srcset` y `sizes`
eligen el recurso según el espacio disponible y la densidad de pantalla. El
banner reserva altura antes de cargar para evitar saltos, y prioriza su imagen
sin añadir dependencias o solicitudes a proveedores externos. La procedencia,
dimensiones, tamaños y hashes de los archivos están en
`docs/assets/encuentros-online.json`.

En escritorio el texto queda a la izquierda y la escena a la derecha. Hasta
1200 px se apilan; la franja fotográfica de móvil mide entre 160 y 200 px para
mantener visible la acción del banner. El resto de la exploración mantiene
filtros, búsqueda, detalle y reserva separados.

Verificación: compilaciones estática y piloto correctas, incluidos TypeScript y
los 60 stickers. Se aprobaron seis recorridos existentes de escritorio/móvil
(reserva, chat local, continuidad, filtros/búsqueda y foco/Escape). La compilación
bajo `/web/` se revisó a 320, 390, 768, 1024 y 1440 px: imagen visible y descargada
como WebP, leyenda, navegación a actividades, detalle y perfil, sin desbordamiento,
errores JavaScript ni llamadas API. Las auditorías axe de 320 y 1440 px terminaron
sin infracciones detectadas. Los cinco tamaños solicitaron la versión de 47 248
bytes en los dispositivos simulados. Capturas `afinia-banner-foto-*.png` y
resumen `afinia-banner-foto-revision.json` en `/workspace/entregables/`.
No se probó un iPhone/iPad físico.

Siguiente propuesta: extender esta dirección fotográfica a La Plaza y Conexiones,
con escenas propias para cada espacio y preservando su identidad y legibilidad.
