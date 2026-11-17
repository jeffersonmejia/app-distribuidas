CREATE TABLE accounting_journal (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    sale_id UUID NOT NULL,
    reversal_id UUID,
    original_id UUID,
    kind TEXT NOT NULL CHECK (kind IN ('SALE', 'REVERSAL')),
    fingerprint TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    created_by UUID NOT NULL,
    updated_by UUID NOT NULL,
    CONSTRAINT uq_accounting_journal_id UNIQUE (tenant_id, id),
    CONSTRAINT uq_accounting_journal_sale_ref UNIQUE (tenant_id, id, sale_id),
    CONSTRAINT uq_accounting_journal_sale_kind UNIQUE (tenant_id, sale_id, kind),
    CONSTRAINT uq_accounting_reversal_id UNIQUE (tenant_id, reversal_id),
    CONSTRAINT fk_accounting_original FOREIGN KEY (tenant_id, original_id, sale_id)
        REFERENCES accounting_journal (tenant_id, id, sale_id),
    CONSTRAINT ck_accounting_kind CHECK (
        (kind = 'SALE' AND reversal_id IS NULL AND original_id IS NULL)
        OR (kind = 'REVERSAL' AND reversal_id IS NOT NULL AND original_id IS NOT NULL AND original_id <> id))
);
CREATE TABLE accounting_movement (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    journal_id UUID NOT NULL,
    line_number INTEGER NOT NULL CHECK (line_number >= 0),
    account TEXT NOT NULL CHECK (account IN ('CASH_BANK', 'SALES', 'TAX_PAYABLE')),
    side TEXT NOT NULL CHECK (side IN ('DEBIT', 'CREDIT')),
    amount NUMERIC NOT NULL CHECK (amount >= 0 AND amount = trunc(amount, 2)
        AND amount NOT IN ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric)),
    CONSTRAINT uq_accounting_movement_line UNIQUE (tenant_id, journal_id, line_number),
    CONSTRAINT fk_accounting_movement_journal FOREIGN KEY (tenant_id, journal_id)
        REFERENCES accounting_journal (tenant_id, id)
);
-- La comprobación diferida observa el asiento completo al finalizar la transacción.
CREATE FUNCTION accounting_require_balanced_journal() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    selected_journal UUID;
    debit_total NUMERIC;
    credit_total NUMERIC;
    debit_count BIGINT;
    credit_count BIGINT;
BEGIN
    IF TG_TABLE_NAME = 'accounting_journal' THEN
        selected_journal := NEW.id;
    ELSE
        selected_journal := NEW.journal_id;
    END IF;
    SELECT COALESCE(sum(amount) FILTER (WHERE side = 'DEBIT'), 0),
           COALESCE(sum(amount) FILTER (WHERE side = 'CREDIT'), 0),
           count(*) FILTER (WHERE side = 'DEBIT'),
           count(*) FILTER (WHERE side = 'CREDIT')
      INTO debit_total, credit_total, debit_count, credit_count
      FROM accounting_movement
     WHERE tenant_id = NEW.tenant_id AND journal_id = selected_journal;
    IF debit_count = 0 OR credit_count = 0 OR debit_total <> credit_total THEN
        RAISE EXCEPTION 'accounting journal is not balanced' USING ERRCODE = '23514';
    END IF;
    RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER accounting_journal_balanced
    AFTER INSERT ON accounting_journal DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION accounting_require_balanced_journal();
CREATE CONSTRAINT TRIGGER accounting_movement_balanced
    AFTER INSERT ON accounting_movement DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION accounting_require_balanced_journal();
GRANT SELECT, INSERT ON accounting_journal, accounting_movement TO erp_runtime;
ALTER TABLE accounting_journal ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounting_journal FORCE ROW LEVEL SECURITY;
CREATE POLICY accounting_journal_select ON accounting_journal FOR SELECT
    USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
CREATE POLICY accounting_journal_insert ON accounting_journal FOR INSERT
    WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
ALTER TABLE accounting_movement ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounting_movement FORCE ROW LEVEL SECURITY;
CREATE POLICY accounting_movement_select ON accounting_movement FOR SELECT
    USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
CREATE POLICY accounting_movement_insert ON accounting_movement FOR INSERT
    WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
