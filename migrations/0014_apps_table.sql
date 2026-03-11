-- Apps table: scope tasks to specific repos and prevent cross-repo contamination
CREATE TABLE IF NOT EXISTS apps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  slug text UNIQUE NOT NULL,
  description text,
  repos text[] DEFAULT '{}',
  supabase_project_ref text,
  deploy_target text NOT NULL DEFAULT 'none',
  deploy_config jsonb DEFAULT '{}',
  env_keys text[] DEFAULT '{}',
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add app_id FK to agent_tasks
ALTER TABLE agent_tasks ADD COLUMN IF NOT EXISTS app_id uuid REFERENCES apps(id);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_agent_tasks_app_id ON agent_tasks(app_id);
CREATE INDEX IF NOT EXISTS idx_apps_slug ON apps(slug);
CREATE INDEX IF NOT EXISTS idx_apps_status ON apps(status);

-- Seed data
INSERT INTO apps (name, slug, description, repos, deploy_target, deploy_config, supabase_project_ref, status)
VALUES
  ('Queue Dashboard', 'queue-dashboard', 'Task management dashboard and API', ARRAY['dante-alpha-assistant/queue-dashboard'], 'kubernetes', '{"namespace": "infra", "service": "queue-dashboard"}', 'lessxkxujvcmublgwdaa', 'active'),
  ('Dante CRM', 'dante-crm', 'Customer relationship management system', ARRAY['dante-alpha-assistant/dante-crm'], 'kubernetes', '{"namespace": "dante"}', 'jxjbhrlznwqosokjxayo', 'active'),
  ('Game Landing', 'game-landing', 'Game landing page', ARRAY['dante-alpha-assistant/game-landing'], 'vercel', '{}', NULL, 'active'),
  ('Task Dispatcher', 'task-dispatcher', 'Routes tasks from Supabase to agent webhooks', ARRAY['dante-alpha-assistant/task-dispatcher'], 'kubernetes', '{"namespace": "infra", "service": "task-dispatcher"}', NULL, 'active'),
  ('Agent Skills', 'agent-skills', 'Shared skills across the agent fleet', ARRAY['dante-alpha-assistant/agent-skills'], 'none', '{}', NULL, 'active'),
  ('GitOps', 'gitops', 'K8s manifests and ArgoCD source of truth', ARRAY['dante-alpha-assistant/dante-gitops'], 'none', '{}', NULL, 'active')
ON CONFLICT (slug) DO NOTHING;
