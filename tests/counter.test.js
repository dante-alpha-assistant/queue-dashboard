import { describe, it, expect } from 'vitest';

// Extracted logic matching App.jsx countActiveTasks
const countActiveTasks = (tasks) => tasks.filter(t => t.assigned_agent).length;

describe('countActiveTasks', () => {
  it('counts tasks with assigned agents, not unique names', () => {
    const tasks = [
      { id: 1, assigned_agent: 'beta-worker' },
      { id: 2, assigned_agent: 'beta-worker' },
      { id: 3, assigned_agent: 'beta-worker' },
      { id: 4, assigned_agent: 'neo-worker' },
    ];
    // Old bug: would return 2 (unique agents). Should return 4 (active tasks).
    expect(countActiveTasks(tasks)).toBe(4);
  });

  it('returns 0 when no tasks are assigned', () => {
    const tasks = [
      { id: 1, assigned_agent: null },
      { id: 2, assigned_agent: null },
    ];
    expect(countActiveTasks(tasks)).toBe(0);
  });

  it('handles mixed assigned and unassigned', () => {
    const tasks = [
      { id: 1, assigned_agent: 'beta-worker' },
      { id: 2, assigned_agent: null },
      { id: 3, assigned_agent: 'beta-worker' },
    ];
    expect(countActiveTasks(tasks)).toBe(2);
  });

  it('handles empty array', () => {
    expect(countActiveTasks([])).toBe(0);
  });
});
