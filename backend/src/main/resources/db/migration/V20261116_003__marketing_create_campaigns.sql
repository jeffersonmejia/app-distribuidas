CREATE TABLE marketing_campaign (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    name TEXT NOT NULL CHECK (length(trim(name)) > 0),
    description TEXT NOT NULL CHECK (length(trim(description)) > 0),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status VARCHAR(16) NOT NULL CHECK (status IN ('DRAFT', 'SCHEDULED', 'ACTIVE', 'FINISHED', 'CANCELLED')),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    created_by UUID NOT NULL,
    updated_by UUID NOT NULL,
    CONSTRAINT uq_marketing_campaign_tenant_id UNIQUE (tenant_id, id),
    CONSTRAINT ck_marketing_campaign_dates CHECK (end_date >= start_date)
);

CREATE TABLE marketing_template (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    name TEXT NOT NULL CHECK (length(trim(name)) > 0),
    subject TEXT NOT NULL CHECK (length(trim(subject)) > 0),
    html_body TEXT NOT NULL CHECK (length(trim(html_body)) > 0),
    text_body TEXT NOT NULL CHECK (length(trim(text_body)) > 0),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    created_by UUID NOT NULL,
    updated_by UUID NOT NULL,
    CONSTRAINT uq_marketing_template_tenant_id UNIQUE (tenant_id, id)
);

-- customer_id es el UUID del cliente de CRM; sin FK porque Marketing no depende de tablas internas de CRM.
CREATE TABLE marketing_contact_preference (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    customer_id UUID NOT NULL,
    status VARCHAR(16) NOT NULL CHECK (status IN ('CONSENTED', 'UNSUBSCRIBED')),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    created_by UUID NOT NULL,
    updated_by UUID NOT NULL,
    CONSTRAINT uq_marketing_contact_preference_customer UNIQUE (tenant_id, customer_id)
);

CREATE TABLE marketing_campaign_contact (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    campaign_id UUID NOT NULL,
    customer_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    created_by UUID NOT NULL,
    CONSTRAINT uq_marketing_campaign_contact UNIQUE (tenant_id, campaign_id, customer_id),
    CONSTRAINT fk_marketing_campaign_contact_campaign FOREIGN KEY (tenant_id, campaign_id)
        REFERENCES marketing_campaign (tenant_id, id)
);

-- Un registro por correo entregado al proveedor; sostiene el límite diario y evita reenvíos duplicados.
CREATE TABLE marketing_delivery (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    campaign_id UUID NOT NULL,
    template_id UUID NOT NULL,
    customer_id UUID NOT NULL,
    sent_at TIMESTAMPTZ NOT NULL,
    created_by UUID NOT NULL,
    CONSTRAINT uq_marketing_delivery UNIQUE (tenant_id, campaign_id, template_id, customer_id),
    CONSTRAINT fk_marketing_delivery_campaign FOREIGN KEY (tenant_id, campaign_id)
        REFERENCES marketing_campaign (tenant_id, id),
    CONSTRAINT fk_marketing_delivery_template FOREIGN KEY (tenant_id, template_id)
        REFERENCES marketing_template (tenant_id, id)
);

CREATE INDEX ix_marketing_campaign_list ON marketing_campaign (tenant_id, created_at DESC, id);
CREATE INDEX ix_marketing_template_list ON marketing_template (tenant_id, lower(name), id);
CREATE INDEX ix_marketing_delivery_day ON marketing_delivery (tenant_id, sent_at);

DO $$
DECLARE t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['marketing_campaign', 'marketing_template', 'marketing_contact_preference',
                             'marketing_campaign_contact', 'marketing_delivery'] LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
        EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
        EXECUTE format('CREATE POLICY %I ON %I FOR SELECT USING '
            || '(tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid)', t || '_select', t);
        EXECUTE format('CREATE POLICY %I ON %I FOR INSERT WITH CHECK '
            || '(tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid)', t || '_insert', t);
    END LOOP;
    FOREACH t IN ARRAY ARRAY['marketing_campaign', 'marketing_template', 'marketing_contact_preference'] LOOP
        EXECUTE format('CREATE POLICY %I ON %I FOR UPDATE USING '
            || '(tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid) WITH CHECK '
            || '(tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid)', t || '_update', t);
    END LOOP;
END $$;
CREATE POLICY marketing_campaign_contact_delete ON marketing_campaign_contact FOR DELETE
    USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE ON marketing_campaign, marketing_template, marketing_contact_preference TO erp_runtime;
GRANT SELECT, INSERT, DELETE ON marketing_campaign_contact TO erp_runtime;
GRANT SELECT, INSERT ON marketing_delivery TO erp_runtime;
