import { describe, expect, it } from 'vitest';
import { SessionMessageSchema, SESSION_MESSAGE_MAX_LENGTH } from './SessionMessage';

describe('SessionMessageSchema', () => {
  it('accepts a line somebody would actually send', () => {
    expect(SessionMessageSchema.parse({ text: 'Restarting the server in five minutes.' })).toEqual({
      text: 'Restarting the server in five minutes.',
    });
  });

  it('trims the surrounding space rather than delivering it', () => {
    expect(SessionMessageSchema.parse({ text: '  Dinner is ready.  ' })).toEqual({
      text: 'Dinner is ready.',
    });
  });

  it('refuses a message that says nothing', () => {
    expect(SessionMessageSchema.safeParse({ text: '   ' }).success).toBe(false);
  });

  it('refuses more than a banner can hold', () => {
    const tooLong = 'a'.repeat(SESSION_MESSAGE_MAX_LENGTH + 1);

    expect(SessionMessageSchema.safeParse({ text: tooLong }).success).toBe(false);
  });

  it('accepts exactly as much as a banner can hold', () => {
    const longest = 'a'.repeat(SESSION_MESSAGE_MAX_LENGTH);

    expect(SessionMessageSchema.safeParse({ text: longest }).success).toBe(true);
  });
});
