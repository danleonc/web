# Línea fotográfica para La Plaza y Conexiones

Continuación autorizada de la dirección aprobada en Encuentros, aplicando
`frontend-design` y el brief de Afinia. La Plaza representa compartir intereses
cotidianos; Conexiones, continuar una conversación con interés mutuo. Se crean
dos escenas propias con adultos en espacios separados, sin simular miembros,
perfiles, testimonios, aceptaciones o funciones de vídeo.

Paleta: verde `#2b5948`, tinta `#293f36`, fondo `#f8f8f4`, salvia `#edf1e3`,
albaricoque `#f2e1c9`, lavanda `#eee8f2`. Georgia y familias de interfaz actuales.
Se conserva el fondo uniforme bajo títulos y botones. Las escenas se identifican
como ilustrativas y creadas con IA, sin asociarlas a nombres o tarjetas de perfil.

```text
Escritorio                         Móvil
[ título y explicación | escena ] [ franja de escena              ]
[ acción principal     | origen ] [ título, explicación y acción  ]
[ conversaciones o afinidades   ] [ conversaciones o afinidades   ]
```

Texto alineado a la izquierda, escena a la derecha en escritorio, franja breve
en móvil. En La Plaza se busca que los intereses den un punto de partida; en
Conexiones, una expresión natural de atención a lo que otra persona compartió.
Las imágenes son editoriales, con luz y encuadres compatibles, evitando repetir
la misma escena en las tres secciones.

Revisión contra el brief: los retratos se mantienen en el banner y separados
de los perfiles; las relaciones y sus estados no cambian. La entrada mantiene
su llamada a compartir y Conexiones su acceso a conversaciones. Se reutiliza el
patrón fotográfico de Encuentros y se centraliza figura, recursos adaptables,
texto alternativo y leyenda para mantener coherencia. Imágenes WebP locales en
480/768/1280 px, sin proveedores externos en runtime. Los campos móviles siguen
protegidos por `src/mobile-inputs.css` al final de la cascada.

## Implementación y revisión visual

Se incorporan dos escenas generadas originales, con dos adultos en espacios
separados en cada una. La Plaza combina teléfono, portátil, libros, música y
objetos creativos; Conexiones muestra atención tranquila a mensajes, con una
paleta de salvia y lavanda. No se utilizan como avatares ni perfiles. Ambas
mantienen la leyenda «Escena ilustrativa · creada con IA».

`HeroPhoto` centraliza figura, texto alternativo, leyenda, dimensiones reservadas
y selección de imagen. Encuentros reutiliza el componente sin cambiar su escena,
encuadre ni alturas. Los seis nuevos WebP pesan entre 23 722 y 94 480 bytes;
procedencia, dimensiones y hashes en `docs/assets/{plaza,conexiones}-online.json`.
El navegador descarga únicamente el recurso del espacio visible. No se añaden
servicios externos de imágenes ni dependencias.

La revisión renderizada a 320, 390, 768, 1024 y 1440 px comprueba los tres banners:
caras reconocibles, texto y acciones sobre color uniforme, leyenda legible y
sin desbordamiento. En móvil, la franja de La Plaza y Conexiones ocupa 140–180 px;
en escritorio, la escena acompaña el texto sin desplazar las llamadas a la acción.
Se conservan los botones, recorridos, estados y tamaños de campos existentes.

Validación: compilaciones estática y piloto correctas, incluidos TypeScript y
los 60 stickers; seis auditorías axe (tres espacios a 320 y 1440 px) sin infracciones
detectadas. Se verifican imágenes WebP cargadas, apertura/cierre de diálogos,
retorno a La Plaza, detalle de encuentro e invitación pendiente con retorno al
comentario, sin errores JavaScript ni llamadas API en la maqueta. Capturas
`afinia-fotos-{plaza,connections,discover}-{inicio,banner}-*.png` y medidas en
`/workspace/entregables/afinia-fotos-tres-espacios-revision.json`.
La comprobación móvil usa Chromium; no equivale a una prueba en iPhone físico.

La regresión existente `ecosystem` y `plaza-invitations` completa **20 escenarios
aprobados** en escritorio/móvil: exploración, filtros, guardados, publicaciones,
comentarios, perfiles, bloqueos, invitaciones pendientes, retorno con foco y
accesibilidad. No cambian las funciones locales ni se publica el backend.

Siguiente propuesta: revisar los controles de conversación, guía y participantes
en las salas con la misma jerarquía y comodidad móvil.
