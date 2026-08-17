import { describe, expect, it } from 'vitest';
import { SESSION_MESSAGE_MAX_LENGTH, SessionMessageSchema } from './SessionMessage';

describe('SessionMessageSchema', () => {
  it('takes a line somebody would actually send', () => {
    expect(SessionMessageSchema.safeParse({ text: 'Restarting in five minutes' }).success).toBe(
      true,
    );
  });

  it('refuses an empty message, which would be a banner saying nothing', () => {
    expect(SessionMessageSchema.safeParse({ text: '' }).success).toBe(false);
  });

  it('refuses a message that is only spaces', () => {
    expect(SessionMessageSchema.safeParse({ text: '   ' }).success).toBe(false);
  });

  it('trims what it is given, so a stray space does not become the message', () => {
    expect(SessionMessageSchema.parse({ text: '  tea is ready  ' }).text).toBe('tea is ready');
  });

  it('takes a message of exactly the length allowed', () => {
    const text = 'a'.repeat(SESSION_MESSAGE_MAX_LENGTH);

    expect(SessionMessageSchema.safeParse({ text }).success).toBe(true);
  });

  it('refuses one longer than the banner can hold', () => {
    const text = 'a'.repeat(SESSION_MESSAGE_MAX_LENGTH + 1);

    expect(SessionMessageSchema.safeParse({ text }).success).toBe(false);
  });

  it('refuses a message that is not text at all', () => {
    expect(SessionMessageSchema.safeParse({ text: 42 }).success).toBe(false);
  });
});
