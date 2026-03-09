import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

describe('Blocked column UX', () => {
  const taskCardSrc = readFileSync('client/src/components/TaskCard.jsx', 'utf8');
  const appSrc = readFileSync('client/src/App.jsx', 'utf8');
  const cssSrc = readFileSync('client/src/App.css', 'utf8');

  it('TaskCard has BLOCKER_TYPE_STYLES mapping', () => {
    expect(taskCardSrc).toContain('BLOCKER_TYPE_STYLES');
    expect(taskCardSrc).toContain('missing_credential');
    expect(taskCardSrc).toContain('permission_denied');
    expect(taskCardSrc).toContain('ambiguous');
  });

  it('TaskCard renders BlockerBadge for blocked tasks', () => {
    expect(taskCardSrc).toContain('BlockerBadge');
    expect(taskCardSrc).toContain('task.metadata?.blocker?.type');
  });

  it('TaskCard renders BlockedDurationTicker with real-time updates', () => {
    expect(taskCardSrc).toContain('BlockedDurationTicker');
    expect(taskCardSrc).toContain('Blocked');
    expect(taskCardSrc).toContain('setInterval');
  });

  it('TaskCard has quick action buttons for blocked tasks', () => {
    expect(taskCardSrc).toContain('BlockedQuickActions');
    expect(taskCardSrc).toContain('Provide Keys');
    expect(taskCardSrc).toContain('Clarify');
    expect(taskCardSrc).toContain('Retry');
  });

  it('App.jsx sorts blocked tasks by duration (longest first)', () => {
    // Sorting by updated_at ascending = oldest (longest blocked) first
    expect(appSrc).toContain('filterByType(blocked)].sort');
    expect(appSrc).toContain('new Date(a.updated_at) - new Date(b.updated_at)');
  });

  it('CSS has blocked-pulse keyframes animation', () => {
    expect(cssSrc).toContain('@keyframes blocked-pulse');
  });

  it('TaskCard applies pulse animation for long-blocked tasks', () => {
    expect(taskCardSrc).toContain('blockedLong');
    expect(taskCardSrc).toContain('blocked-pulse');
    expect(taskCardSrc).toContain('3600000');
  });
});
