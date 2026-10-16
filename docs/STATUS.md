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
