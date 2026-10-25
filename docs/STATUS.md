# Estado del prototipo · 15 de octubre de 2026

Fuentes: solicitud «Texto pegado.txt» y Plan Maestro adjunto. El archivo de solicitud termina al inicio del apartado 26. Se usa la resolución de contradicciones documentada en `/workspace/entregables/Base_de_ejecucion.md`: no exigir intención romántica/amistad, priorizar experiencias grupales, mantener control y consentimiento. Los apartados posteriores del plan no se presentan como instrucciones adicionales del usuario.

## Decisiones de esta iteración

- ADR-006: React + TypeScript + Vite para validar el recorrido sin contratar backend ni proveedores. No fija la arquitectura final del piloto. Un monolito con PostgreSQL sigue siendo propuesta para la etapa con datos reales.
- ADR-007: estado local con catálogo sintético y guion determinista. No llamadas a IA, métricas remotas ni carga de fotografías. Imágenes SVG ilustrativas propias.
- ADR-008: «Entre» es un nombre de trabajo para el prototipo; no reemplaza una decisión comercial o búsqueda de marca.
- ADR-009: mayoría de edad declarada es una barrera de navegación de prueba. No equivale a identidad verificada ni resuelve la política de elegibilidad del piloto.
- ADR-010: mostrar interés no habilita un contacto. Las aceptaciones recíprocas no se simulan como reales.

## Trazabilidad resumida de lo entregado

| Requisito de la base de ejecución                        | Estado de esta iteración                                 | Límite                                                                                |
| -------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| R01/R04 Descubrimiento sin intención y onboarding ligero | Implementados en prototipo                               | Perfil local; sin cuenta real.                                                        |
| R05/R06 Perfil y límites editables                       | Implementados en prototipo                               | No hay autorización de servidor ni usuarios reales.                                   |
| R07 Recomendación explicable                             | Coincidencia explícita de intereses y filtro             | No hay motor predictivo, ranking o inferencias sensibles.                             |
| R09 Anfitrión                                            | Guion fijo con control de activación                     | No IA ni análisis de conversación.                                                    |
| R12 Grupos programados                                   | Catálogo, reserva y cancelación locales                  | No cupos compartidos ni horario de acceso real.                                       |
| R15 Continuidad                                          | Selección local y retirada de interés                    | Nadie recibe solicitudes; no hay consentimiento de terceros.                          |
| R16 Chat                                                 | Interfaz de mensajes en memoria                          | No entrega real, WebSocket, historial ni cifrado de extremo a extremo.                |
| R19 Bloqueo y denuncia                                   | Bloqueo de personajes y denuncia explícitamente simulada | No moderación, apelación ni respuesta humana.                                         |
| R23 Internacionalización base                            | Interfaz es-CL, fechas UTC y America/Santiago            | Sin traducciones adicionales ni expansión jurídica.                                   |
| R24 Datos personales                                     | Exportar y borrar datos locales                          | No solicitudes de derechos ante un servidor real.                                     |
| R28 Calidad                                              | Compilación, E2E escritorio/móvil, foco y revisión axe   | Sin auditoría de seguridad ni certificación de accesibilidad.                         |
| R02/R03/R14/R17/R18/R20/R22/R25–R27/R30–R32              | Pendientes del piloto o etapas posteriores               | Sin credenciales, fotografías, audio, notificaciones, IA, pagos o verificación legal. |
| Investigación, demanda y métricas reales                 | Pendientes                                               | Las pruebas funcionales no validan mercado ni efecto social.                          |

## Antes de utilizar datos o participantes reales

1. Probar comprensión, accesibilidad y facilidad de salida con datos ficticios; registrar problemas sin recoger conversaciones privadas.
2. Seleccionar primera comunidad y política de edad, presupuesto y capacidad de moderación.
3. Verificar fuentes jurídicas oficiales, bases de tratamiento, proveedores, plazos de retención y documentación profesionalmente revisada.
4. Construir autenticación y autorización, migraciones de base de datos, transacciones de cupo, consentimiento y bloqueo en servidor.
5. Implementar mensajería real, denuncias operativas, evidencias limitadas y apelación antes de abrir salas reales.
6. Probar aislamiento entre cuentas, recuperación de respaldos y eliminación de datos; después ejecutar un piloto cerrado.

