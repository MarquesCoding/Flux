import { describe, expect, it } from 'vitest';
import { groupVersions } from './groupVersions';

const FOLDER = '/media/films/Parasite (2019)';

describe('a film held as more than one cut of itself', () => {
  it('hangs every other cut off one of them', () => {
    const found = groupVersions([
      `${FOLDER}/Parasite (2019).mkv`,
      `${FOLDER}/Parasite (2019) - B&W.mkv`,
    ]);

    expect(found.get(`${FOLDER}/Parasite (2019) - B&W.mkv`)).toEqual({
      parentPath: `${FOLDER}/Parasite (2019).mkv`,
      label: 'B&W',
    });
  });

  it('leaves the film itself as the film', () => {
    const found = groupVersions([
      `${FOLDER}/Parasite (2019).mkv`,
      `${FOLDER}/Parasite (2019) - B&W.mkv`,
    ]);

    expect(found.has(`${FOLDER}/Parasite (2019).mkv`)).toBe(false);
  });

  it('picks one to be the film where none is named exactly after the folder', () => {
    const found = groupVersions([
      `${FOLDER}/Parasite (2019) - Colour.mkv`,
      `${FOLDER}/Parasite (2019) - B&W.mkv`,
    ]);

    expect([...found.keys()]).toEqual([`${FOLDER}/Parasite (2019) - Colour.mkv`]);
    expect(found.get(`${FOLDER}/Parasite (2019) - Colour.mkv`)?.label).toBe('Colour');
  });

  it('reads a label however it was separated off', () => {
    const found = groupVersions([
      `${FOLDER}/Parasite (2019).mkv`,
      `${FOLDER}/Parasite (2019) [Extended].mkv`,
    ]);

    expect(found.get(`${FOLDER}/Parasite (2019) [Extended].mkv`)?.label).toBe('Extended');
  });

  it('refuses a folder holding films that merely sit together', () => {
    expect(
      groupVersions(['/media/films/Arrival (2016).mkv', '/media/films/Parasite (2019).mkv']).size,
    ).toBe(0);
  });

  it('refuses a folder where one file does not carry the film’s name', () => {
    expect(
      groupVersions([
        `${FOLDER}/Parasite (2019).mkv`,
        `${FOLDER}/Parasite (2019) - B&W.mkv`,
        `${FOLDER}/Something Else.mkv`,
      ]).size,
    ).toBe(0);
  });

  it('says nothing of a film held as one file, which is most of them', () => {
    expect(groupVersions([`${FOLDER}/Parasite (2019).mkv`]).size).toBe(0);
  });

  it('leaves an extra out of it, since an extra is not a cut of anything', () => {
    const trailer = `${FOLDER}/Parasite (2019)-trailer.mkv`;
    const found = groupVersions(
      [`${FOLDER}/Parasite (2019).mkv`, `${FOLDER}/Parasite (2019) - B&W.mkv`, trailer],
      new Set([trailer]),
    );

    expect(found.has(trailer)).toBe(false);
    expect(found.size).toBe(1);
  });
});
