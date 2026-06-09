-- ============================================================================
-- db-preflight-audit.sql — production readiness inspection (READ-ONLY).
-- Paste into the Supabase SQL Editor before a release. Makes NO changes.
-- ============================================================================

-- 1) TABLES WITHOUT ROW-LEVEL SECURITY ENABLED  (should return ZERO rows)
SELECT n.nspname AS schema, c.relname AS table, '❌ RLS DISABLED' AS issue
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'r'
  AND n.nspname = 'public'
  AND c.relrowsecurity = false
ORDER BY c.relname;

-- 2) RLS-ENABLED TABLES THAT HAVE NO POLICIES  (enabled but locked/unusable)
SELECT c.relname AS table, '⚠️ RLS on but NO policies' AS issue
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'r' AND n.nspname = 'public' AND c.relrowsecurity = true
  AND NOT EXISTS (SELECT 1 FROM pg_policy p WHERE p.polrelid = c.oid)
ORDER BY c.relname;

-- 3) FOREIGN KEYS WITHOUT A COVERING INDEX  (these hang under live traffic)
--    Every FK column (user_id, event_id, author_id, sender_id, recipient_id…)
--    should have an index. Rows here = missing indexes to add.
SELECT
  conrelid::regclass        AS table,
  a.attname                 AS fk_column,
  '❌ FK has no index'       AS issue
FROM pg_constraint c
JOIN unnest(c.conkey) WITH ORDINALITY AS k(attnum, ord) ON true
JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum
WHERE c.contype = 'f'
  AND c.connamespace = 'public'::regnamespace
  AND NOT EXISTS (
    SELECT 1 FROM pg_index i
    WHERE i.indrelid = c.conrelid
      AND a.attnum = ANY (i.indkey)
  )
ORDER BY 1, 2;

-- 4) BIGGEST TABLES + sequential-scan ratio (hot tables that need attention)
SELECT relname AS table,
       n_live_tup AS rows,
       seq_scan, idx_scan,
       CASE WHEN seq_scan + idx_scan = 0 THEN 0
            ELSE round(100.0 * seq_scan / (seq_scan + idx_scan), 1) END AS seq_scan_pct
FROM pg_stat_user_tables
ORDER BY n_live_tup DESC
LIMIT 15;

-- 5) ANON-READABLE TABLES — confirm none expose PII to unauthenticated users.
--    Review each: the anon role should only reach public_profiles / public event data.
SELECT c.relname AS table, p.polname AS policy, pg_get_expr(p.polqual, p.polrelid) AS using_expr
FROM pg_policy p
JOIN pg_class c ON c.oid = p.polrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND p.polcmd IN ('r', '*')                 -- SELECT or ALL
  AND pg_get_expr(p.polqual, p.polrelid) = 'true'   -- unconditionally readable
ORDER BY c.relname;