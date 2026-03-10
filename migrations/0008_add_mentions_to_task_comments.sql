-- Add mentions column to task_comments for @agent tagging
ALTER TABLE task_comments ADD COLUMN IF NOT EXISTS mentions jsonb DEFAULT NULL;
