import { describe, expect, it } from 'vitest';
import { keyFor, keyOf } from './ratingKeys';

const AN_ID = '9c858901-8a57-4791-81fe-4c455b099bc9';

describe('keyFor', () => {
  it('keys an item by the item it is', () => {
    expect(keyFor({ mediaId: AN_ID })).toBe(`media:${AN_ID}`);
  });

  it('keys a programme by the programme it is', () => {
    expect(keyFor({ seriesId: AN_ID })).toBe(`series:${AN_ID}`);
  });

  it('keeps an item and a programme apart where they share an identifier', () => {
    expect(keyFor({ mediaId: AN_ID })).not.toBe(keyFor({ seriesId: AN_ID }));
  });
});

describe('keyOf', () => {
  it('reads a rating the server sent about an item back to the same key', () => {
    expect(keyOf({ mediaId: AN_ID, seriesId: null })).toBe(keyFor({ mediaId: AN_ID }));
  });

  it('reads a rating about a programme back to the same key', () => {
    expect(keyOf({ mediaId: null, seriesId: AN_ID })).toBe(keyFor({ seriesId: AN_ID }));
  });

  it('reads a rating about nothing as a programme with no name rather than failing', () => {
    expect(keyOf({ mediaId: null, seriesId: null })).toBe('series:');
  });
});
