-- Add role and description columns to agent_cards
ALTER TABLE agent_cards ADD COLUMN IF NOT EXISTS role text;
ALTER TABLE agent_cards ADD COLUMN IF NOT EXISTS description text;
