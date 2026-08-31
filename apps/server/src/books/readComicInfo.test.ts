import { describe, expect, it } from 'vitest';
import { readComicInfo } from './readComicInfo';

describe('readComicInfo', () => {
  it('reads what a comic says about itself', () => {
    expect(
      readComicInfo(
        '<ComicInfo><Series>Rent-A-Girlfriend</Series><Writer>Reiji Miyajima</Writer><Summary>A student hires a girlfriend.</Summary></ComicInfo>',
      ),
    ).toEqual({
      title: 'Rent-A-Girlfriend',
      authors: ['Reiji Miyajima'],
      description: 'A student hires a girlfriend.',
    });
  });

  it('prefers the series over one volume’s own name, which is what a shelf is arranged by', () => {
    expect(
      readComicInfo(
        '<ComicInfo><Series>Berserk</Series><Title>The Black Swordsman</Title></ComicInfo>',
      )?.title,
    ).toBe('Berserk');
  });

  it('falls back to the title where no series is named', () => {
    expect(readComicInfo('<ComicInfo><Title>Watchmen</Title></ComicInfo>')?.title).toBe('Watchmen');
  });

  it('separates writers who are credited together', () => {
    expect(
      readComicInfo('<ComicInfo><Writer>One Person, Another Person</Writer></ComicInfo>')?.authors,
    ).toEqual(['One Person', 'Another Person']);
  });

  it('leaves the rest of the credits out, which would say less than naming nobody', () => {
    expect(
      readComicInfo(
        '<ComicInfo><Writer>A Writer</Writer><Penciller>Somebody Else</Penciller></ComicInfo>',
      )?.authors,
    ).toEqual(['A Writer']);
  });

  it('treats a tag left empty as one that was never filled in', () => {
    expect(readComicInfo('<ComicInfo><Series></Series><Writer>  </Writer></ComicInfo>')).toBeNull();
  });

  it('answers with nothing for a file that claims nothing', () => {
    expect(readComicInfo('<ComicInfo />')).toBeNull();
  });
});
