# Respaldos cifrados de Nexafia

## Estado

Herramienta local preparada y verificada con bases sintéticas. **No hay programación ni copia externa configuradas por este cambio**, y no se ha probado una restauración de los datos alojados en Render. Antes de usarla con datos reales, definir almacenamiento externo, permisos, ubicación segura de la clave, retención, supervisión y responsable operativo. No borrar los respaldos existentes.

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
