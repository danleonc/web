# Acceso directo con Google

Continuación autorizada: Google como alternativa al usuario/contraseña y correo
confirmado. Se aplica frontend-design y el brief vigente. Explorar sigue abierto;
Google no acredita identidad civil ni edad y no habilita cuentas sancionadas.

Paleta: verde #285d4c, tinta #293e35, crema #faf9f6, salvia #edf1e3, lavanda
#eee8f2. Georgia para títulos y sans para formularios, campos a 16 px y acciones
de 44 px. Botón blanco de Google con su G multicolor, integrado al panel actual.

```text
[ Continuar con Google ]
[ o usar usuario y contraseña ]
          ↓ redirección y retorno al mismo espacio
[ alias público + declaración 18+ ] → continuar
```

Estados: proveedor sin configurar (no botón activo), redirigiendo, cancelación,
fallo/caducidad, cuenta nueva pendiente de alias/edad, lista, restricción y
vinculación explícita. En una cuenta existente: «Vincular cuenta de Google»;
no se fusionan por correo. El acceso por contraseña conserva su funcionamiento.

Revisión del brief: se reutilizan Modal/AccountPanel y la sesión compartida; no
se añaden documentos, foto de perfil de Google, datos de Gmail ni permisos sobre
contactos. Se solicita solo OpenID y correo. La demo estática explica el flujo
sin fingir autenticación con Google; el proveedor debe configurarse en el piloto.

## Implementación y validación

Se añade GoogleAccess con el botón de Google y GoogleProfile para alias/18+.
La sesión central comparte opciones y resultado del retorno; cancelar/fallar
abre la cuenta con explicación. Enlazar requiere entrada previa y conserva el
usuario existente. La redirección se bloquea durante encuentros activos. El
borrador de publicación se guarda temporalmente en sessionStorage con control
de titular; al salir o cambiar cuenta se limpia el borrador de la vista.

OAuth usa código, PKCE S256, state y nonce, validación JOSE y cookie de navegador
HttpOnly/Lax; en HTTPS usa __Host-/Secure/Path=/ sin Domain. No se guardan tokens
de Google ni se reciben permisos de Gmail/contactos. SQLite v4 conserva datos
y añade vínculos por sub y flujos temporales. Credenciales por variables del
servidor y Compose; sin configuración el proveedor no se presenta como activo.

Ambos builds, TypeScript y 60 stickers correctos. **104 escenarios distintos
aprobados**: 47 servidor, 15 piloto y 42 maqueta/laboratorio en regresión dirigida.
Ocho escenarios nuevos de servidor cubren configuración ausente, cookies HTTPS,
Google-only sin contraseña, firma/issuer/aud/nonce/expiración, state y cookie,
repetición, cancelación, fallo, persistencia, vinculación segura y sanciones.
Seis recorridos nuevos de navegador cubren cuenta nueva/alias/edad, enlace con
conservación del borrador/cuenta y cancelación/token inválido en escritorio/móvil.
Se conserva el recorrido de contraseña/correo, recuperación, reservas, mensajes,
imágenes, moderación y apelación. La auditoría npm de runtime no reportó
vulnerabilidades conocidas; no equivale a una auditoría de seguridad completa.

Revisión renderizada de ambas compilaciones a 320, 390, 768 y 1440 px: explicación
de demo, entrada con Google, alias pendiente y cuenta lista; también proveedor
sin configurar a 390 px. Campos a 16 px, sin desbordamiento horizontal ni errores
JavaScript. Cuatro auditorías axe (entrada/alias a 320/1440 px) sin infracciones
detectadas. La demo no llama a la API. Capturas `afinia-google-*.png` y medidas
`afinia-google-revision.json` en `/workspace/entregables/`.

El proveedor usado es un fixture privado que firma tokens RSA y simula Google;
se mantienen activos JWT/PKCE/state/nonce/cookies/permisos del código de producción.
No se probaron cuenta real de Google, consentimiento real ni iPhone físico. El
usuario pidió dejar preparada la configuración: instrucciones y límites en
`docs/GOOGLE_LOGIN.md`. Siguiente: crear el cliente OAuth, registrar el callback y
configurarlo en el piloto HTTPS antes de la prueba con cuentas reales.
