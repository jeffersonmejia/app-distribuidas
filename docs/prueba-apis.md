# Prueba de APIs con Swagger

El backend incluye `springdoc-openapi` y Swagger UI para que el equipo explore y pruebe los endpoints desde el navegador. La documentación está deshabilitada por defecto y se habilita únicamente con el perfil local `dev`.

## Uso local

1. Prepara PostgreSQL, los roles, el proveedor OIDC y las variables siguiendo [ejecución local](ejecucion-local.md).
2. Desde la raíz, inicia la aplicación con el perfil `dev`:

   ```powershell
   mvn -B -ntp -f backend/pom.xml spring-boot:run '-Dspring-boot.run.profiles=dev'
   ```

3. Abre Swagger UI en <http://localhost:8080/swagger-ui.html>.
4. El documento OpenAPI JSON está en <http://localhost:8080/v3/api-docs>.

Springdoc detecta los controladores y modelos REST. La configuración de seguridad exige autenticación incluso para las rutas de documentación; activar `dev` no concede acceso anónimo ni sustituye un token o una membresía válida. Una respuesta `401` al abrir Swagger sin autenticación es coherente con esa configuración. No activar el perfil `dev` en entornos compartidos o productivos.
