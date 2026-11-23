# Contratos HTTP aprobados — INT-001

Todos los endpoints usan `Authorization: Bearer <token>` y `X-Tenant-ID` como selector. `tenancy` valida actor autenticado, membresía activa y permiso en backend; el selector enviado no concede acceso. Las listas usan página base cero y `size` de 1 a 5 (por defecto 5). Errores de aplicación: `{ "code": "...", "message": "..." }`, sin detalles internos.

## Inventory

- `GET /api/v1/inventory/products?search=&category=&page=0&size=5` — `inventory:catalog:read`; retorna `{items,page,size,hasNext}`.
- `GET /api/v1/inventory/products/{id}` — `inventory:catalog:read`.
- `POST /api/v1/inventory/products` — `inventory:catalog:manage`; crea catálogo y stock inicial en una transacción; si `initialStock > 0`, valida también `inventory:stock:receive`.
- `PUT /api/v1/inventory/products/{id}` — `inventory:catalog:manage`; no acepta cambios de stock inicial ni de unidad existente.
- `GET /api/v1/inventory/products/{id}/availability` — `inventory:stock:read`.
- `GET /api/v1/inventory/products/metrics` — `inventory:catalog:read`; agregados de productos, bajo stock, valor y categorías.

Producto: `{id,name,sku,category,description,unit,purchasePrice,sellingPrice,stock,minStock,status,createdAt,updatedAt}`. Categorías actuales: `Materiales`, `Equipos`, `Herramientas`, `Repuestos`, `Servicios`. SKU único por tenant. `unit` es obligatoria e inmutable después de crear el saldo. `purchasePrice` y `sellingPrice` son cadenas USD con dos decimales. El alta requiere además `initialStock`; actualización envía `initialStock: null`.

## POS

- `POST /api/v1/pos/sales` — recibe `{saleId,lines:[{productId,unit,quantity,unitPrice,taxAmount}]}`. El UUID es clave idempotente por tenant; importes USD decimales de dos posiciones. Devuelve `{saleId,movementId,createdAt,lines:[{productId,unit,quantity,unitPrice,taxAmount,netAmount}]}` después de confirmar la transacción Inventory/POS/Accounting.
- `GET /api/v1/pos/sales?search=<saleId>&page=0&size=5` — `pos:sale:read`.
- `GET /api/v1/pos/sales/{saleId}` — `pos:sale:read`.

La UI envía unidad, cantidad, precio e impuesto por línea. No se persisten cliente, comprobante, descuento, método de pago ni estado de cobro en POS-002.

## Accounting

- `GET /api/v1/accounting/entries?search=<saleId>&period=YYYY-MM&page=0&size=5` — `accounting:entry:read`.
- `GET /api/v1/accounting/entries/{id}` — `accounting:entry:read`.
- `GET /api/v1/accounting/entries/summary` — `accounting:entry:read`; agrega solo movimientos existentes.

Un asiento expone `{id,saleId,reversalId,originalId,createdAt,movements:[{account,side,amount}]}`. No se agregan estados, códigos contables ni glosa al almacenamiento.

## Features ya expuestas

- Projects: `/api/v1/projects` y `/api/v1/projects/{projectId}/tasks`.
- Marketing: `/api/v1/marketing/campaigns`, `/templates` y `/contacts/{customerId}`.
- CRM mantiene `/api/v1/crm/customers`.

Las fábricas del frontend seleccionan adaptadores HTTP cuando `VITE_DATA_SOURCE=api`; el modo `mock` sigue disponible para demos. La configuración de token/tenant actual se obtiene de la configuración existente de sesión de desarrollo.
