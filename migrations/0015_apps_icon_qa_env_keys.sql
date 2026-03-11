-- Add icon column to apps for emoji/icon display
ALTER TABLE apps ADD COLUMN IF NOT EXISTS icon text;

-- Add qa_env_keys for QA credential requirements
ALTER TABLE apps ADD COLUMN IF NOT EXISTS qa_env_keys text[] DEFAULT '{}';
