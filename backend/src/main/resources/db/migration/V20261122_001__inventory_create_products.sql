CREATE TABLE inventory_product (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    name TEXT NOT NULL CHECK (length(trim(name)) > 0),
    sku TEXT NOT NULL CHECK (length(trim(sku)) > 0),
    category TEXT NOT NULL CHECK (category IN ('Materiales','Equipos','Herramientas','Repuestos','Servicios')),
    description TEXT,
    unit TEXT NOT NULL CHECK (length(trim(unit)) > 0),
    purchase_price NUMERIC NOT NULL CHECK (purchase_price >= 0 AND scale(purchase_price) <= 2),
    selling_price NUMERIC NOT NULL CHECK (selling_price >= 0 AND scale(selling_price) <= 2),
    min_stock NUMERIC NOT NULL CHECK (min_stock >= 0 AND min_stock NOT IN ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric)),
    created_at TIMESTAMPTZ NOT NULL,
    created_by UUID NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    updated_by UUID NOT NULL,
    deleted_at TIMESTAMPTZ,
    CONSTRAINT uq_inventory_product_id_tenant UNIQUE (tenant_id, id),
    CONSTRAINT uq_inventory_product_sku UNIQUE (tenant_id, sku)
);

GRANT SELECT, INSERT ON inventory_product TO erp_runtime;
GRANT UPDATE (name, sku, category, description, unit, purchase_price, selling_price, min_stock, updated_at, updated_by, deleted_at)
    ON inventory_product TO erp_runtime;

ALTER TABLE inventory_product ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_product FORCE ROW LEVEL SECURITY;
CREATE POLICY inventory_product_select ON inventory_product FOR SELECT
    USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
CREATE POLICY inventory_product_insert ON inventory_product FOR INSERT
    WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
CREATE POLICY inventory_product_update ON inventory_product FOR UPDATE
    USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
    WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
