-- Add icon and required_credentials columns to apps table
ALTER TABLE apps ADD COLUMN IF NOT EXISTS icon text DEFAULT '📦';
ALTER TABLE apps ADD COLUMN IF NOT EXISTS required_credentials jsonb DEFAULT '{"coding": [], "qa": []}';
