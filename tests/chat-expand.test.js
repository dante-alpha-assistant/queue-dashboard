import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

describe('Chat expand panel feature', () => {
  const code = readFileSync('client/src/components/NewTaskChat.jsx', 'utf8');

  it('has expanded state with localStorage persistence', () => {
    expect(code).toContain('neo-chat-expanded');
    expect(code).toContain('localStorage.getItem');
    expect(code).toContain('localStorage.setItem');
  });

  it('has expand/collapse toggle button', () => {
    expect(code).toContain('toggleExpanded');
    expect(code).toContain('Expand to side panel');
    expect(code).toContain('Collapse to popup');
  });

  it('has expanded container style with fixed right panel', () => {
    expect(code).toContain('top: 0, right: 0, bottom: 0');
    expect(code).toContain('width: 420');
    expect(code).toContain('borderLeft:');
  });

  it('has smooth transition animation', () => {
    expect(code).toContain('transition:');
    expect(code).toContain('cubic-bezier');
  });

  it('hides sidebar in expanded mode by default', () => {
    expect(code).toContain('!isMobile && !expanded');
  });

  it('has history toggle in expanded mode', () => {
    expect(code).toContain('isMobile || expanded');
    expect(code).toContain('Conversation history');
  });
});
