# Prueba de APIs con Swagger

El backend incluye `springdoc-openapi` y Swagger UI para que el equipo explore y pruebe los endpoints desde el navegador. La documentación está deshabilitada por defecto y se habilita únicamente con el perfil local `dev`.

## Uso local

1. Implementa la clase de arranque de Spring Boot y los controladores REST del backend.
2. Desde `backend`, inicia la aplicación con el perfil `dev`:

   ```bash
   mvn spring-boot:run -Dspring-boot.run.profiles=dev
   ```

3. Abre Swagger UI en <http://localhost:8080/swagger-ui.html>.
4. El documento OpenAPI JSON está en <http://localhost:8080/v3/api-docs>.

Springdoc detecta los controladores y modelos REST automáticamente; los endpoints aparecerán a medida que el equipo los implemente. Sin controladores, Swagger no tendrá operaciones para probar. No activar el perfil `dev` en entornos compartidos o productivos.
