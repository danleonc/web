# Acceso y confianza sin documentos

Decisión del usuario: explorar sin cuenta; participar con cuenta y correo
confirmado, declaración 18+, sin cédula, biometría ni insignias de identidad.
Primera vía: correo confirmado (incluye Gmail); Google requiere una integración
y configuración independiente, no se presenta como disponible.

Paleta vigente: verde #285d4c, tinta #293e35, crema #faf9f6, salvia #edf1e3,
lavanda #eee8f2. Georgia para títulos e interfaz sans para formularios. Campos
móviles a 16 px, acciones a 44 px. Se aplica frontend-design y su brief local.

```text
Explorar → crear/iniciar cuenta → confirmar correo → participar
                             ↘ seguir explorando
```

Estados: visitante, consultando sesión, cuenta pendiente, código enviado,
código inválido/caducado, correo confirmado, cuenta restringida y sesión vencida.
Se conserva el alias público y el borrador al abrir acceso. El correo solo se
muestra a su titular. El texto explica que confirmar correo no acredita identidad
ni edad. Las restricciones reales se validan en API y WebSocket.

La maqueta estática sigue identificada como simulación local: muestra la política
de acceso sin fingir envío de correos ni autenticación real. El piloto incorpora
confirmación real mediante transporte SMTP configurable; sin configuración no
se habilita la participación por una falsa confirmación. La Plaza y Conexiones
siguen siendo demostraciones locales, separadas de la mensajería compartida.

Revisión del brief: se reutilizan Modal y AccountPanel, sin nuevos proveedores
visuales, sin obligar a registrarse para entender la propuesta. No se contratan
servicios ni se envían mensajes a terceros durante el desarrollo.

## Implementación

Se centraliza la sesión en AccountProvider, compartida entre cabecera, acceso
global y salas. El piloto deriva el alias del titular autenticado; una cuenta
pendiente abre el acceso al intentar participar. La cuenta confirmada puede
retomar La Plaza, compartir e invitar sin exigir crear otro perfil de prueba.
La interfaz de cuenta conserva navegación y retorno del foco de Modal.

El formulario de correo muestra el código después de solicitarlo o al volver a
una solicitud pendiente. Los mensajes distinguen envío no disponible, fallo de
entrega, espera, código incorrecto/caducado y confirmación. Los formularios usan
campos a 16 px y acciones de 44 px; la cabecera móvil conserva el acceso sin
desbordamiento. El panel compacto omite reservas y explicaciones ajenas a la cuenta.

La política se aplica en API y WebSocket para acciones compartidas. SMTP es
configurable, con TLS obligatorio y sin códigos en respuestas/logs. Los códigos
son de un uso, ocho dígitos, diez minutos y cinco intentos, con límites de reenvío.
SQLite v3 conserva las cuentas anteriores y las deja pendientes de correo.
Procedimiento y límites: `docs/ACCESO_Y_CORREO.md`.

## Validación

Ambos builds y TypeScript correctos, incluidos los 60 recursos de stickers.
**100 escenarios distintos aprobados**: 39 servidor, 52 maqueta/laboratorio y
9 piloto, entre regresión y repeticiones dirigidas. Seis casos nuevos de servidor
cubren cuenta pendiente, protección de rutas/WebSocket, origen, declaración,
privacidad, código de un uso, intentos, espera, caducidad, dirección compartida,
reinicio y fallo de entrega. Cuatro casos nuevos de navegador (dos por modo de
pantalla) cubren la explicación honesta de la demo y el recorrido real de cuenta
pendiente → correo confirmado → compartir/invitar → cerrar sesión.

La regresión conserva publicaciones, comentarios, fotos, stickers, citas/gestos,
perfil, reservas, recuperación, quórum y salas compartidas, moderación, apelación,
expulsión, historial y teclado móvil. Las pruebas de servidor anteriores se
preparan ahora con correo confirmado real mediante transporte inyectado, sin
exenciones de permisos en el código de producción. El buzón del fixture vive
fuera del árbol servido y se elimina al cerrar.

Compilaciones estática y piloto revisadas a 320, 390, 768 y 1440 px: acceso,
cuenta pendiente y confirmada, continuación y borrador. Campos a 16 px, sin
desbordamiento horizontal ni errores JavaScript. La demo estática no llama a
la API. Cuatro auditorías axe (pendiente/confirmado a 320/1440 px) sin infracciones
detectadas. Capturas `afinia-acceso-{demo,pendiente,confirmado}-*.png` y medidas
`afinia-acceso-revision.json` en `/workspace/entregables/`. No se probó un iPhone
físico ni recepción con un proveedor real de correo.

`npm audit --omit=dev --audit-level=high` no reportó vulnerabilidades conocidas
en las dependencias de runtime. Esto no sustituye una auditoría de seguridad.

Siguiente: configurar SMTP con el proveedor elegido y comprobar recepción real
antes de desplegar el piloto. El acceso con Google y la persistencia compartida
de Plaza/Conexiones continúan como etapas independientes.