No se declara listo para producción ni se ha publicado. El análisis original es histórico: sus frases «sin implementación» describen el estado anterior a esta iteración. Este archivo y el README describen el prototipo actual.

## Validación realizada en el entorno

- Instalación reproducida con `npm ci` y lockfile, usando caché escribible en `/workspace/.npm-cache`.
- `npm run build`: TypeScript y compilación Vite correctos.
- `npm test`: 16 pruebas completadas y aprobadas (8 escenarios en escritorio y móvil), incluyendo axe en las pantallas principales.
- Versión compilada servida con `npm run preview`: inicio, navegación al perfil y menú móvil comprobados en Chromium, incluido cierre con Escape y retorno del foco; sin errores JavaScript observados.
- Capturas de escritorio y móvil disponibles en `/workspace/entregables/`.
- `install_script` y `start_skill` guardados en el borrador de configuración cloud. Pendientes de revisión, guardado y publicación por el usuario; no se verificó restauración en una tarea nueva.

Durante la comprobación de instalación se detectó caché obsoleta de un Vite que seguía abierto mientras se reinstalaban dependencias. Reiniciar esa instancia corrigió las respuestas 504 de módulos optimizados. Las 16 pruebas posteriores al reinicio pasaron. También se corrigió el foco del menú móvil antes de comprobar la compilación servida.

## Actualización · 16 de octubre de 2026

Con autorización del usuario se subieron el código a `master` y la compilación estática a `gh-pages` de `danleonc/web`. La aplicación se verificó también con servidor estático bajo `/web/`; usa rutas relativas para sus recursos. Se añadió `npm run deploy:pages` para repetir la publicación sin cambiar el checkout ni forzar la rama remota. La activación y disponibilidad pública de GitHub Pages siguen pendientes de comprobación; consultar `docs/DEPLOYMENT.md`. Las afirmaciones anteriores de «no enviado a GitHub» corresponden al estado histórico previo.

## Actualización · 19 de octubre de 2026 · Stickers

R33 confirmado por el usuario: stickers en salas y chats privados, con catálogo amplio y variado. Se implementan 144 stickers propios y un selector compartido con categorías, búsqueda, favoritos, recientes y confirmación. Las salas incorporan envío de imágenes de catálogo y se añade un chat individual explícitamente simulado para probar el mismo recorrido. No se crea contacto real ni se interpreta una solicitud de reencuentro como aceptada. Se conservan perfiles antiguos y se amplían exportación y borrado para incluir preferencias de stickers. Ver `docs/STICKERS.md` para alcance, criterios y requisitos de servidor pendientes.

Verificación de R33: compilación correcta y 22 pruebas aprobadas en escritorio/móvil; los 144 assets de stickers se sirven correctamente bajo `/web/`. Se comprobaron envío, vista previa, preferencias compartidas, migración de perfiles, exportación, reinicio, teclado y accesibilidad automática. Las conversaciones continúan sin persistirse.

## Dirección de producto · 19 de octubre de 2026 · Oferta y quórum

El usuario prioriza temas amplios y oferta concentrada para reunir quórum; los intereses específicos se exploran dentro de la conversación. La creación libre de salas por usuarios se difiere en la primera etapa. Se conservan los grupos pequeños y los límites de participación. Rangos, plazos y contingencias son propuestas pendientes de validar e implementar; consultar `docs/producto/Oferta_y_quorum.md`. Este cambio documenta producto y no altera el funcionamiento de la demo.

## Implementación · Oferta concentrada, recepción y ritmo de sala

Se aplican las decisiones de la conversación: tres convocatorias amplias, fecha de ejemplo futura compartida, presentación centrada en experiencia grupal y continuidad, recepción de 3–6 participantes ficticios, espera limitada, falta de quórum sin reprogramación automática, reconexión y guía de preguntas con plazos. Se añaden estados explícitos de participación, indicador efímero de escritura, extensión única, mayoría de presentes para otra pregunta e interés de repetir con el grupo. Los stickers y las preferencias existentes se conservan. La guía sigue siendo un guion local, sin IA generativa ni lectura de conversaciones. Ver `docs/GUIA_SALAS.md` para reglas y límites; los documentos estratégicos anteriores mantienen su carácter histórico.

