# Respaldos cifrados de Nexafia

## Transferencia al computador (preparación, no activada)

`scripts/local-backup.mjs` prepara una instantánea SQLite en la instancia activa, la transfiere por SSH, cifra el flujo recibido y solo publica el archivo nuevo después de comprobar autenticación e integridad mediante restauración temporal. Requiere clave SSH, huella de Render verificada en known_hosts y clave de cifrado de 32 bytes. Rechaza destinos SSH ajenos a Render y no sobrescribe copias existentes. Se probó con datos sintéticos, no con el servicio real.

**Estado 20-11-2026:** se registró con autorización una clave SSH dedicada en Render y se contrastó la huella de Oregon con la documentación de Render. La primera copia real y dos ejecuciones adicionales finalizaron con autenticación e integridad verificadas. La tarea de Windows `Nexafia - Respaldo local cifrado` se ejecutó correctamente: se inicia diariamente a las 11:00 y al entrar en la cuenta; conserva 14 archivos con el patrón de la tarea después de una copia exitosa, además de la primera copia manual. Se requiere equipo encendido, conexión y sesión de la cuenta configurada. La clave de cifrado se guarda con DPAPI en el equipo y como texto en la carpeta privada de Google Drive autorizada por Daniel: el control de esa cuenta es crítico. Se verificó por hash que la clave recuperada desde Drive coincide con la clave local usada para restaurar la copia real; no se ha ensayado en otro equipo.

La tarea `Nexafia - Avisos de respaldo` revisa diariamente a las 11:15 y cinco minutos después de iniciar sesión si la última copia falló, tiene más de 36 horas, falta o hay menos de 1 GiB libre (o menos de tres veces el tamaño de la copia, si es mayor). El estado se consulta en `%LOCALAPPDATA%\NexafiaBackup\ultimo-estado.txt`. Al detectar un problema intenta mostrar un cuadro durante 60 segundos; no envía correo ni avisa con el equipo apagado. Las reglas se probaron con fallas simuladas y se observó que el proceso creó la ventana; la visualización efectiva en una ejecución programada con fallo no se ha confirmado. La tarea programada sana finalizó con código 0.

El mismo monitor consulta mediante SSH verificado el espacio del disco montado en `/var/data` en Render. Avisa si queda 20 % o menos, marca como crítico 10 % o menos y avisa si no consigue comprobarlo. Verifica que el punto esté montado antes de medir y limita la espera SSH. El 20-11-2026 se comprobó el servicio real y una ejecución programada terminó con código 0; las condiciones de poco espacio y desconexión se probaron con datos simulados. La comprobación solo ocurre cuando se ejecuta la tarea en este computador y la ventana de fallo programado aún no se ha observado directamente; no sustituye alertas independientes del proveedor.

El proceso crea temporales SQLite sin cifrar en el servidor y en el computador durante la validación; los borra al finalizar normalmente pero un cierre inesperado puede dejarlos. Deben protegerse y revisarse. La clave SSH habilita acceso amplio a la instancia, no solo al respaldo; quien acceda a la cuenta de Windows que custodia la clave puede potencialmente usarla. El procedimiento respalda la base SQLite, no garantiza cubrir futuros archivos externos o secretos de proveedores.

## Estado

La herramienta original se verificó con bases sintéticas. Véase la sección anterior para el estado actualizado del respaldo local real. No borrar los respaldos existentes sin verificar su recuperación.

## Qué hace

`scripts/encrypted-backup.mjs` usa la API de respaldo de SQLite para generar una copia consistente y comprueba su integridad y claves foráneas. La cifra con AES-256-GCM, una clave aleatoria de 32 bytes y un nonce aleatorio nuevo por copia. La restauración comprueba la autenticidad, la integridad de SQLite y las claves foráneas antes de crear el destino. Nunca sobrescribe un archivo existente. La clave es independiente de la contraseña de Nexafia y no se genera ni se publica automáticamente.

El proceso necesita una copia temporal **sin cifrar** en una carpeta temporal privada del equipo que ejecuta el comando; se limpia al terminar normalmente o ante excepciones controladas, pero un corte brusco puede dejarla. En producción se debe usar un volumen temporal con permisos adecuados y cifrado en reposo, supervisar la limpieza y evaluar el riesgo; en Windows los permisos dependen también de las ACL. La restauración debe hacerse en una ubicación aislada y privada, no sobre la base activa.

