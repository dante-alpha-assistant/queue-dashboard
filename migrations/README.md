# Database Migrations

## Convention

All database schema changes MUST be committed as SQL files in this folder.

### File naming
```
NNNN_description.sql
```
- `NNNN` = sequential 4-digit number (0001, 0002, ...)
- `description` = short snake_case description of the change

### Rules
1. **Every new column, table, index, or trigger change MUST have a migration file**
2. **Migrations MUST be idempotent** — use `IF NOT EXISTS`, `IF EXISTS`, `CREATE OR REPLACE`
3. **Never modify an existing migration file** — create a new one instead
4. **Migrations run in order** — the deploy pipeline executes them sequentially
5. **Test your migration** — run it against the Supabase project before committing

### Example
```sql
-- migrations/0003_add_paused_column.sql
ALTER TABLE agent_tasks ADD COLUMN IF NOT EXISTS paused boolean DEFAULT false;
```

### How it works
The deploy endpoint runs all pending migrations before deployment.
A `_migrations` table tracks which migrations have been applied.
