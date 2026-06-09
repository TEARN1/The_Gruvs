-- =============================================================================
-- scripts/production-readiness.sql
--
-- Run this database audit script in the Supabase SQL Editor to audit:
--  1. Row-Level Security (RLS) activation state on all public tables.
--  2. Foreign keys lacking indexes (causes table scans and hangs under traffic).
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- AUDIT 1: Find tables with Row-Level Security (RLS) DISABLED
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
    schemaname AS schema_name,
    tablename AS table_name,
    rowsecurity AS rls_enabled,
    CASE 
        WHEN rowsecurity = false THEN '🚨 VULNERABILITY: RLS is disabled! Run: ALTER TABLE public.' || tablename || ' ENABLE ROW LEVEL SECURITY;'
        ELSE '🟢 SECURE: RLS Enabled.'
    END AS status_and_remediation
FROM
    pg_tables
WHERE
    schemaname = 'public'
ORDER BY
    rls_enabled ASC,
    table_name ASC;


-- ─────────────────────────────────────────────────────────────────────────────
-- AUDIT 2: Find Foreign Key columns missing indexes (causing slow joins/scans)
-- ─────────────────────────────────────────────────────────────────────────────
WITH fk_definitions AS (
    SELECT
        con.conname AS constraint_name,
        rel.relname AS table_name,
        att.attname AS column_name,
        frel.relname AS foreign_table_name,
        fatt.attname AS foreign_column_name,
        nsp.nspname AS schema_name
    FROM
        pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
        JOIN pg_class frel ON frel.oid = con.confrelid
        JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = con.conkey[1]
        JOIN pg_attribute fatt ON fatt.attrelid = con.confrelid AND fatt.attnum = con.confkey[1]
        JOIN pg_namespace nsp ON nsp.oid = con.connamespace
    WHERE
        con.contype = 'f'
        AND nsp.nspname = 'public'
),
indexed_columns AS (
    SELECT
        indrelid::regclass::text AS table_name,
        att.attname AS column_name
    FROM
        pg_index ind
        JOIN pg_attribute att ON att.attrelid = ind.indrelid AND att.attnum = ANY(ind.indkey)
    WHERE
        ind.indisprimary = false
)
SELECT
    fk.table_name,
    fk.column_name,
    fk.foreign_table_name,
    fk.foreign_column_name,
    '⚠️ MISSING INDEX: Run: CREATE INDEX idx_' || fk.table_name || '_' || fk.column_name || ' ON public.' || fk.table_name || '(' || fk.column_name || ');' AS remediation_sql
FROM
    fk_definitions fk
    LEFT JOIN indexed_columns ic 
        ON fk.table_name = ic.table_name 
        AND fk.column_name = ic.column_name
WHERE
    ic.column_name IS NULL
ORDER BY
    fk.table_name ASC;
