# Afinia · Plaza, Conexiones y Encuentros

Dirección recuperada de la conversación de ChatGPT compartida por el usuario y autorizada para la maqueta el 25 de octubre de 2026. La participación a cualquier hora convive con las sesiones programadas. El contenido sirve para relacionarse: no se introducen seguidores, rankings públicos, likes ni un feed infinito.

| Espacio | Intención | Recorrido implementado en la maqueta |
| --- | --- | --- |
| La Plaza | Compartir a tu ritmo, incluso sin personas conectadas simultáneamente. | Explorar, filtrar, buscar, guardar, publicar, responder y volver después. |
| Conexiones | Descubrir intereses compartidos y decidir si continuar. | Afinidades explicadas, invitaciones pendientes, conversación de origen y retirada de interés. |
| Encuentros | Compartir tiempo con un grupo pequeño. | Catálogo de tres convocatorias amplias, reservas y recepción con las reglas existentes. |

## Navegación y participación

La Plaza es la entrada (`/` y `#plaza`). Se mantienen `#discover` para Encuentros y las rutas anteriores de conexiones, agenda, perfil y laboratorio/piloto. En móvil hay barra inferior con los tres espacios; agenda y perfil siguen en el menú, que conserva Escape, contención y retorno del foco.

Una Plaza compartida concentra la participación en **Historias y cultura, Crear y descubrir y Pequeñas cosas**. La lista termina y se divide en páginas de cuatro entradas. Se puede explorar sin perfil. Compartir, responder e invitar requiere un perfil de prueba con declaración de mayoría de edad, sin obligar a reservar. No se verifica edad ni identidad.

Se pueden crear, editar y eliminar publicaciones propias, responder, guardar conversaciones y ocultarlas/restaurarlas. El editor conserva el borrador en memoria al cerrarlo o cambiar de espacio; eliminar pide confirmación. Las respuestas de personajes que aparecen inicialmente son ejemplos fijos; no se generan como si alguien hubiese contestado.

Una conversación puede llevar a una invitación para su autor o a un encuentro relacionado. Las invitaciones quedan pendientes, pueden retirarse y volver a su origen. **No se envían ni se fabrica aceptación recíproca.** El chat privado con stickers sigue siendo una demostración. Las afinidades se ordenan por intereses expresados en el perfil, sin porcentajes de compatibilidad ni análisis de conversaciones privadas.

Los bloqueos de personajes de las salas se respetan también en sus publicaciones, respuestas, afinidades e invitaciones locales. Ocultar una conversación y bloquear una persona son acciones distintas.

## Identidad y diseño

Se adopta **Afinia como nombre de trabajo de la interfaz** siguiendo el contexto aportado; no acredita disponibilidad comercial de marca. Marca floral, verde profundo, crema, albaricoque y lavanda, tipografía editorial e ilustraciones SVG propias. No se usan fotos reales, avatares generados presentados como usuarios, métricas de actividad inventadas ni imágenes remotas.

Los espacios comparten navegación, botones y jerarquías, con cabeceras e intenciones distintas. Se añaden estados vacíos, confirmaciones, foco inicial en el editor, retorno de foco, contraste, adaptación móvil y respeto de movimiento reducido. Las pruebas automáticas no sustituyen evaluación con tecnologías de asistencia.

## Datos y límites

Se conserva `entre.prototype.v1` para proteger perfiles, reservas, evaluaciones, bloqueos y stickers existentes. Se añade `plaza` con publicaciones, respuestas, guardados, ocultos e invitaciones. Su validación es independiente: datos inválidos de Plaza no borran un perfil anterior válido. Exportar incluye esta sección; borrar datos locales la reinicia. Los nombres técnicos y de descarga anteriores se mantienen por compatibilidad.

Límites: 30 publicaciones propias, últimas 100 respuestas propias y hasta tres invitaciones a perfiles de ejemplo. Los borradores sin publicar no se exportan ni sobreviven a recargar. Los chats de demostración siguen siendo efímeros.

**Los espacios nuevos son una maqueta local, también en el build del piloto con cuentas.** No añaden endpoints de Plaza, sincronización de publicaciones entre personas, chat privado real ni moderación operativa. El backend de cuentas, reservas e historial de salas se mantiene separado. No se contrata infraestructura ni se modifica `polysdeals.com`. El build estático utiliza el flujo de GitHub Pages existente.

## Qué viene después

Validar la comprensión y los recorridos con la maqueta. Después, si se decide avanzar, conectar Plaza al backend con autenticación, permisos, persistencia y moderación; a continuación invitaciones con aceptación real y chat privado autorizado.

La conversación aportada incluía IA generativa, MiroFish, fotografías progresivas, publicidad y comunidades creadas por usuarios. No se incorporan como decisiones automáticas. Demanda, captación y rentabilidad continúan pendientes de validación.
