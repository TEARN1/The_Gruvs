-- ═══════════════════════════════════════════════════════════════════════════
-- resident_traffic_reports.sql — the ONE genuinely missing piece found while
-- reconciling The Resident's SQL against the shared live DB (2026-08-13).
--
-- Context: Gruvs' supabase/queries/*.sql (48 files) and Resident's canonical
-- resident_schema.sql (1161 lines, its own "Unified Schema") are BOTH fully
-- applied live already — verified by checking every CREATE TABLE/FUNCTION/
-- ADD COLUMN target against pg_proc/information_schema directly. Nothing else
-- pending from either app.
--
-- The one exception: Desktop/Resident/deploy_production_schema.sql is an
-- OLDER, superseded bootstrap script — it even redefines `profiles` with an
-- incompatible shape (its own user_id/reputation_score/xp_points columns,
-- not the real shared identity table both apps actually use), so don't run
-- it wholesale. But it's the only place `res_traffic_reports` was ever
-- defined, and that table IS live-referenced by Resident's real code —
-- src/store/index.ts:1616 (fetchTrafficReports) and :2123
-- (addTrafficReport → dbUpdate) — so the "report a hazard/congestion" feature
-- has been silently failing (fetch errors, writes swallowed by markFailed)
-- since the table was never created. NOT the same table as
-- res_neighbourhood_status (utility outages) — dbMappers.ts's schema map
-- lists both side by side as distinct tables.
--
-- res_security_logs (also only in deploy_production_schema.sql) was checked
-- too — zero references anywhere in Resident's live src/app, so it's dead
-- prototype code and deliberately NOT included here.
--
-- Idempotent. Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.res_traffic_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reporter_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    suburb TEXT,
    city TEXT,
    lat DOUBLE PRECISION NOT NULL,
    lon DOUBLE PRECISION NOT NULL,
    report_type VARCHAR(50) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.res_traffic_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public Read Traffic Reports" ON public.res_traffic_reports;
CREATE POLICY "Public Read Traffic Reports" ON public.res_traffic_reports
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Auth Users Insert Traffic Reports" ON public.res_traffic_reports;
CREATE POLICY "Auth Users Insert Traffic Reports" ON public.res_traffic_reports
  FOR INSERT WITH CHECK (auth.uid() = reporter_id);

DROP POLICY IF EXISTS "Users Delete Own Traffic Reports" ON public.res_traffic_reports;
CREATE POLICY "Users Delete Own Traffic Reports" ON public.res_traffic_reports
  FOR DELETE USING (auth.uid() = reporter_id);

CREATE INDEX IF NOT EXISTS idx_traffic_lat_lon ON public.res_traffic_reports(lat, lon);
