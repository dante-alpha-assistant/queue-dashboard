-- Migration: 0021_app_chat_messages
-- Creates the app_chat_messages table for conversational app iteration

CREATE TABLE IF NOT EXISTS app_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id uuid NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content text NOT NULL,
  task_id uuid REFERENCES agent_tasks(id) ON DELETE SET NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_app_chat_messages_app_id ON app_chat_messages(app_id);
CREATE INDEX IF NOT EXISTS idx_app_chat_messages_app_created ON app_chat_messages(app_id, created_at);
