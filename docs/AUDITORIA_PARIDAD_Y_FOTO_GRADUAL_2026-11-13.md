# Nexafia: inventario de capacidades y fotografía gradual

Fecha de corte: 13 de noviembre de 2026. Revisión de código `8ccb072`, propuesta de beta, Plan Maestro de traspaso y documentación del repositorio. El commit coincide con la rama remota al revisar. El historial del proyecto registra que se desplegó en el entorno protegido de Render; esta revisión no repite todas las pruebas en ese entorno ni acredita que esté listo para público. La documentación histórica contiene afirmaciones anteriores a ese despliegue; no usarlas como estado actual sin contrastar. El historial original de ChatGPT recuperado en el paquete es parcial.

Estados: **Compartido** = implementación en servidor e interfaz de pruebas; **Parcial** = capacidad incompleta o con una parte solo local; **Maqueta** = simulación/local; **Pendiente** = visión o propuesta sin implementación equivalente identificada. Una prueba local o despliegue no demuestra adopción, seguridad integral ni cumplimiento legal.

## Recorridos y paridad

| Capacidad | La Plaza | Conexiones | Encuentros | Riesgo o pendiente |
|---|---|---|---|---|
| Conversación entre cuentas | Compartido: posts y respuestas | Compartido: invitación aceptada y chat privado | Compartido: chat y presencia en sala programada | Aún no se ha realizado una comprobación integral de todos los recorridos en el entorno desplegado. |
| Responder a contenido concreto | Compartido: cita comentarios | Compartido: cita mensajes | Compartido: cita mensajes de sala | Validar con cuentas reales de prueba y tipos de contenido en los tres espacios; no extrapolar pruebas locales a todos los dispositivos. |
| Fotos y stickers en conversación | Compartido; subir desde respuesta y adjuntar después a contenido propio | Compartido; enviar y adjuntar a mensaje propio | Compartido: stickers; imágenes sujetas a configuración de moderación | No son fotos de perfil. Confirmar restricciones y disponibilidad en cada flujo; las rutas de carga y autorización son diferentes. |
| Bloqueo, reporte y apelación | Código compartido | Código compartido; acceso solo tras aceptación | Código compartido | Hay que asignar responsables, procedimientos, tiempos de atención y probar operación humana. Haber escrito código no equivale a moderación operativa. |
| Foto de perfil personal y revelación | Pendiente | Pendiente | Pendiente | No confundir imágenes adjuntas a mensajes con foto privada de perfil. M07 no está implementado. |
| Perfil e intereses personales | Formulario y datos de perfil en estado local | La maqueta muestra afinidad; no se identificó un perfil social compartido ni motor equivalente en la pantalla real | Algunos controles de perfil siguen locales | Persistencia por cuenta, visibilidad, sincronización y reglas de afinidad faltan por diseñar e implementar. |
| Guardar, ocultar, buscar y filtrar publicaciones | Existen en maqueta; pantalla compartida actual no ofrece paridad completa | No aplica directamente | Catálogo con páginas | Revisar cada control frente a código y con dos cuentas antes de prometerlo. |
| Notificaciones en campana | Respuestas reales de conversaciones seguidas | Mensajes privados | Cancelaciones: capacidad separada en servidor/agenda | El centro compartido lista respuestas y mensajes; avisos de invitaciones, aceptaciones y todos los eventos de encuentros requieren inventario e implementación. Push en teléfono requiere configuración y prueba en dispositivos; no asumir que está funcionando. |
| Correo y cuenta | Confirmación SMTP probada durante la sesión con dos cuentas de prueba | Mismas cuentas | Mismas cuentas | Confirmar entregabilidad y recuperación tras despliegues; edad/identidad no están verificadas por confirmar correo. |
| Continuidad y reencuentro | Invitación explícita desde contenido | Solicitud aceptada, rechazada o retirada; chat | Reserva y participación previstas | No acreditar un reencuentro recíproco completo desde el cierre de una sala ni una segunda actividad concertada sin probar e implementar su recorrido. |
| Exportación, eliminación y privacidad | Exportación parcial de datos propios | Igual; no incluye datos de terceros ni archivos | Igual; imágenes y datos locales quedan fuera | Borrado limitado solo en fixture interno para cuentas sin actividad; falta flujo integral de derechos, políticas y cobertura de respaldos/proveedores. |

