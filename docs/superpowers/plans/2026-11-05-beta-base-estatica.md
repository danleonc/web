# Primera base técnica para la beta

La propuesta aprobada de beta está en `../../../../BETA_NEXAFIA_PROPUESTA.md`. Este incremento corrige el servidor antes de desarrollar los espacios compartidos; no constituye una beta lista para publicar.

- [x] Reproducir con una prueba HTTP real que la página y sus recursos se sirven correctamente y que no es posible leer archivos fuera de la raíz pública.
- [x] Corregir el cálculo de rutas para Windows y Unix conservando la protección contra acceso fuera de la raíz. Servir imágenes WebP con su tipo correcto.
- [x] Ejecutar la prueba específica, las pruebas del servidor y la compilación y pruebas de navegador de la configuración piloto: 52 pruebas de servidor, 11 de escritorio y 10 de móvil aprobadas. Estas últimas verifican la configuración existente, no que la beta propuesta esté completa.
- [ ] Revisar el cambio y continuar con la implementación de las capacidades compartidas de La Plaza, Conexiones y Encuentros.
