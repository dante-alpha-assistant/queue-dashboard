-- Add deploy_target column for multi-target deployments
ALTER TABLE agent_tasks ADD COLUMN IF NOT EXISTS deploy_target text DEFAULT 'kubernetes';