Validación de esta iteración: compilación y 45 comprobaciones (13 reglas del motor y 32 recorridos de navegador). Comprobación de la compilación servida bajo `/web/` con portada, recepción, guía, stickers y continuidad grupal. Se actualizan únicamente código y demo; no se integra un modelo de IA ni un servidor de presencia/mensajería.

## Implementación · Laboratorio compartido entre navegadores

Se añade una prueba local separada de la maqueta pública: API Node/WebSocket con sesiones de desarrollo, presencia, quórum, texto y stickers compartidos. El servidor controla plazos, votos únicos por sesión, aforo, pausas y reconexión. No hay personajes ficticios en esta vista. Las pestañas de la misma sesión cuentan una vez. El bloqueo obliga a salir e impide coincidir con la identidad bloqueada mientras dure la sesión. Se conserva la maqueta anterior y sus datos locales.

Esta actualización amplía R12/R16 para pruebas de desarrollo: hay cupos y mensajes compartidos en memoria, sin cuentas verificadas, base de datos, sincronización de reservas, chat privado real, moderación o IA. La API no se despliega con GitHub Pages y el laboratorio se excluye de la compilación pública. Alcance y arranque: `docs/SALAS_COMPARTIDAS.md`. Las limitaciones históricas anteriores describen la maqueta estática.

Validación: instalación reproducida con `npm ci`, compilación correcta y **55 comprobaciones aprobadas** (13 de reglas, 9 de servidor y 33 de navegador). El recorrido compartido verifica texto, stickers, voto único entre pestañas, pausa, reconexión con borrador conservado, bloqueo y accesibilidad automática. Se comprobó además `npm run dev:shared` con tres contextos y la compilación estática bajo `/web/` sin laboratorio ni llamadas API. Se actualizó `start_skill` en el borrador cloud; su guardado no publica el entorno ni acredita restauración en una tarea nueva.

## Implementación · Cuentas, reservas e historial persistente

Se añade un modo de piloto separado de la maqueta pública y del laboratorio efímero. Implementa registro, login, logout y recuperación mediante clave de un solo uso con rotación; contraseñas derivadas con scrypt y sesiones opacas almacenadas como hash. SQLite conserva cuentas, sesiones, reservas, bloqueos, salas, mensajes e identificadores de reintento. R05/R12/R16/R19 ahora pueden probarse entre cuentas persistentes. Los demás recorridos de la maqueta no se migran ni pasan a ser servicios reales.

Las reservas comparten un máximo de seis plazas mediante transacciones y evitan duplicados y solapamientos por cuenta. Se persiste la fecha inicial, se exige reserva para entrar y se respeta recepción/inicio/cierre. Reiniciar marca a todos desconectados, conserva plazos y no fabrica presencia. El historial se limita a miembros, últimos 50 mensajes por sala y 30 días tras archivar. El borrado/exportación local de la maqueta no afecta al servidor.

ADR-011: SQLite integrado en Node 24 para una sola instancia de piloto y despliegue portable; PostgreSQL sigue siendo una opción para una fase con más carga. ADR-012: recuperación con clave guardada por el usuario, sin email ni proveedor externo. ADR-013: build separado `dist-pilot/`, servidor del mismo origen y volumen persistente; la demo `dist/` y GitHub Pages no exponen registro ni la API.

El usuario confirmó con soporte que su HostGator Plan Personal compartido no admite adecuadamente este backend. Se preparan Docker/Compose/proxy y guía para un servidor compatible, sin contratar un VPS ni modificar `polysdeals.com`. Pendiente elegir/proveer alojamiento y acceso seguro para publicar. Continúan pendientes moderación/denuncias operativas, controles de datos de cuenta, programación de convocatorias sucesivas, identidad/edad verificadas e IA generativa. Ver `docs/CUENTAS_Y_DESPLIEGUE.md`.

