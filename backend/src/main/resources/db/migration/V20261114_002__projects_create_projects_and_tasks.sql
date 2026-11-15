CREATE TABLE projects_project (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    name TEXT NOT NULL CHECK (length(trim(name)) > 0),
    description TEXT,
    start_date DATE,
    end_date DATE,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    created_by UUID NOT NULL,
    updated_by UUID NOT NULL,
    deleted_at TIMESTAMPTZ,
    CONSTRAINT uq_projects_project_tenant_id UNIQUE (tenant_id, id),
    CONSTRAINT ck_projects_project_dates CHECK (start_date IS NULL OR end_date IS NULL OR end_date >= start_date)
);

CREATE TABLE projects_task (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    project_id UUID NOT NULL,
    title TEXT NOT NULL CHECK (length(trim(title)) > 0),
    description TEXT,
    assignee_id UUID,
    priority VARCHAR(16) CHECK (priority IN ('HIGH', 'MEDIUM', 'LOW')),
    due_date DATE,
    status VARCHAR(16) NOT NULL CHECK (status IN ('PENDING', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED')),
    previous_status VARCHAR(16) CHECK (previous_status IN ('PENDING', 'IN_PROGRESS')),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    created_by UUID NOT NULL,
    updated_by UUID NOT NULL,
    deleted_at TIMESTAMPTZ,
    CONSTRAINT ck_projects_task_previous_status CHECK ((status = 'BLOCKED') = (previous_status IS NOT NULL)),
    CONSTRAINT fk_projects_task_project FOREIGN KEY (tenant_id, project_id)
        REFERENCES projects_project (tenant_id, id)
);

CREATE INDEX ix_projects_project_list ON projects_project (tenant_id, (deleted_at IS NOT NULL), lower(name), id);
CREATE INDEX ix_projects_task_list ON projects_task (tenant_id, project_id, (deleted_at IS NOT NULL), created_at, id);

ALTER TABLE projects_project ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects_project FORCE ROW LEVEL SECURITY;
CREATE POLICY projects_project_select ON projects_project FOR SELECT
    USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
CREATE POLICY projects_project_insert ON projects_project FOR INSERT
    WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
CREATE POLICY projects_project_update ON projects_project FOR UPDATE
    USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
    WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
-- Defensa en profundidad: la purga permanente solo alcanza proyectos ya borrados lógicamente.
CREATE POLICY projects_project_delete ON projects_project FOR DELETE
    USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid AND deleted_at IS NOT NULL);

ALTER TABLE projects_task ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects_task FORCE ROW LEVEL SECURITY;
CREATE POLICY projects_task_select ON projects_task FOR SELECT
    USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
CREATE POLICY projects_task_insert ON projects_task FOR INSERT
    WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
CREATE POLICY projects_task_update ON projects_task FOR UPDATE
    USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
    WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
CREATE POLICY projects_task_delete ON projects_task FOR DELETE
    USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON projects_project, projects_task TO erp_runtime;
