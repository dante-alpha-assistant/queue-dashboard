-- CRM Contacts table
CREATE TABLE IF NOT EXISTS crm_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text,
  phone text,
  company text,
  role text,
  tags text[] DEFAULT '{}',
  notes text,
  source text,
  avatar_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Index for searching by name/email
CREATE INDEX IF NOT EXISTS idx_crm_contacts_name ON crm_contacts (name);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_email ON crm_contacts (email);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_company ON crm_contacts (company);

-- Activity log trigger for updated_at
CREATE OR REPLACE FUNCTION update_crm_contacts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_crm_contacts_updated_at ON crm_contacts;
CREATE TRIGGER trg_crm_contacts_updated_at
  BEFORE UPDATE ON crm_contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_crm_contacts_updated_at();

-- Storage bucket for contact avatars (created via API, not SQL)
-- See server/routes/contacts.js for bucket creation on startup
