-- Fix: chat_messages.project_id was added as NOT NULL with FK to projects,
-- but dashboard chat messages don't belong to a project. Make it nullable.
ALTER TABLE chat_messages ALTER COLUMN project_id DROP NOT NULL;
