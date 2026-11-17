# Desafío de descubrimiento de foto de Conexiones

Fecha: 16 de noviembre de 2026. Decisión del titular: una meta real de diez idas y vueltas y revelación automática al completarla; no presentar al final un botón opcional que frustre la expectativa. La foto debe representarse antes con una ilustración desenfocada y candado, nunca enviando la imagen original sin autorización.

## Reglas a implementar

- Antes de enviar o aceptar una conexión nueva, informar claramente que las fotos se compartirán automáticamente al completar diez vueltas. El acto de iniciar o aceptar la conexión debe recoger ese acuerdo de forma expresa. Las conexiones anteriores no deben quedar sujetas retroactivamente: pedir a ambas personas que activen el desafío, sin cerrar sus chats ni revelar fotos hasta ese acuerdo.
- Una vuelta es un mensaje de cada persona en una secuencia de ida y vuelta. No equivaler diez mensajes seguidos de una persona a diez vueltas. Definir el algoritmo de conteo en servidor y probar secuencias repetidas, mensajes de texto, imagen y sticker, duplicados y simultaneidad. Mostrar progreso igual a ambos miembros y actualizado tras reinicio.
- Al completar la décima vuelta, habilitar automáticamente cada foto autorizada para la otra cuenta en esa conexión. Comprobar pertenencia, estado aceptado, bloqueos, moderación y que las fotos se encuentren disponibles antes de servirlas. No liberar originales ni derivados antes del hito. Mantener los permisos anteriores ya otorgados; no inferir aceptación nueva de un estado histórico ambiguo.
- Cambiar o retirar una foto, bloqueo, cierre de conexión o moderación deben impedir acceso futuro según reglas explícitas; no prometer retirar copias externas. Una foto de reemplazo requiere decidir y comunicar si hereda el acuerdo o requiere confirmación; no asumir permiso para una imagen distinta.
- Guardar el progreso y la evidencia mínima del acuerdo con migración versionada, conservar respaldos y ensayar restauración antes del despliegue. Actualizar inventario y reglas de privacidad, borrado y exportación. No usar datos biométricos ni afirmar verificación de identidad.
- Probar servidor, migración desde la versión vigente, dos cuentas, aislamiento de terceros, intentos de omitir controles desde la API, reemplazo y retirada, reinicio y navegador escritorio/móvil. La interfaz debe explicar la regla brevemente, mostrar el progreso real y mantener accesibles reportes y bloqueos.

## Estado de esta sesión

Existe un cambio visual local preliminar con bokeh ilustrativo y burbujas de chat, comprobado en recorridos de navegador. Todavía conserva la mecánica previa de compartir mediante botón y no representa el desafío aprobado: no desplegarlo ni describirlo como implementación completa. La arquitectura del desafío, migración y pruebas quedan pendientes.

## Implementación local · 16 de noviembre

Se implementó la migración v23→v24 y un estado de desafío por conexión. En conexiones nuevas con requisito de foto, enviar y aceptar exige el acuerdo expreso sobre el desbloqueo. En conexiones anteriores, cada persona puede activar el desafío sin perder el chat ni revocar fotos compartidas previamente. El conteo comienza después de ambos acuerdos; una vuelta requiere un mensaje de cada persona y mensajes repetidos de un mismo remitente no acumulan vueltas. A las diez vueltas se crean los permisos de ambas fotos en la misma transacción que registra el mensaje. La foto real no se entrega antes del desbloqueo sin un permiso anterior explícito. La ilustración bloqueada no contiene la foto real.

Retirar o reemplazar una foto invalida el acuerdo de esa imagen y reinicia el desafío; la imagen nueva requiere un acuerdo nuevo. Bloqueo y cierre impiden acceso futuro. La función limitada de borrado y el inventario se revisaron para el esquema nuevo. No se afirma eliminación de copias externas ni validación legal.

Verificación local: pruebas de autorización, acuerdo de dos personas, mensajes repetidos/idempotentes, desbloqueo, reinicio, foto reemplazada, bloqueo, moderación, migración sintética v23 y regresión de privacidad. Navegador en escritorio/móvil con dos cuentas. El despliegue sigue pendiente: antes se requiere copia consistente actual y ensayo de migración/restauración sobre esa copia, que no se han realizado en Render para esta versión.

## Protección del despliegue preparada

El arranque normal incorpora una comprobación específica cuando detecta la base v23: crea una copia consistente privada en el mismo directorio, valida integridad y claves foráneas, ensaya la migración en otra copia y compara los conteos de cuentas, conexiones, fotos y permisos antes de abrir la base activa. Si el ensayo falla, no inicia la migración y conserva el respaldo. El comportamiento se probó localmente con el proceso real de arranque y una base sintética. La copia no está fuera de Render y su ejecución sobre la base del entorno solo se podrá confirmar durante el despliegue; no sustituye un respaldo externo restaurable.
