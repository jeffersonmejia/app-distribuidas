CREATE TABLE pos_sale (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    sale_id UUID NOT NULL,
    inventory_movement_id UUID NOT NULL,
    fingerprint TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    created_by UUID NOT NULL,
    updated_by UUID NOT NULL,
    CONSTRAINT uq_pos_sale_sale_id UNIQUE (tenant_id, sale_id),
    CONSTRAINT uq_pos_sale_id UNIQUE (tenant_id, id),
    CONSTRAINT ck_pos_sale_fingerprint CHECK (fingerprint ~ '^[0-9a-f]{64}$')
);
CREATE TABLE pos_sale_line (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    sale_record_id UUID NOT NULL,
    line_number INTEGER NOT NULL CHECK (line_number >= 0),
    product_id UUID NOT NULL,
    unit TEXT NOT NULL CHECK (length(trim(unit)) > 0),
    quantity NUMERIC NOT NULL CHECK (quantity > 0 AND quantity NOT IN ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric)),
    unit_price NUMERIC NOT NULL CHECK (unit_price >= 0 AND unit_price = trunc(unit_price, 2) AND unit_price NOT IN ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric)),
    tax_amount NUMERIC NOT NULL CHECK (tax_amount >= 0 AND tax_amount = trunc(tax_amount, 2) AND tax_amount NOT IN ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric)),
    net_amount NUMERIC NOT NULL CHECK (net_amount >= 0 AND net_amount = trunc(net_amount, 2) AND net_amount NOT IN ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric)),
    CONSTRAINT ck_pos_sale_line_net CHECK (net_amount = round(unit_price * quantity, 2)),
    CONSTRAINT fk_pos_sale_line_sale FOREIGN KEY (tenant_id, sale_record_id) REFERENCES pos_sale (tenant_id, id),
    CONSTRAINT uq_pos_sale_line_product UNIQUE (tenant_id, sale_record_id, product_id),
    CONSTRAINT uq_pos_sale_line_number UNIQUE (tenant_id, sale_record_id, line_number)
);
GRANT SELECT, INSERT ON pos_sale, pos_sale_line TO erp_runtime;
ALTER TABLE pos_sale ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_sale FORCE ROW LEVEL SECURITY;
CREATE POLICY pos_sale_select ON pos_sale FOR SELECT
    USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
CREATE POLICY pos_sale_insert ON pos_sale FOR INSERT
    WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
ALTER TABLE pos_sale_line ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_sale_line FORCE ROW LEVEL SECURITY;
CREATE POLICY pos_sale_line_select ON pos_sale_line FOR SELECT
    USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
CREATE POLICY pos_sale_line_insert ON pos_sale_line FOR INSERT
    WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
