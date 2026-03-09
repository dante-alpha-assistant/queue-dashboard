# Contributing Guidelines

## Database Schema Changes — MANDATORY

**Every PR that references new database columns, tables, or indexes MUST include a migration file.**

### How to add a migration

1. Create a new file in `migrations/` with the next sequential number:
   ```
   migrations/NNNN_short_description.sql
   ```

2. Write idempotent SQL:
   ```sql
   ALTER TABLE agent_tasks ADD COLUMN IF NOT EXISTS my_column text DEFAULT 'value';
   CREATE INDEX IF NOT EXISTS idx_my_column ON agent_tasks(my_column);
   ```

3. Commit the migration file in the same PR as your code changes.

### Rules
- **NEVER** reference a column in code without a migration file
- **ALWAYS** use `IF NOT EXISTS` / `IF EXISTS` for idempotency
- **NEVER** modify existing migration files — create a new one
- **NEVER** run manual SQL against the database — use a migration file
- Migrations run automatically on deploy

### What happens if you skip this
- The QA review will **auto-fail** your PR
- The CI check will **block** merge
- The scheduler will crash at runtime (as we learned the hard way with the `paused` column)
