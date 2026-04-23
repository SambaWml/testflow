-- Enable Row-Level Security on all tables
-- This blocks Supabase's public REST API (anon/authenticated roles) from
-- accessing data directly. Prisma connections use the service role which
-- bypasses RLS by default, so the app is unaffected.

ALTER TABLE users              ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts           ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations      ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_members        ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members    ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects           ENABLE ROW LEVEL SECURITY;
ALTER TABLE modules            ENABLE ROW LEVEL SECURITY;
ALTER TABLE items              ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_cases         ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_steps         ENABLE ROW LEVEL SECURITY;
ALTER TABLE executions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_plans         ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_plan_cases    ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence           ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports            ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_items       ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings           ENABLE ROW LEVEL SECURITY;
ALTER TABLE generation_logs    ENABLE ROW LEVEL SECURITY;

-- No permissive policies = anon/authenticated roles have zero access by default.
-- The service role (used by Prisma) bypasses RLS automatically.
