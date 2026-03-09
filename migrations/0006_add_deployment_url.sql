-- Add deployment_url column to store the URL where the task was deployed
ALTER TABLE agent_tasks ADD COLUMN IF NOT EXISTS deployment_url text;