## Clave y ejecución

Guardar la clave de 32 bytes en un gestor de secretos adecuado, fuera del repositorio y de los registros. La herramienta la recibe en la variable privada `NEXAFIA_BACKUP_KEY` como 64 caracteres hexadecimales. No escribir claves reales en comandos que queden en el historial, archivos de proyecto o mensajes. Proteger y respaldar esa clave por separado: sin ella la copia es irrecuperable. La rotación debe conservar acceso a copias anteriores y comprobar su restauración antes de retirar claves antiguas.

Una vez configurada de forma segura la variable en el proceso que ejecuta la herramienta:

```text
node scripts/encrypted-backup.mjs backup RUTA_BASE_EXISTENTE RUTA_COPIA_NUEVA
node scripts/encrypted-backup.mjs restore RUTA_COPIA_EXISTENTE RUTA_RESTAURACION_NUEVA
```

El segundo comando crea un archivo SQLite sin cifrar con los datos originales: protegerlo y usarlo solo en un entorno aislado. Comprobar que la aplicación y los datos esperados abren correctamente, documentar la prueba y limpiar la copia restaurada según el procedimiento operativo. Nunca restaurar sobre la base activa desde esta herramienta.

## Pendientes antes de confiar en recuperación

1. Configurar un destino externo cifrado y restringido, separado del disco del servicio; acordar costo y proveedor cuando sea necesario.
2. Programar ejecuciones y alertas ante fallos, falta de espacio o antigüedad excesiva, con retención y responsable definidos.
3. Hacer y documentar periódicamente una restauración aislada con datos reales, sin exponerlos y sin sobrescribir el servicio.
4. Acordar frecuencia de respaldo y objetivos de recuperación; las copias del mismo disco no cubren pérdida del proveedor o del disco.
5. Verificar que la gestión de claves, los temporales y las copias cumplen las obligaciones de privacidad aplicables. La herramienta por sí sola no acredita cumplimiento.

## Opción preparada: almacenamiento externo compatible con R2

Se preparó `scripts/r2-backup.mjs` como opción de **ejecución manual**, desactivada por defecto y sin cambios en el arranque del servicio. Genera una copia SQLite consistente cifrada antes de enviarla, crea un objeto con nombre único y condición de no sobrescritura, solicita validación MD5 durante la subida y descarga el objeto para comparar tamaño y SHA-256. No borra respaldos existentes ni crea buckets. Las pruebas usan un transporte simulado y el SDK firmado en memoria; no demuestran que una cuenta o bucket real funcionen. El límite actual de cada copia es 1 GiB y la operación de red tiene un plazo de 120 segundos.

La ejecución requiere `NEXAFIA_BACKUP_KEY`, `NEXAFIA_R2_ACCOUNT_ID`, `NEXAFIA_R2_BUCKET`, `NEXAFIA_R2_ACCESS_KEY_ID` y `NEXAFIA_R2_SECRET_ACCESS_KEY` en el entorno privado. La clave de cifrado debe conservarse también fuera de Render y separada de las credenciales del bucket. El token de R2 debe limitarse al bucket necesario; los permisos de escritura pueden permitir eliminar objetos, por lo que esta solución no equivale a copias inmutables. Mantener otra copia o control de retención independiente si se requiere protección ante credenciales comprometidas.

Cloudflare indica que R2 requiere activar una suscripción mediante su flujo de checkout y que se cobra el consumo que exceda el tramo gratuito. A la fecha de preparación, el plan Standard incluye 10 GB-mes y franquicias de operaciones; comprobar condiciones, impuestos y configuración de la cuenta antes de activarlo. No se ha creado ninguna cuenta, bucket, clave ni suscripción, y no se ha transferido información real. Fuentes: [inicio de R2](https://developers.cloudflare.com/r2/get-started/), [precios](https://developers.cloudflare.com/r2/pricing/) y [tokens restringidos](https://developers.cloudflare.com/r2/api/tokens/).

Antes de la activación siguen pendientes: elegir y autorizar el destino y su facturación, definir retención y alertas, resolver la programación dentro del servicio con disco, configurar y custodiar secretos y ejecutar un ensayo real de restauración. La herramienta no programa copias ni habilita alertas por sí sola. No almacenar la clave en el mismo lugar que la copia como único respaldo.
