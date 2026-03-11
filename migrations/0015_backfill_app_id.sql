-- 0015_backfill_app_id.sql
-- Backfill existing agent_tasks with app_id based on metadata.repo patterns
-- Depends on: 0014_apps_table.sql (apps table + app_id column on agent_tasks)

-- Use a DO block so we can log counts via RAISE NOTICE
DO $$
DECLARE
  v_app RECORD;
  v_count INTEGER;
  v_total INTEGER := 0;
  v_repo_pattern TEXT;
  v_deploy_count INTEGER;
BEGIN
  -- 1. Backfill based on metadata->>repo matching app slugs
  FOR v_app IN
    SELECT id, slug, name FROM apps WHERE status = 'active'
  LOOP
    -- Map slug to repo pattern
    CASE v_app.slug
      WHEN 'queue-dashboard'  THEN v_repo_pattern := '%queue-dashboard%';
      WHEN 'dante-crm'        THEN v_repo_pattern := '%dante-crm%';
      WHEN 'game-landing'     THEN v_repo_pattern := '%game-landing%';
      WHEN 'task-dispatcher'  THEN v_repo_pattern := '%task-dispatcher%';
      WHEN 'agent-skills'     THEN v_repo_pattern := '%agent-skills%';
      WHEN 'gitops'           THEN v_repo_pattern := '%dante-gitops%';
      ELSE v_repo_pattern := NULL;
    END CASE;

    IF v_repo_pattern IS NOT NULL THEN
      UPDATE agent_tasks
      SET app_id = v_app.id, updated_at = now()
      WHERE app_id IS NULL
        AND metadata IS NOT NULL
        AND metadata->>'repo' ILIKE v_repo_pattern;

      GET DIAGNOSTICS v_count = ROW_COUNT;
      v_total := v_total + v_count;
      RAISE NOTICE 'Backfilled % tasks for app "%" (slug: %)', v_count, v_app.name, v_app.slug;
    END IF;
  END LOOP;

  -- 2. Backfill based on repository_url column (fallback for tasks without metadata.repo)
  FOR v_app IN
    SELECT id, slug, name FROM apps WHERE status = 'active'
  LOOP
    CASE v_app.slug
      WHEN 'queue-dashboard'  THEN v_repo_pattern := '%queue-dashboard%';
      WHEN 'dante-crm'        THEN v_repo_pattern := '%dante-crm%';
      WHEN 'game-landing'     THEN v_repo_pattern := '%game-landing%';
      WHEN 'task-dispatcher'  THEN v_repo_pattern := '%task-dispatcher%';
      WHEN 'agent-skills'     THEN v_repo_pattern := '%agent-skills%';
      WHEN 'gitops'           THEN v_repo_pattern := '%dante-gitops%';
      ELSE v_repo_pattern := NULL;
    END CASE;

    IF v_repo_pattern IS NOT NULL THEN
      UPDATE agent_tasks
      SET app_id = v_app.id, updated_at = now()
      WHERE app_id IS NULL
        AND repository_url ILIKE v_repo_pattern;

      GET DIAGNOSTICS v_count = ROW_COUNT;
      v_total := v_total + v_count;
      IF v_count > 0 THEN
        RAISE NOTICE 'Backfilled % tasks for app "%" via repository_url', v_count, v_app.name;
      END IF;
    END IF;
  END LOOP;

  -- 3. Backfill deploy tasks with no repo — infer from title/description
  FOR v_app IN
    SELECT id, slug, name FROM apps WHERE status = 'active'
  LOOP
    CASE v_app.slug
      WHEN 'queue-dashboard'  THEN v_repo_pattern := '%queue%dashboard%';
      WHEN 'dante-crm'        THEN v_repo_pattern := '%dante%crm%';
      WHEN 'game-landing'     THEN v_repo_pattern := '%game%landing%';
      WHEN 'task-dispatcher'  THEN v_repo_pattern := '%task%dispatch%';
      WHEN 'agent-skills'     THEN v_repo_pattern := '%agent%skill%';
      WHEN 'gitops'           THEN v_repo_pattern := '%gitops%';
      ELSE v_repo_pattern := NULL;
    END CASE;

    IF v_repo_pattern IS NOT NULL THEN
      UPDATE agent_tasks
      SET app_id = v_app.id, updated_at = now()
      WHERE app_id IS NULL
        AND type = 'deploy'
        AND (title ILIKE v_repo_pattern OR description ILIKE v_repo_pattern);

      GET DIAGNOSTICS v_count = ROW_COUNT;
      v_total := v_total + v_count;
      IF v_count > 0 THEN
        RAISE NOTICE 'Backfilled % deploy tasks for app "%" via title/description', v_count, v_app.name;
      END IF;
    END IF;
  END LOOP;

  -- 4. Also try PR URLs for remaining unmatched tasks
  FOR v_app IN
    SELECT id, slug, name FROM apps WHERE status = 'active'
  LOOP
    CASE v_app.slug
      WHEN 'queue-dashboard'  THEN v_repo_pattern := '%queue-dashboard%';
      WHEN 'dante-crm'        THEN v_repo_pattern := '%dante-crm%';
      WHEN 'game-landing'     THEN v_repo_pattern := '%game-landing%';
      WHEN 'task-dispatcher'  THEN v_repo_pattern := '%task-dispatcher%';
      WHEN 'agent-skills'     THEN v_repo_pattern := '%agent-skills%';
      WHEN 'gitops'           THEN v_repo_pattern := '%dante-gitops%';
      ELSE v_repo_pattern := NULL;
    END CASE;

    IF v_repo_pattern IS NOT NULL THEN
      UPDATE agent_tasks
      SET app_id = v_app.id, updated_at = now()
      WHERE app_id IS NULL
        AND pull_request_url IS NOT NULL
        AND pull_request_url::text ILIKE v_repo_pattern;

      GET DIAGNOSTICS v_count = ROW_COUNT;
      v_total := v_total + v_count;
      IF v_count > 0 THEN
        RAISE NOTICE 'Backfilled % tasks for app "%" via pull_request_url', v_count, v_app.name;
      END IF;
    END IF;
  END LOOP;

  RAISE NOTICE 'Total tasks backfilled: %', v_total;

  -- 5. Report remaining unmatched tasks
  SELECT COUNT(*) INTO v_count FROM agent_tasks WHERE app_id IS NULL AND status != 'deprecated';
  RAISE NOTICE 'Remaining tasks without app_id: % (these have no matching repo)', v_count;
END $$;
