-- Add reply_to column to task_comments for threaded replies
ALTER TABLE task_comments ADD COLUMN IF NOT EXISTS reply_to uuid DEFAULT NULL REFERENCES task_comments(id) ON DELETE SET NULL;
