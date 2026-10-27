# Procedencia e instalación

- Skill: `frontend-design`.
- Autor y repositorio de origen: [Anthropic, anthropics/skills](https://github.com/anthropics/skills/tree/dbd4588f9e1033efb41dad4bef2f7947c8993d44/skills/frontend-design).
- Revisión fijada: `dbd4588f9e1033efb41dad4bef2f7947c8993d44`.
- Copia de `SKILL.md`: sin modificaciones respecto de esa revisión.
- Licencia del material de origen: Apache License 2.0, incluida íntegra en `LICENSE.txt`.
- SHA-256 de `SKILL.md`: `d91970639e9f5c37682ac7ab60094d35f1c7c1f38d731bd56396563aee10c1d3`.
- SHA-256 de `LICENSE.txt`: `0d542e0c8804e39aa7f37eb00da5a762149dc682d7829451287e11b938e94594`.

## Alcance

La instalación se guarda en `.agents/skills/frontend-design/` dentro del
repositorio de Afinia. `AGENTS.md` indica leer la skill y su brief local cuando se
trabaje en la interfaz. Así las instrucciones quedan versionadas con el proyecto
y se pueden aplicar mediante lectura directa en la sesión actual y en los
futuros checkouts.

`references/afinia.md` es una guía añadida para este proyecto; no modifica el
contenido original. Describe las decisiones visuales aprobadas, componentes,
recorridos y comprobaciones pertinentes. Las instrucciones del usuario tienen
prioridad sobre las orientaciones generales de la skill.

La instalación contiene instrucciones y documentación. No ejecuta instaladores
remotos, añade dependencias a la aplicación, contrata servicios ni conecta cuentas
de 21st.dev. La licencia adjunta corresponde a los archivos de origen de la skill;
no cambia la licencia de la aplicación.

## Uso y mantenimiento

Puede invocarse como `$frontend-design` o aplicarse siguiendo las instrucciones
de `AGENTS.md`. La disponibilidad de un acceso en el menú de skills depende del
descubrimiento del cliente; la regla del repositorio proporciona la ruta de
lectura explícita.

Antes de actualizar la copia de origen, revisar los cambios, conservar su
licencia y registrar la nueva revisión y huellas. Actualizar el brief de Afinia
cuando el usuario cambie decisiones de producto o diseño.
