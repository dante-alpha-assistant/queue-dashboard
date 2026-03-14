-- Migration 0024: Formalize build_steps as a state machine object
-- Task: 17ca5235-ceb1-4830-8d44-007cc2392c8f
--
-- The build_steps column already exists as JSONB (added in 0012_add_build_steps.sql).
-- No schema change is needed — JSONB supports both the old flat-array format and
-- the new state machine object format transparently.
--
-- New format written by scaffold.js:
-- {
--   "steps": [
--     {"id": "app_created",       "label": "App Created",          "status": "pending|in_progress|done|failed", "started_at": "...", "completed_at": "...", "error": "..."},
--     {"id": "creating_repo",     "label": "Creating GitHub Repo", "status": "..."},
--     {"id": "scaffolding",       "label": "Scaffolding Template", "status": "..."},
--     {"id": "ai_generating",     "label": "AI Generating Code",   "status": "..."},
--     {"id": "setting_up_vercel", "label": "Setting Up Vercel",    "status": "..."},
--     {"id": "deploying",         "label": "Deploying to Vercel",  "status": "..."},
--     {"id": "first_deployment",  "label": "First Deployment",     "status": "..."},
--     {"id": "live",              "label": "Live!",                 "status": "..."}
--   ],
--   "current_step": "step_id_or_null",
--   "failed_step": null,
--   "error_message": null
-- }
--
-- State machine rules:
--   - pending → in_progress → done | failed
--   - Only ONE step can be in_progress at a time (tracked by current_step)
--   - On failure: failed_step + error_message are set at top level
--   - Retry: reset failed_step to pending and restart from there

-- Update the column comment to reflect the new structure
COMMENT ON COLUMN apps.build_steps IS 'State machine object: {steps: [{id, label, status, started_at, completed_at, error}], current_step, failed_step, error_message}. Step IDs: app_created, creating_repo, scaffolding, ai_generating, setting_up_vercel, deploying, first_deployment, live.';

-- Reset any in-progress apps that may have stale flat-array build_steps.
-- This is safe: on next scaffold trigger the steps are re-initialized.
-- We only reset apps that have an old flat-array format (jsonb_typeof = 'array').
UPDATE apps
SET build_steps = NULL
WHERE build_steps IS NOT NULL
  AND jsonb_typeof(build_steps) = 'array'
  AND status IN ('scaffolding', 'deploying', 'building', 'failed');
