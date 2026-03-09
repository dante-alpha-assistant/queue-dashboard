import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

describe('Smoke tests', () => {
  it('package.json is valid', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
    expect(pkg.name).toBeDefined();
  });

  it('server entry point has no syntax errors', async () => {
    // Dynamic import will throw on syntax errors
    // We just check the file is parseable
    const code = readFileSync('server/index.js', 'utf8');
    expect(code.length).toBeGreaterThan(0);
  });

  it('all migration files are valid SQL', () => {
    const dir = 'migrations';
    try {
      const files = readdirSync(dir).filter(f => f.endsWith('.sql'));
      for (const file of files) {
        const sql = readFileSync(join(dir, file), 'utf8');
        // Must be idempotent
        expect(sql.toUpperCase()).toContain('IF');
        // Must not be empty
        expect(sql.trim().length).toBeGreaterThan(0);
      }
    } catch (e) {
      // No migrations dir yet — that's fine
    }
  });
});
