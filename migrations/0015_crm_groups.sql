-- CRM Groups table
CREATE TABLE IF NOT EXISTS crm_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  color text DEFAULT '#6366f1',
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- CRM Group Members (join table)
CREATE TABLE IF NOT EXISTS crm_group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES crm_groups(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES crm_contacts(id) ON DELETE CASCADE,
  added_at timestamptz DEFAULT now(),
  UNIQUE(group_id, contact_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_crm_groups_name ON crm_groups (name);
CREATE INDEX IF NOT EXISTS idx_crm_group_members_group ON crm_group_members (group_id);
CREATE INDEX IF NOT EXISTS idx_crm_group_members_contact ON crm_group_members (contact_id);

-- Auto-update updated_at trigger for groups
CREATE OR REPLACE FUNCTION update_crm_groups_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_crm_groups_updated_at ON crm_groups;
CREATE TRIGGER trg_crm_groups_updated_at
  BEFORE UPDATE ON crm_groups
  FOR EACH ROW
  EXECUTE FUNCTION update_crm_groups_updated_at();