Validación de esta entrega: ambas compilaciones correctas y **68 comprobaciones aprobadas** (13 reglas, 19 integraciones de servidor, 33 recorridos de maqueta/laboratorio y 3 de piloto). Se comprueban copia consistente, restauración, reinicio y caída mediante una copia en vivo, cupos simultáneos, aislamiento de historial, retirada de permisos al salir de recepción, recuperación/rotación y retención a 30 días. El contenedor se construyó y se probó con usuario sin privilegios, raíz de solo lectura y volumen persistente; cuenta y reserva sobrevivieron a su reinicio. La compilación estática se comprobó bajo `/web/`, sin ruta de cuenta/laboratorio ni llamadas API. Estos resultados locales no acreditan un despliegue en HostGator.

## Ecosistema e identidad · 25 de octubre de 2026

Con autorización del usuario se organiza la maqueta en **La Plaza, Conexiones y Encuentros** y se adopta Afinia como nombre de trabajo visual. La Plaza es la entrada y permite participación sin horario: conversaciones por tres temas amplios, búsqueda, guardados privados, paginación, publicaciones/respuestas locales y edición/eliminación de publicaciones propias. Conexiones muestra afinidades explicadas por intereses declarados e invitaciones pendientes. Hay recorridos entre conversación, invitación y encuentro relacionado; no se fabrican aceptaciones. Los bloqueos de los personajes se respetan entre espacios.

Se renuevan marca floral, paleta cálida, jerarquías, ilustraciones SVG y cabeceras. Móvil incorpora navegación inferior de tres espacios. Se conserva el perfil anterior y `entre.prototype.v1`, con una sección `plaza` validada por separado, incluida en exportación y borrado local. Los borradores sin publicar solo permanecen en memoria. Ver `docs/ECOSISTEMA.md`.

Estas funciones de Plaza e invitaciones siguen siendo una **maqueta local**, incluso en el build de piloto: no añaden API de comunidad, chat privado real ni moderación operativa. Se mantiene el backend de cuentas, reservas e historial de salas. No se contrata alojamiento ni se modifica el dominio de HostGator. IA generativa, MiroFish y fotografías progresivas continúan fuera de esta iteración.

Validación: ambos builds correctos y **80 comprobaciones aprobadas** (13 reglas, 19 servidor, 45 navegador de maqueta/laboratorio y 3 de piloto). Los 12 recorridos nuevos comprueban navegación, filtros, guardados, perfil sin reserva, creación/respuesta/edición/eliminación, borrador, invitaciones, consentimiento, migración y bloqueos, con auditoría axe y anchura en escritorio/móvil. El build estático se comprobó bajo `/web/` en 320, 390, 768 y 1440 px, con recursos, enlace de conversación a encuentro, cero llamadas API y sin errores JavaScript. Siguiente paso: validar comprensión y recorridos con el usuario antes de sincronizar Plaza e invitaciones en el backend.

## Imágenes y convivencia · 25 de octubre de 2026

Se incorpora una imagen por publicación de Plaza y adjuntos en encuentros, con selector, compresión, descripción accesible, ampliación, descarga, ocultar y reportar. La maqueta guarda archivos y reportes en este navegador; la Plaza sigue sin sincronización de servidor. Se conservan perfiles, bloqueos y preferencias de stickers. La exportación incluye referencias de imágenes; el borrado limpia sus archivos locales. Los adjuntos de chat de maqueta son efímeros.

El piloto incorpora cargas autenticadas y normalizadas, permisos por sala/propietario, límites de almacenamiento, reportes con evidencia de servidor, consola de moderación y decisiones auditadas. Hay retirada de imagen/encuentro, suspensión temporal, baneo y apelación. El rol se asigna explícitamente desde el servidor a una cuenta existente; no hay administrador predeterminado. Las imágenes compartidas se habilitan cuando existe moderación configurada. Se proporciona la herramienta, sin afirmar que haya un equipo humano atendiendo.

La expulsión por mayoría es independiente del baneo. Tiene electores fijados al inicio, mínimo dos votos, plazo de un minuto, silencio sin voto, una decisión por cuenta y dos minutos entre solicitudes. No se difunden votos individuales. El servidor cierra todas las conexiones de quien sale, impide su reingreso, recalcula quórum y conserva resultado/plazos tras reiniciar. La votación termina si se cierra el encuentro. La maqueta permite simular votos de personajes y los identifica como tales.

