-- Migration: Add attachments column to task_comments
-- Format: [{"url": "https://...", "type": "screenshot", "label": "Homepage"}]
ALTER TABLE task_comments ADD COLUMN IF NOT EXISTS attachments jsonb DEFAULT NULL;
