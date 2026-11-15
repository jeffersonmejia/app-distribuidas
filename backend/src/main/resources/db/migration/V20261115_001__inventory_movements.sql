-- INV-003: saldos y registro de operaciones propiedad de Inventory.
CREATE TABLE inventory_stock (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    product_id UUID NOT NULL,
    unit TEXT NOT NULL CHECK (length(trim(unit)) > 0),
    on_hand NUMERIC NOT NULL,
    reserved NUMERIC NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    created_by UUID NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    updated_by UUID NOT NULL,
    CONSTRAINT uq_inventory_stock_product UNIQUE (tenant_id, product_id),
    CONSTRAINT uq_inventory_stock_unit UNIQUE (tenant_id, product_id, unit),
    CONSTRAINT ck_inventory_stock_balance CHECK (
        on_hand >= 0 AND reserved >= 0 AND reserved <= on_hand
        AND on_hand NOT IN ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric)
        AND reserved NOT IN ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric))
);

CREATE TABLE inventory_operation (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    operation_key TEXT NOT NULL CHECK (length(trim(operation_key)) > 0),
    fingerprint TEXT NOT NULL CHECK (fingerprint ~ '^[0-9a-f]{64}$'),
    type TEXT NOT NULL CHECK (type IN ('RECEIPT','ISSUE','RESERVE','CONFIRM','RELEASE')),
    source_reference TEXT NOT NULL CHECK (length(trim(source_reference)) > 0),
    reservation_id UUID,
    status TEXT CHECK (status IN ('ACTIVE','CONFIRMED','RELEASED')),
    confirmation_id UUID,
    created_at TIMESTAMPTZ NOT NULL,
    created_by UUID NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    updated_by UUID NOT NULL,
    CONSTRAINT uq_inventory_operation_key UNIQUE (tenant_id, operation_key),
    CONSTRAINT uq_inventory_operation_id UNIQUE (tenant_id, id),
    CONSTRAINT fk_inventory_reservation FOREIGN KEY (tenant_id, reservation_id)
        REFERENCES inventory_operation (tenant_id, id),
    CONSTRAINT fk_inventory_confirmation FOREIGN KEY (tenant_id, confirmation_id)
        REFERENCES inventory_operation (tenant_id, id),
    CONSTRAINT ck_inventory_operation_reservation CHECK (
        (type = 'RESERVE' AND reservation_id IS NOT NULL AND reservation_id = id AND status IS NOT NULL)
        OR (type IN ('CONFIRM','RELEASE') AND reservation_id IS NOT NULL AND reservation_id <> id AND status IS NULL)
        OR (type IN ('RECEIPT','ISSUE') AND reservation_id IS NULL AND status IS NULL)),
    CONSTRAINT ck_inventory_confirmation CHECK (
        (type = 'RESERVE' AND status = 'CONFIRMED' AND confirmation_id IS NOT NULL)
        OR (confirmation_id IS NULL AND (status IS NULL OR status <> 'CONFIRMED')))
);

CREATE TABLE inventory_operation_line (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    operation_id UUID NOT NULL,
    product_id UUID NOT NULL,
    line_number INTEGER NOT NULL CHECK (line_number >= 0),
    unit TEXT NOT NULL,
    quantity NUMERIC NOT NULL CHECK (
        quantity > 0 AND quantity NOT IN ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric)),
    CONSTRAINT uq_inventory_line_product UNIQUE (tenant_id, operation_id, product_id),
    CONSTRAINT uq_inventory_line_order UNIQUE (tenant_id, operation_id, line_number),
    CONSTRAINT fk_inventory_line_operation FOREIGN KEY (tenant_id, operation_id)
        REFERENCES inventory_operation (tenant_id, id),
    CONSTRAINT fk_inventory_line_stock FOREIGN KEY (tenant_id, product_id, unit)
        REFERENCES inventory_stock (tenant_id, product_id, unit)
);

-- Los registros de movimientos no se borran ni se reescriben con el rol runtime.
GRANT SELECT, INSERT ON inventory_stock, inventory_operation, inventory_operation_line TO erp_runtime;
GRANT UPDATE (on_hand, reserved, updated_at, updated_by) ON inventory_stock TO erp_runtime;
GRANT UPDATE (status, confirmation_id, updated_at, updated_by) ON inventory_operation TO erp_runtime;

ALTER TABLE inventory_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_stock FORCE ROW LEVEL SECURITY;
CREATE POLICY inventory_stock_select ON inventory_stock FOR SELECT
    USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
CREATE POLICY inventory_stock_insert ON inventory_stock FOR INSERT
    WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
CREATE POLICY inventory_stock_update ON inventory_stock FOR UPDATE
    USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
    WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE inventory_operation ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_operation FORCE ROW LEVEL SECURITY;
CREATE POLICY inventory_operation_select ON inventory_operation FOR SELECT
    USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
CREATE POLICY inventory_operation_insert ON inventory_operation FOR INSERT
    WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
CREATE POLICY inventory_operation_update ON inventory_operation FOR UPDATE
    USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
    WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE inventory_operation_line ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_operation_line FORCE ROW LEVEL SECURITY;
CREATE POLICY inventory_operation_line_select ON inventory_operation_line FOR SELECT
    USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
CREATE POLICY inventory_operation_line_insert ON inventory_operation_line FOR INSERT
    WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

