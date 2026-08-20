import { describe, expect, it } from 'vitest';
import { imageTypeFor } from './imageTypeFor';

describe('imageTypeFor', () => {
  it('reads a drawing', () => {
    expect(imageTypeFor('page.png')).toBe('image/png');
  });

  it('reads a photograph, which is what a cover often is even where pages are not', () => {
    expect(imageTypeFor('cover.jpg')).toBe('image/jpeg');
  });

  it('does not mind how the name was capitalised', () => {
    expect(imageTypeFor('PAGE.PNG')).toBe('image/png');
  });

  it('says nothing about a listing of contents, which is not a page', () => {
    expect(imageTypeFor('ComicInfo.xml')).toBeNull();
  });

  it('says nothing about a name with no extension at all', () => {
    expect(imageTypeFor('README')).toBeNull();
  });
});
