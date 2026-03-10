-- Add mentions array and reply_to columns to task_comments
-- mentions: array of agent IDs that were @mentioned in this comment
-- reply_to: ID of the comment this is a reply to (for agent replies)

ALTER TABLE task_comments ADD COLUMN IF NOT EXISTS mentions text[] DEFAULT NULL;
ALTER TABLE task_comments ADD COLUMN IF NOT EXISTS reply_to uuid DEFAULT NULL;

-- Index for finding comments that mention a specific agent
CREATE INDEX IF NOT EXISTS idx_task_comments_mentions ON task_comments USING GIN (mentions);
