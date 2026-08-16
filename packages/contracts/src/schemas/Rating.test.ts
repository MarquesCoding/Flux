import { describe, expect, it } from 'vitest';
import {
  HouseholdRatingSchema,
  RatingListSchema,
  RatingSchema,
  SetRatingSchema,
  averageStars,
  starFraction,
} from './Rating';

describe('RatingSchema', () => {
  it('accepts a rating against an item', () => {
    const parsed = RatingSchema.parse({
      mediaId: '3f1a5d0e-1c2b-4c3d-8e4f-5a6b7c8d9e0f',
      seriesId: null,
      stars: 4,
      ratedAt: '2026-08-16T12:00:00.000Z',
    });

    expect(parsed.stars).toBe(4);
  });

  it('accepts a rating against a series', () => {
    const parsed = RatingSchema.parse({
      mediaId: null,
      seriesId: '3f1a5d0e-1c2b-4c3d-8e4f-5a6b7c8d9e0f',
      stars: 5,
      ratedAt: '2026-08-16T12:00:00.000Z',
    });

    expect(parsed.seriesId).toBe('3f1a5d0e-1c2b-4c3d-8e4f-5a6b7c8d9e0f');
  });

  it('refuses a rating outside the scale', () => {
    expect(() => SetRatingSchema.parse({ stars: 0 })).toThrow();
    expect(() => SetRatingSchema.parse({ stars: 6 })).toThrow();
  });

  it('refuses half a star, since the scale is whole steps', () => {
    expect(() => SetRatingSchema.parse({ stars: 3.5 })).toThrow();
  });

  it('reads a list of ratings', () => {
    const parsed = RatingListSchema.parse({ ratings: [] });

    expect(parsed.ratings).toEqual([]);
  });
});

describe('averageStars', () => {
  it('answers with nothing where nobody has rated it', () => {
    expect(averageStars([])).toEqual({ average: null, count: 0 });
  });

  it('averages what the household gave', () => {
    expect(averageStars([5, 4, 3])).toEqual({ average: 4, count: 3 });
  });

  it('rounds to one decimal place', () => {
    expect(averageStars([5, 4, 4])).toEqual({ average: 4.3, count: 3 });
  });

  it('counts one rating as an average of itself', () => {
    expect(averageStars([2])).toEqual({ average: 2, count: 1 });
  });

  it('parses as a household rating', () => {
    expect(() => HouseholdRatingSchema.parse(averageStars([1, 2]))).not.toThrow();
    expect(() => HouseholdRatingSchema.parse(averageStars([]))).not.toThrow();
  });
});

describe('starFraction', () => {
  it('fills nothing for no stars', () => {
    expect(starFraction(0)).toBe(0);
  });

  it('fills everything for the top of the scale', () => {
    expect(starFraction(5)).toBe(1);
  });

  it('fills part way for a figure between', () => {
    expect(starFraction(4.2)).toBeCloseTo(0.84);
  });

  it('brings anything beyond the scale back within it', () => {
    expect(starFraction(9)).toBe(1);
    expect(starFraction(-2)).toBe(0);
  });
});
