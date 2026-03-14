-- Migration 0021: Add needs_database column to apps table
-- This flag drives Supabase auto-provisioning in the scaffold pipeline.
ALTER TABLE apps ADD COLUMN IF NOT EXISTS needs_database BOOLEAN DEFAULT FALSE;
