-- Migration 0025: Add per-app Supabase project tracking fields
-- Task: 64006625-a693-4db9-b7fd-abbf29a9f3d6
-- Each app now gets its own dedicated Supabase project (not shared schema).
-- This migration adds columns to track provisioning status, table count, and table names.
-- The per-app credentials (url, anon_key, service_role_key) are stored in the
-- existing credentials JSONB column (migration 0019).

ALTER TABLE apps ADD COLUMN IF NOT EXISTS supabase_db_status TEXT DEFAULT 'none';
-- Valid values: 'none' | 'provisioning' | 'ready' | 'error'

ALTER TABLE apps ADD COLUMN IF NOT EXISTS supabase_table_count INTEGER DEFAULT 0;

ALTER TABLE apps ADD COLUMN IF NOT EXISTS supabase_tables JSONB DEFAULT '[]';
-- Array of table name strings created in the app's Supabase project

COMMENT ON COLUMN apps.supabase_db_status IS 'Supabase project provisioning status: none | provisioning | ready | error';
COMMENT ON COLUMN apps.supabase_table_count IS 'Number of tables created in the per-app Supabase project';
COMMENT ON COLUMN apps.supabase_tables IS 'Array of table name strings created in the per-app Supabase project';
