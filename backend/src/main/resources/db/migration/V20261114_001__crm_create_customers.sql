CREATE TABLE crm_customer (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    full_name TEXT NOT NULL CHECK (length(trim(full_name)) > 0),
    cedula VARCHAR(10),
    email TEXT,
    phone TEXT,
    status VARCHAR(16) NOT NULL CHECK (status IN ('ACTIVE', 'INACTIVE')),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    created_by UUID NOT NULL,
    updated_by UUID NOT NULL,
    deleted_at TIMESTAMPTZ,
    CONSTRAINT uq_crm_customer_cedula UNIQUE (tenant_id, cedula),
    CONSTRAINT uq_crm_customer_email UNIQUE (tenant_id, email),
    CONSTRAINT ck_crm_customer_email_normalized CHECK (email IS NULL OR email = lower(email))
);

ALTER TABLE crm_customer ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_customer FORCE ROW LEVEL SECURITY;
CREATE POLICY crm_customer_select ON crm_customer FOR SELECT
    USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
CREATE POLICY crm_customer_insert ON crm_customer FOR INSERT
    WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
CREATE POLICY crm_customer_update ON crm_customer FOR UPDATE
    USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
    WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE ON crm_customer TO erp_runtime;
