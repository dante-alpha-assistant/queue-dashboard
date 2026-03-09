-- Add hierarchy fields to agent_cards for Pingboard org chart
ALTER TABLE agent_cards ADD COLUMN IF NOT EXISTS parent_agent text;
ALTER TABLE agent_cards ADD COLUMN IF NOT EXISTS tier text;
ALTER TABLE agent_cards ADD COLUMN IF NOT EXISTS role text;
ALTER TABLE agent_cards ADD COLUMN IF NOT EXISTS avatar text;

-- Create index for hierarchy lookups
CREATE INDEX IF NOT EXISTS idx_agent_cards_parent_agent ON agent_cards (parent_agent);
CREATE INDEX IF NOT EXISTS idx_agent_cards_tier ON agent_cards (tier);
