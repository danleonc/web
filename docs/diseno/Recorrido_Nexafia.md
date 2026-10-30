# Conoce Nexafia · recorrido sobre componentes reales

Corrección solicitada: el usuario esperaba foco real en los componentes que llevan
a cada sección, con interacción directa. Se reemplazan las tarjetas de ejemplo
por un foco sobre la aplicación: el elemento real permanece iluminado y se puede
pulsar. La explicación breve se coloca junto a él sin taparlo.

Cinco paradas que recorren los tres espacios: acceso La Plaza; «Descubre afinidades»
en Plaza; pestaña «Tus invitaciones» en Conexiones; acceso Encuentros; convocatoria
real de Encuentros. Cada clic ejecuta la acción normal y avanza. Siguiente activa
el mismo control; Anterior regresa. La última convocatoria abre su detalle, sin
reservar. Terminar permite quedarse en Encuentros. Salir/Escape restaura el espacio
de origen y el borrador de publicación que permanece en App.

El menú móvil se cierra al iniciar y se utiliza la navegación inferior. Se mantiene
la preferencia local anterior; el recorrido no se abre por sí mismo. Las rutas del
recorrido reemplazan el hash sin añadir entradas al historial. No se inicia durante
una sala o edición de perfil, para evitar interrumpir esos procesos.

Paleta y tipografía vigentes: verde #285d4c, tinta #293e35, fondo #faf9f6, crema
#f3f1e8 y foco #a46743; Inter/Georgia. Máscara suave sin desenfoque, contorno sobre
el control y explicación alineada a izquierda, lateral en escritorio o arriba/
abajo en móvil. La posición responde a scroll, orientación y tamaño. No hay copias
de controles ni una capa que bloquee el objetivo. El resto no activa acciones.

La explicación no es modal: el componente real sigue enfocable. Tab recorre
objetivo y controles; Escape siempre sale. Se asocia la explicación al objetivo
con aria-describedby, limpiándolo al terminar. Si un objetivo no está disponible,
Anterior/Salir permanecen operativos. La guía no publica ni manda invitaciones,
no cambia reservas y no solicita cuenta o datos. Sin dependencias o seguimiento.

Verificar clic y teclado sobre controles reales, pantalla 320, redimensionado,
objetivo no tapado, regreso de ruta/foco/borrador, preferencia y almacenamiento
bloqueado, conservación de datos y apertura del detalle sin reserva.
