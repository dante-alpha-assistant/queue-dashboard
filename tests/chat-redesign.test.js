import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

describe('NewTaskChat redesign — sidebar removed, header icons added', () => {
  const code = readFileSync('client/src/components/NewTaskChat.jsx', 'utf8');

  it('does not have a sidebar with "+ New Chat" button', () => {
    expect(code).not.toContain('"+ New Chat"');
    expect(code).not.toContain("'+ New Chat'");
  });

  it('does not have a hamburger menu toggle for sidebar', () => {
    expect(code).not.toMatch(/title=["']Conversation history["']/);
  });

  it('has a New Chat header icon button', () => {
    expect(code).toMatch(/title=["']New chat["']/);
  });

  it('has a History header icon button', () => {
    expect(code).toMatch(/title=["']History["']/);
  });

  it('has a Clear conversation header icon button', () => {
    expect(code).toMatch(/title=["']Clear conversation["']/);
  });

  it('has a HistoryView component (formerly HistoryDropdown)', () => {
    expect(code).toContain('HistoryView');
  });

  it('renders a Neo avatar for assistant messages', () => {
    expect(code).toMatch(/NeoAvatar|neo-avatar|neoAvatar/i);
  });

  it('history view shows conversations text', () => {
    expect(code).toContain('Conversations');
  });
});
