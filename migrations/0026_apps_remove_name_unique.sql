-- Remove UNIQUE constraint on name column; slug is the only unique identifier
-- Idempotent: safe to run multiple times

-- Drop the unique constraint on name (it may be named apps_name_key or similar)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'apps'::regclass 
    AND contype = 'u' 
    AND conname LIKE '%name%'
  ) THEN
    ALTER TABLE apps DROP CONSTRAINT IF EXISTS apps_name_key;
  END IF;
END $$;

-- Ensure slug still has unique constraint (should already exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'apps'::regclass 
    AND contype = 'u' 
    AND conname LIKE '%slug%'
  ) THEN
    ALTER TABLE apps ADD CONSTRAINT apps_slug_key UNIQUE (slug);
  END IF;
END $$;
