import { describe, expect, it } from 'vitest';
import { drawAvatar, isAvatarStyle, AVATAR_STYLES } from './drawAvatar';

describe('isAvatarStyle', () => {
  it('recognises every style on offer', () => {
    for (const style of Object.keys(AVATAR_STYLES)) {
      expect(isAvatarStyle(style)).toBe(true);
    }
  });

  it('does not recognise a style nothing can draw', () => {
    expect(isAvatarStyle('oil-painting')).toBe(false);
  });

  it('is not fooled by something every object has', () => {
    expect(isAvatarStyle('toString')).toBe(false);
  });
});

describe('drawAvatar', () => {
  it('draws a picture rather than pointing at one somewhere else', () => {
    expect(drawAvatar('bottts', 'abc')).toContain('<svg');
  });

  it('draws the same face for the same seed, so a few bytes are all that is kept', () => {
    expect(drawAvatar('bottts', 'abc')).toBe(drawAvatar('bottts', 'abc'));
  });

  it('draws a different face for a different seed', () => {
    expect(drawAvatar('bottts', 'abc')).not.toBe(drawAvatar('bottts', 'xyz'));
  });

  it('draws a different face for a different style', () => {
    expect(drawAvatar('bottts', 'abc')).not.toBe(drawAvatar('thumbs', 'abc'));
  });

  it('draws every style it offers', () => {
    for (const style of Object.keys(AVATAR_STYLES)) {
      expect(isAvatarStyle(style) && drawAvatar(style, 'abc')).toContain('<svg');
    }
  });
});
