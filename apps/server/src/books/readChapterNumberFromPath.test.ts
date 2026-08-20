import { describe, expect, it } from 'vitest';
import { readChapterNumberFromPath } from './readChapterNumberFromPath';

describe('readChapterNumberFromPath', () => {
  it('reads a volume out of a real filename, past the year it also carries', () => {
    expect(
      readChapterNumberFromPath('Rent-A-Girlfriend v05 (2021) (Digital) (Sticky Oak) (f).cbz'),
    ).toBe(5);
  });

  it('reads a volume in the thirties, which is where that library actually is', () => {
    expect(
      readChapterNumberFromPath('Rent-A-Girlfriend v37 (2026) (Digital) (Sticky Oak).cbz'),
    ).toBe(37);
  });

  it('reads a chapter written out', () => {
    expect(readChapterNumberFromPath('Chapter 001.cbz')).toBe(1);
  });

  it('prefers the chapter where a name carries both, since that is what somebody asks for', () => {
    expect(readChapterNumberFromPath('Vol 02 Ch 014.cbz')).toBe(14);
  });

  it('reads the short form a scanner writes', () => {
    expect(readChapterNumberFromPath('Rent-A-Girlfriend - c033 (v05).cbz')).toBe(33);
  });

  it('keeps a half, which is how a chapter between two others is published', () => {
    expect(readChapterNumberFromPath('Chapter 10.5.cbz')).toBe(10.5);
  });

  it('reads a bare number where the name marks nothing', () => {
    expect(readChapterNumberFromPath('014.cbz')).toBe(14);
  });

  it('never reads a year as a chapter, which would order a library wrongly for ever', () => {
    expect(readChapterNumberFromPath('Something (2021).cbz')).toBeNull();
  });

  it('says nothing where the name carries no number at all', () => {
    expect(readChapterNumberFromPath('Prologue.cbz')).toBeNull();
  });
});
