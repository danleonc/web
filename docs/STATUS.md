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
