# Salas compartidas · laboratorio de desarrollo

Esta iteración prueba las reglas de Entre con conexiones de navegador reales. Está separada de la maqueta estática y no habilita un servicio público, cuentas verificadas ni una IA generativa.

## Arranque

Node.js 24, dependencias del lockfile instaladas y puertos 4173/8787 libres:

```sh
cd /workspace/web
npm run dev:shared
```

El comando mantiene Vite y la API juntos y detiene ambos al salir. Vite reenvía `/api` y WebSocket al servidor, que escucha únicamente en `127.0.0.1:8787`. No requiere claves ni proveedores externos. `npm run dev` arranca solo la maqueta; para editar el servidor hay que reiniciar el proceso. `NODE_ENV=production` impide arrancar esta API de desarrollo.

En la aplicación de desarrollo aparece **Laboratorio local**. Preparar un perfil con alias de prueba, elegir una de las tres temáticas y aceptar el aviso antes de conectar. Para representar tres personas, usar tres perfiles o contextos independientes de navegador. Pestañas que comparten cookie cuentan como una sola persona. Esta función no aparece en `npm run build`, `preview` ni GitHub Pages.

## Reglas comprobadas

- Una recepción por temática, mínimo 3 y máximo 6 sesiones distintas. La guía no cuenta. Puede iniciarse con el mínimo; a los cinco minutos el servidor inicia si hay quórum o cierra la recepción si falta. No cambia reservas ni ofrece una fecha automáticamente.
- Los asistentes se incorporan en recepción. Tras empezar solo pueden reconectar miembros del mismo grupo; no se rellenan plazas con desconocidos durante una conversación. Cada sesión puede estar en una sola temática y abrir hasta tres conexiones.
- El servidor decide presencia, identidad, reloj, respuestas, extensión y votos. El navegador solo envía acciones propias. No puede modificar el reloj, votar por otra persona o agregar participantes ficticios.
- Rondas de 90 segundos, una extensión compartida de 30 segundos, estados listo/paso/escucho y escritura efímera de cuatro segundos. Escribir no prolonga la ronda ni equivale a terminar de responder. Otra pregunta exige mayoría estricta de presentes y un voto por sesión, aunque haya varias pestañas. Banco fijo de hasta tres preguntas; no se lee ni interpreta el contenido mediante IA.
- Al caer bajo tres presentes, se pausa el envío durante un minuto. Si reconectan a tiempo se retoma conversación libre; si no, termina el encuentro. Duración total máxima de 40 minutos. Una conexión que no responde al latido se termina en hasta aproximadamente 20 segundos; la pérdida de red no se detecta instantáneamente.
- Texto y stickers se entregan a las conexiones de esa sala, con identidad asignada por el servidor. Los envíos tienen confirmación e identificador para reintentar sin duplicar dentro de la ventana retenida. Se permiten hasta 20 pendientes en la vista; se pierden al abandonarla. No se promete entrega después de reiniciar el servidor.
- Bloquear registra la decisión en la sesión del servidor y desconecta todas las pestañas de quien bloquea. Impide coincidir con esa identidad mientras duren ambas sesiones. No sustituye denuncias ni moderación; crear otra sesión de desarrollo produce otra identidad.

## Datos y límites

La cookie es opaca, aleatoria, `HttpOnly`, `SameSite=Strict`, limitada a `/api` y dura cuatro horas. Se usa HTTP de loopback en desarrollo. El alias y la declaración de edad **no verifican identidad ni edad**. No hay inicio de sesión de producción ni cifrado de extremo a extremo.

Todo el estado del servidor es volátil: hasta 200 identidades y tres salas; hasta 50 mensajes y 200 identificadores de reintento por sala. Una sala sin conexiones se elimina tras cinco minutos. Reiniciar elimina salas, bloqueos e historial. Para repetir inmediatamente una sesión terminada se puede reiniciar el servidor. No se registran contenidos de conversación en consola ni se crea una base de datos.

Los perfiles, reservas y favoritos existentes siguen en `localStorage`. Exportarlos o borrarlos desde la maqueta solo afecta ese navegador: no exporta ni borra el historial compartido del servidor. El laboratorio no sincroniza reservas, contactos, chats privados ni evaluaciones entre dispositivos.

La API comprueba origen permitido y cookie al abrir un WebSocket, valida el esquema de cada acción y limita tamaño, ritmo de eventos y conexiones. Estas medidas acotan la prueba local; no representan una auditoría de seguridad. No exponer Vite ni la API de este laboratorio como servicio público.

## Validación y siguiente etapa

`npm run test:server` prueba varias conexiones, cookies, aislamiento, cupo, reintentos, plazos, votos, bloqueos y caducidad con un reloj de servidor controlado exclusivamente desde los tests. No existe un endpoint que cambie el reloj. `npm test` añade las pruebas del motor y navegador: tres contextos independientes comparten texto, stickers, decisiones y reconexión, además de los recorridos anteriores de la maqueta.

Para un piloto con usuarios se necesita un backend desplegado con HTTPS, autenticación recuperable, almacenamiento y transacciones, reservas compartidas, política de datos, moderación y denuncias operativas. La IA anfitriona sigue siendo una decisión posterior: las reglas de quórum y tiempo ya pueden probarse sin depender de un modelo.
