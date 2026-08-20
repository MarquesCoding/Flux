import { describe, expect, it } from 'vitest';
import { readBookTitleFromPath } from './readBookTitleFromPath';

describe('readBookTitleFromPath', () => {
  it('reads a title out of a real folder, throwing away who scanned it', () => {
    expect(readBookTitleFromPath('Rent-A-Girlfriend (Digital) (Sticky Oak)').title).toBe(
      'Rent-A-Girlfriend',
    );
  });

  it('keeps the year where the name carried one', () => {
    expect(readBookTitleFromPath('Ore wa Gimai (2022) (Digital)').year).toBe(2022);
  });

  it('throws away square brackets too, which is where a group usually puts itself', () => {
    expect(readBookTitleFromPath('Some Manga [KDT SCANS]').title).toBe('Some Manga');
  });

  it('names a loose file without the number stuck to it', () => {
    expect(readBookTitleFromPath('Rent-A-Girlfriend v05 (2021).cbz').title).toBe(
      'Rent-A-Girlfriend',
    );
  });

  it('tidies the separators a filename uses instead of spaces', () => {
    expect(readBookTitleFromPath('Ore.wa.Gimai.ni.Uso').title).toBe('Ore wa Gimai ni Uso');
  });

  it('keeps a title that is nothing but brackets rather than returning nothing', () => {
    expect(readBookTitleFromPath('(Digital)').title).toBe('(Digital)');
  });

  it('says nothing about a year where the name carried none', () => {
    expect(readBookTitleFromPath('Rent-A-Girlfriend').year).toBeNull();
  });
});
