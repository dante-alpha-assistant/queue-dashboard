-- Backfill app_id on existing tasks based on metadata.repo, pull_request_url, or merge_status_details.repo
-- This is idempotent — only updates tasks where app_id IS NULL

-- 1. Match by metadata.repo
UPDATE agent_tasks SET app_id = a.id
FROM apps a
WHERE agent_tasks.app_id IS NULL
  AND agent_tasks.metadata->>'repo' IS NOT NULL
  AND agent_tasks.metadata->>'repo' = ANY(a.repos);

-- 2. Match by pull_request_url containing the repo full name
UPDATE agent_tasks SET app_id = a.id
FROM apps a, LATERAL unnest(a.repos) AS repo_name
WHERE agent_tasks.app_id IS NULL
  AND agent_tasks.pull_request_url IS NOT NULL
  AND agent_tasks.pull_request_url::text LIKE '%' || repo_name || '%';

-- 3. Match by metadata.merge_status_details.repo
UPDATE agent_tasks SET app_id = a.id
FROM apps a
WHERE agent_tasks.app_id IS NULL
  AND agent_tasks.metadata->'merge_status_details'->>'repo' IS NOT NULL
  AND agent_tasks.metadata->'merge_status_details'->>'repo' = ANY(a.repos);
