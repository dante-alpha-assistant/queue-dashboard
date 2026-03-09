-- Populate agent hierarchy data
-- Alpha reports to Dante (human, not in agent_cards)
UPDATE agent_cards SET parent_agent = NULL, tier = 'leader', role = 'Product Owner' WHERE id = 'alpha';

-- Neo reports to Dante
UPDATE agent_cards SET parent_agent = NULL, tier = 'manager', role = 'Engineering Manager' WHERE id = 'neo';

-- Workers under Alpha
UPDATE agent_cards SET parent_agent = 'alpha', tier = 'worker', role = 'QA Specialist' WHERE id = 'beta-worker';
UPDATE agent_cards SET parent_agent = 'alpha', tier = 'worker', role = 'Deep Research' WHERE id = 'research-worker';

-- Workers/agents under Neo
UPDATE agent_cards SET parent_agent = 'neo', tier = 'worker', role = 'Coding & Ops' WHERE id = 'neo-worker';
UPDATE agent_cards SET parent_agent = 'neo', tier = 'worker', role = 'Infrastructure & Coding' WHERE id = 'ifra-worker';
UPDATE agent_cards SET parent_agent = 'neo', tier = 'worker', role = 'Coder' WHERE id = 'mu';
