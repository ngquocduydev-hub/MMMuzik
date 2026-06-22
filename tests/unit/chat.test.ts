import { describe, it, expect } from 'vitest';
import { validateMessageBody, normalizeMessageBody } from '@/shared/domain/chat';
import { CHAT_MAX_LENGTH } from '@/shared/constants';

describe('normalizeMessageBody', () => {
  it('trims surrounding whitespace', () => {
    expect(normalizeMessageBody('  hi there \n')).toBe('hi there');
  });
});

describe('validateMessageBody (REQ-CHAT-4)', () => {
  it('accepts a normal message and returns the trimmed body', () => {
    const r = validateMessageBody('  hello  ');
    expect(r).toEqual({ ok: true, body: 'hello' });
  });

  it('rejects a blank / whitespace-only message as empty', () => {
    expect(validateMessageBody('')).toEqual({ ok: false, reason: 'empty' });
    expect(validateMessageBody('   \t\n ')).toEqual({ ok: false, reason: 'empty' });
  });

  it('accepts a message exactly at the max length', () => {
    const body = 'a'.repeat(CHAT_MAX_LENGTH);
    expect(validateMessageBody(body)).toEqual({ ok: true, body });
  });

  it('rejects a message longer than the max length', () => {
    const r = validateMessageBody('a'.repeat(CHAT_MAX_LENGTH + 1));
    expect(r).toEqual({ ok: false, reason: 'too_long' });
  });
});