## Mapa del Plan Maestro: no descartar funcionalidades

- **M01 Identidad y acceso — parcial:** cuenta, recuperación y confirmación de correo; sin verificación de identidad o edad. Google implementado como integración condicionada a configuración, sin prueba real confirmada aquí.
- **M02 Perfil y privacidad — parcial:** perfil local e información de cuenta; faltan perfil persistente por cuenta, privacidad por campo y derechos completos.
- **M03 Afinidad y descubrimiento — maqueta/parcial:** intereses declarados y vistas de ejemplo; falta un motor compartido comprobable, criterios y explicaciones basados en datos autorizados.
- **M04 Experiencias — parcial:** convocatorias, reservas y sala implementadas; falta probar extremo a extremo, preparar programación, soporte, continuidad y operación con personas reales.
- **M05 Anfitrión — guion, no IA generativa:** reglas y preguntas preescritas; IA opcional sigue como hipótesis, requiere finalidad, consentimiento, proveedor, evaluación y costo.
- **M06 Comunicación — parcial:** texto, imágenes y stickers por contexto, citas y avisos parciales. Pendientes por evaluar voz, video, carga, accesibilidad y paridad entre espacios.
- **M07 Fotografía gradual — pendiente y vigente en la visión:** consentimiento, autorización por destinatario, imagen privada y derivados auténticos. No existen 5–10 minutos aprobados como regla.
- **M08 Juegos y dinámicas — parcial/pendiente:** guion y participación en sala; juegos interactivos de la visión no identificados como un módulo compartido completo. Inventariar especificaciones antes de priorizar.
- **M09 Continuidad y reencuentro — parcial:** invitaciones de Plaza y conexiones; falta cerrar el flujo de expresar interés y, solo con acuerdo recíproco, concretar un siguiente encuentro. Grupos persistentes y agentes personales son posteriores/no aprobados como implementación.
- **M10 Confianza y M11 Operación — código parcial:** controles de bloqueo, reporte, apelación y roles; faltan cobertura humana, políticas, vigilancia de incidentes, monitoreo y recuperación fuera del servicio.
- **M12 Ingresos — pendiente:** propuestas de suscripción/publicidad históricas, sin cobro integrado ni precio validado. Condiciones, proveedor, impuestos, cancelación y soporte requieren diseño y revisión.
- **M13 Analítica — pendiente/parcial:** definir eventos mínimos y medir activación, asistencia, retorno y costos sin contenidos privados; no inventar cifras de adopción.
- **M14 Expansión — pendiente:** zonas horarias, idiomas, revisión legal, soporte y operación por país.

## Propuesta de experiencia fotográfica — no es una decisión ya aprobada

