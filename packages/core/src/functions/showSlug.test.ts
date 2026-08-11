import { describe, expect, it } from 'vitest';
import { showSlug, LONGEST } from './showSlug';

describe('showSlug', () => {
  it('makes a title safe to put in an address', () => {
    expect(showSlug('A Sign of Affection')).toBe('a-sign-of-affection');
  });

  it('treats a title said two ways as one show', () => {
    expect(showSlug('a sign of affection!')).toBe(showSlug('A Sign of Affection'));
  });

  it('drops punctuation rather than encoding it', () => {
    expect(showSlug("Marvel's Daredevil: Born Again")).toBe('marvel-s-daredevil-born-again');
  });

  it('leaves no dashes hanging off either end', () => {
    expect(showSlug('  ...Hello!  ')).toBe('hello');
  });

  it('keeps a name readable over the phone', () => {
    expect(showSlug('a'.repeat(200)).length).toBe(LONGEST);
  });

  it('answers with nothing for a title made only of punctuation', () => {
    expect(showSlug('!!!')).toBe('');
  });
});