ADR-014: archivos WebP de hasta 350 KiB y 1280 px, sin metadatos, con validación independiente de servidor; BLOB en SQLite para el piloto de una instancia. ADR-015: expulsión solo del encuentro; sanción de cuenta revisada y apelable. La migración v1 → v2 conserva cuentas, reservas e historial. Normas, límites, operación y siguientes pasos: [IMAGENES_Y_CONVIVENCIA.md](IMAGENES_Y_CONVIVENCIA.md).

Validación de esta entrega: **103 comprobaciones aprobadas** (17 reglas, 30 integraciones de servidor, 51 recorridos de maqueta/laboratorio y 5 de piloto). Incluyen permisos y rechazo de suplantación, voto único entre pestañas, cierre de votación al terminar, reinicio, migración v1, EXIF, animación y SVG rechazados, cuotas concurrentes, retirada de archivos, baneo multisesión, caducidad y apelación. Se volvió a comprobar bloqueo entre Plaza y salas, exportación/reset y los flujos de imágenes en escritorio/móvil tras el último ajuste. Ambos builds y Docker correctos; ejecución sin root/raíz escribible, conversión WebP nativa y persistencia del rol/reserva tras reiniciar verificadas. Compilación estática bajo `/web/` comprobada a 320, 390, 768 y 1440 px sin llamadas API, errores JS ni desbordamiento horizontal. Capturas actualizadas en `/workspace/entregables/afinia-convivencia-*`. El borrador de arranque cloud se guardó y requiere revisión, guardado y publicación del entorno para aplicarse; eso es independiente de la demo. No se ha validado restauración en una tarea nueva.

Siguiente: validar con un grupo cerrado y un responsable de convivencia antes de conectar La Plaza y las invitaciones a usuarios reales. Continúan pendientes despliegue del backend, operaciones de moderación, política de retención administrativa y controles de datos de cuenta.

## Corrección de fotos de cámara y compatibilidad móvil · 25 de octubre de 2026

El usuario reportó en iPhone/iPad «No se pudo comprimir esta imagen». La implementación anterior exigía que `canvas.toBlob` devolviera WebP, incluso en navegadores que devuelven PNG cuando ese codificador no está disponible; además, solo reducía calidad y rechazaba originales de más de 5 MiB o 16 megapíxeles antes de procesarlos.

Se separa la preparación de fotos del almacén local. Se admiten originales JPG/PNG/WebP de hasta 40 MiB y 120 megapíxeles (20 000 px por lado), con identificación por contenido y lectura previa de dimensiones. Se solicita decodificación reducida cuando el navegador la admite; si falta o falla `createImageBitmap`, se abre mediante una imagen ordinaria. Se respeta la orientación EXIF. La salida intenta WebP, JPG y PNG según disponibilidad, y reduce progresivamente calidad y resolución hasta obtener como máximo 350 KiB; no se pide comprimir manualmente. Se conserva la eliminación de metadatos. El selector muestra progreso y reducción de peso. Las descargas locales usan su extensión real; el piloto envía el MIME del archivo preparado y lo normaliza nuevamente en el servidor. No cambia la migración SQLite ni los datos existentes.

Validación: **119 comprobaciones aprobadas** (17 reglas, 30 servidor, 67 recorridos de maqueta/laboratorio y 5 de piloto), TypeScript, ambos builds y contenedor correctos. Los 16 escenarios nuevos de navegador cubren una foto de 24 megapíxeles y más de 5 MiB, falta/rechazo de WebP/bitmap, orientación, MIME ausente, PNG alternativo, reducción adicional de resolución, descarga JPG y recuperación tras seleccionar un archivo que excede el límite. El piloto móvil reproduce falta de WebP para verificar la entrega real de JPG entre cuentas. La compilación estática bajo `/web/` comprueba preparación compatible, publicación, recarga y orientación a 390 y 1440 px, sin API ni errores JS. Se comprueban de nuevo arranque y persistencia del contenedor. Estas pruebas reproducen capacidades de navegador en Chromium; el entorno no dispone de un dispositivo físico iOS ni WebKit instalado. Siguiente: confirmar la foto original en el iPhone/iPad del usuario y continuar la validación del grupo piloto.
