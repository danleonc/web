# Notifications Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans inline; no delegation requested. Steps use checkbox syntax.

**Goal:** Revisar avisos de conversaciones, silenciar hilos y preparar avisos voluntarios al teléfono.
**Architecture:** Reducer local por referencias/cuenta, centro React y controles de hilo. Web Push separado con suscripción autenticada y prueba al propio dispositivo; los eventos reales de Plaza quedan pendientes de su backend.
**Tech Stack:** React/TypeScript/CSS, Node24/SQLite, Web Push/Service Worker.
**Spec:** docs/diseno/Notificaciones.md

## Global Constraints

- Mantener datos/IDs existentes; sin avisos inventados o permisos automáticos.
- No contratar servicios, enviar avisos reales o cambiar DNS; VAPID solo preparación.
- Silenciar persiste al volver a responder, sin reenvío al reactivar.
- No mezclar cuentas ni exponer contenido bloqueado/eliminado.

## Review Focus

- Datos antiguos/corruptos: conservar perfil y publicaciones; pruebas de carga.
- Duplicados y acciones propias: no inflar contador; pruebas del reducer.
- Cambiar cuenta o cerrar sesión: aislar avisos y desactivar suscripción; pruebas piloto.
- Endpoints arbitrarios y permisos ausentes: rechazar sin enviar; pruebas servidor.
- Móvil estrecho/iPhone sin instalar: instrucciones y controles utilizables; navegador/capturas.

### Task 1: Centro y seguimiento

Files: src/notifications/model.ts, NoticeCenter.tsx, notifications.css; src/store.ts, App.tsx, pages/Plaza.tsx; tests/rules/notifications.test.mjs, tests/notifications.spec.ts.
Interfaces: NotificationScope/NoticeContext; trackParticipation, receiveReply, visibleNotices, toggleThread, markThreadRead, loadNotificationScopes.
- [x] Escribir y observar fallos para seguimiento, silencio, deduplicado, privacidad y persistencia.
- [x] Implementar reducer/migración/contador/hilo/centro sin actividad automática.
- [x] Probar aviso explícito, navegación al comentario, foco, exportación/borrado y móvil.

### Task 2: Dispositivo y entrega preparada

Files: server/push.ts, storage.ts/app.ts/pilot.ts; src/notifications/DevicePush.tsx; public/sw.js/manifest.webmanifest/iconos; deploy/compose.yml; scripts/generate-push-keys.mjs; tests/server/push.test.mjs.
Interfaces: pushFromEnv y PushDelivery; GET opciones y POST status/subscribe/unsubscribe/test por sesión; transport mock solo en tests.
- [x] Escribir y observar fallos de configuración, autenticación/origen/SSRF, aislamiento, baja y envío propio limitado.
- [x] Añadir Web Push, migración, permisos voluntarios, soporte PWA e instrucciones iPhone.
- [x] Verificar con transporte privado, sin activar proveedor/dominio real ni cachear la app.

### Task 3: Entrega

- [x] Compilar demo/piloto, ejecutar regresiones necesarias, revisar320/390/1440 y límites. Resultado:221 escenarios aprobados.
- [x] Actualizar estado, guías de configuración y pauta; distinguir implementación de configuración pendiente.
- [ ] Commit, publicar demo estática autorizada y comprobar marcador/archivos públicos. Esta operación se verifica después del commit fuente; no publica el backend ni activa Web Push real.