1. Perfil persistente de Nexafia asociado a la cuenta y separado de la confirmación de correo, con alias, intereses declarados, visibilidad y controles claros.
2. Invitar a subir una fotografía propia desde galería o tomar una selfie. Explicar dónde se mostrará, permitir vista previa, sustitución y retirada, y conservar una alternativa para quien no tenga cámara o prefiera no subirla. Capturar una selfie no prueba identidad, edad ni que la imagen no sea de otra persona.
3. Estado inicial privado por defecto. Por cada conexión, cada persona decide si desea compartir y a quién. La fotografía puede revelarse a la persona autorizada cuando ambas aceptan, sin convertir tiempo de chat, permanencia o silencio en consentimiento. Parámetros exactos y modalidad de consentimiento siguen por decidir.
4. Si se prueba revelación por etapas, generar en servidor versiones realmente limitadas y autorizar cada una; nunca enviar el original al navegador ocultándolo con CSS. Evitar CDN o URLs públicas que expongan el original. Revocar acceso futuro y advertir que no se pueden retirar capturas o copias externas.
5. Proteger el contenido por cuenta y destinatario, HTTPS, procesamiento limitado y eliminación de metadatos; bloqueo, reportes, retirada, límites y moderación. Establecer respaldo, retención y derechos antes de usar fotos de personas reales.
6. Las redes sociales son opción independiente: compartir enlace de perfil puede revelar identidad, ubicación o contactos y debe ser voluntario y tener su propia visibilidad. Un perfil vinculado no demuestra que la foto represente realmente al usuario. Nunca pedir contraseñas de redes ni extraer fotos mediante scraping.
7. Una verificación de identidad o comparación facial sería otro proyecto, con finalidad, tratamiento y revisión legal específicos. No se promete por hacer una selfie o conectar una red. La política actual comunica que no se solicitan cédula ni biometría; cualquier cambio debe revisarse explícitamente y actualizar textos.

## Redes y viabilidad revisada

- **Selfie o galería:** factible desde la web; captura mediante cámara varía según navegador y dispositivo. [MDN: captura](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/capture).
- **Instagram:** la API oficial con Facebook Login documentada por Meta está dirigida a cuentas profesionales y no accede a cuentas personales de consumidor; no prometer que una cuenta personal cualquiera entregará su foto. [Meta: Instagram API](https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api?entity=request-23987686-10bf8bf7-d9b7-4340-9c66-61d3ce683a87).
- **Facebook:** Meta describe acceso al nombre y foto pública mediante Facebook Login y consentimiento; aprobación, disponibilidad, términos de uso y posibilidad de copiar o transformar la imagen deben validarse para Nexafia. [Meta: Graph API](https://developers.facebook.com/docs/graph-api/get-started/).
- **TikTok:** Login Kit documenta acceso autorizado a avatar y nombre básico; configuración de desarrollador y aplicación, alcance y revisión aplicables son requerimientos a comprobar. [TikTok: Login Kit](https://developers.tiktok.com/docs/en/login-kit-overview?enter_method=left_navigation).
- **Chile:** fotografía identificable es dato personal; fotografía de perfil no es automáticamente verificación biométrica. La Ley 21.719 define biometría ligada a tratamiento técnico específico para identificar o confirmar de forma única. BCN muestra vigencia diferida al 1 de diciembre de 2026; requiere revisión jurídica de fechas, reglas y uso concreto. [BCN: Ley 21.719](https://www.bcn.cl/leychile/navegar?idNorma=1209272).

## Orden propuesto de trabajo

1. Convertir esta lista en matriz viva por capacidad y espacio, con fuente, decisión, fecha, criterio y evidencia; auditar lo ya desplegado con dos cuentas, incluido encuentro grupal y notificaciones.
2. Cerrar seguridad y operación necesarias para perfiles y fotos: responsables, privacidad, moderación, retención, derechos, copias fuera de Render y restauración.
3. Diseñar e implementar perfil real persistente; controles de visibilidad y foto propia por cámara o galería; no prometer verificación de identidad.
4. Implementar acuerdo de revelación por conexión, etapas de entrega segura y revocación de acceso futuro; probar intentos de descarga, bloqueos y cambio de foto.
5. Completar continuidad tras encuentros, filtros/guardados y avisos faltantes según criterios de usuario; probar flujo completo.
6. Evaluar integraciones opcionales de redes por proveedor y las condiciones vigentes; primero enlaces voluntarios, luego OAuth donde proceda y sea aprobado, sin usarlo como requisito de acceso.
7. Ordenar juegos, facilitador IA, voz/video, monetización y expansión por valor comprobable, costo, seguridad y aprobación del titular; ninguna de estas ideas se descarta por no estar en la primera entrega.
