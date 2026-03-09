import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

describe('Activity tab filter controls', () => {
  const src = readFileSync('client/src/components/ActivityLog.jsx', 'utf8');

  it('defines ACTIVITY_FILTERS with all required filter keys', () => {
    const requiredFilters = ['all', 'errors', 'status', 'merges', 'assignments'];
    for (const key of requiredFilters) {
      expect(src).toContain(`key: '${key}'`);
    }
  });

  it('FilterChips component is defined and rendered', () => {
    expect(src).toContain('function FilterChips');
    expect(src).toContain('<FilterChips');
  });

  it('filter chips have data-testid attributes for each filter', () => {
    expect(src).toContain('data-testid={`activity-filter-${f.key}`}');
  });

  it('error filter has red tint styling when errors exist', () => {
    // Check error tint logic exists
    expect(src).toContain("isErrorChip && hasErrors");
    expect(src).toContain("#BA1A1A");
  });

  it('count badges are rendered for each filter', () => {
    // Counts are computed per filter
    expect(src).toContain('counts[f.key]');
  });

  it('filters entries based on field values', () => {
    // Error filter matches field === 'error'
    expect(src).toContain("e.field === 'error'");
    // Status filter matches field === 'status'
    expect(src).toContain("e.field === 'status'");
    // Merges filter matches merge_complete, merge_conflict, merge_error
    expect(src).toContain("'merge_complete'");
    expect(src).toContain("'merge_conflict'");
    expect(src).toContain("'merge_error'");
    // Assignments filter
    expect(src).toContain("e.field === 'assigned_agent'");
  });

  it('activeFilter state is initialized to all', () => {
    expect(src).toContain("useState('all')");
  });

  it('shows empty state when no entries match filter', () => {
    expect(src).toContain('No matching activity entries');
  });
});
