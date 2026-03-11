-- CRM Import History table
CREATE TABLE IF NOT EXISTS crm_import_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('csv', 'vcard')),
  filename text,
  total_rows int DEFAULT 0,
  imported int DEFAULT 0,
  skipped int DEFAULT 0,
  duplicates int DEFAULT 0,
  errors int DEFAULT 0,
  column_mapping jsonb,
  error_details jsonb,
  imported_by text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_import_history_created
  ON crm_import_history (created_at DESC);
