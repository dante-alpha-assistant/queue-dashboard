-- Add icon column to apps table for emoji/icon display in filters
ALTER TABLE apps ADD COLUMN IF NOT EXISTS icon text;

-- Seed default icons for existing apps
UPDATE apps SET icon = '📊' WHERE slug = 'queue-dashboard' AND icon IS NULL;
UPDATE apps SET icon = '👥' WHERE slug = 'dante-crm' AND icon IS NULL;
UPDATE apps SET icon = '🎮' WHERE slug = 'game-landing' AND icon IS NULL;
UPDATE apps SET icon = '🔀' WHERE slug = 'task-dispatcher' AND icon IS NULL;
UPDATE apps SET icon = '🧠' WHERE slug = 'agent-skills' AND icon IS NULL;
UPDATE apps SET icon = '⚙️' WHERE slug = 'gitops' AND icon IS NULL;
