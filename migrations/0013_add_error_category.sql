-- Migration: Add error_category column to task_activity_log
-- Stores auto-classified error categories for triage and analytics.
-- Categories: merge_conflict, ci_failure, timeout, session_lost, qa_rejection, auth_error, resource_error, unknown

ALTER TABLE task_activity_log ADD COLUMN IF NOT EXISTS error_category text;

-- Index for efficient error stats queries
CREATE INDEX IF NOT EXISTS idx_task_activity_log_error_category 
  ON task_activity_log (error_category) 
  WHERE error_category IS NOT NULL;

-- Composite index for time-range error queries
CREATE INDEX IF NOT EXISTS idx_task_activity_log_error_category_time 
  ON task_activity_log (error_category, changed_at) 
  WHERE error_category IS NOT NULL;
