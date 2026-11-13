CREATE TABLE tenant (
    id UUID PRIMARY KEY,
    status VARCHAR(16) NOT NULL CHECK (status IN ('ACTIVE', 'SUSPENDED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by UUID NOT NULL,
    updated_by UUID NOT NULL
);

CREATE TABLE tenant_membership (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenant (id),
    actor_id UUID NOT NULL,
    status VARCHAR(16) NOT NULL CHECK (status IN ('ACTIVE', 'REVOKED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by UUID NOT NULL,
    updated_by UUID NOT NULL,
    CONSTRAINT uq_tenant_membership_tenant_actor UNIQUE (tenant_id, actor_id),
    CONSTRAINT uq_tenant_membership_tenant_id UNIQUE (tenant_id, id)
);

CREATE TABLE tenant_membership_permission (
    tenant_id UUID NOT NULL,
    membership_id UUID NOT NULL,
    permission_code VARCHAR(120) NOT NULL CHECK (length(trim(permission_code)) > 0),
    CONSTRAINT pk_tenant_membership_permission PRIMARY KEY (tenant_id, membership_id, permission_code),
    CONSTRAINT fk_membership_permission_membership
        FOREIGN KEY (tenant_id, membership_id)
        REFERENCES tenant_membership (tenant_id, id)
);

ALTER TABLE tenant ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_selected_tenant ON tenant
    FOR SELECT
    USING (id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
CREATE POLICY tenant_manager ON tenant
    FOR UPDATE
    USING (id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
       AND current_setting('app.permission', true) = 'tenancy:tenant:manage')
    WITH CHECK (id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
       AND current_setting('app.permission', true) = 'tenancy:tenant:manage');

ALTER TABLE tenant_membership ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_membership FORCE ROW LEVEL SECURITY;
CREATE POLICY membership_authenticated_actor ON tenant_membership
    FOR SELECT
    USING (actor_id = NULLIF(current_setting('app.actor_id', true), '')::uuid
       AND tenant_id = NULLIF(current_setting('app.requested_tenant_id', true), '')::uuid);
CREATE POLICY membership_manager ON tenant_membership
    USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
       AND current_setting('app.permission', true) = 'tenancy:membership:manage')
    WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
       AND current_setting('app.permission', true) = 'tenancy:membership:manage');

ALTER TABLE tenant_membership_permission ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_membership_permission FORCE ROW LEVEL SECURITY;
CREATE POLICY membership_permission_authenticated_actor ON tenant_membership_permission
    FOR SELECT
    USING (EXISTS (
        SELECT 1
        FROM tenant_membership membership
        WHERE membership.id = tenant_membership_permission.membership_id
          AND membership.tenant_id = tenant_membership_permission.tenant_id
          AND membership.actor_id = NULLIF(current_setting('app.actor_id', true), '')::uuid
          AND membership.tenant_id = NULLIF(current_setting('app.requested_tenant_id', true), '')::uuid
    ));
CREATE POLICY membership_permission_manager ON tenant_membership_permission
    USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
       AND current_setting('app.permission', true) = 'tenancy:membership:manage')
    WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
       AND current_setting('app.permission', true) = 'tenancy:membership:manage');

GRANT SELECT ON tenant, tenant_membership, tenant_membership_permission TO erp_runtime;
GRANT UPDATE ON tenant TO erp_runtime;
GRANT INSERT, UPDATE ON tenant_membership, tenant_membership_permission TO erp_runtime;
GRANT DELETE ON tenant_membership_permission TO erp_runtime;
