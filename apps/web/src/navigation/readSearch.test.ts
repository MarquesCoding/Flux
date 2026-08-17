import { describe, expect, it } from 'vitest';
import { readSearch } from './readSearch';

describe('readSearch', () => {
  it('reads what an address carried over whatever section it was opened from', () => {
    expect(
      readSearch({
        q: 'blade',
        show: 'ted',
        person: '7',
        item: 'arrival',
        party: 'room',
        genre: 'drama',
        library: 'films',
        panel: 'jobs',
        job: 'library.scan',
      }),
    ).toEqual({
      q: 'blade',
      show: 'ted',
      person: 7,
      item: 'arrival',
      party: 'room',
      genre: 'drama',
      library: 'films',
      panel: 'jobs',
      job: 'library.scan',
    });
  });

  it('says nothing was asked for where nothing was', () => {
    expect(readSearch({})).toEqual({
      q: '',
      show: null,
      person: null,
      item: null,
      party: null,
      genre: null,
      library: null,
      panel: null,
      job: null,
    });
  });

  it('opens no dialog about somebody who could not exist', () => {
    expect(readSearch({ person: 'banana' }).person).toBeNull();
    expect(readSearch({ person: '-3' }).person).toBeNull();
    expect(readSearch({ person: '2.5' }).person).toBeNull();
    expect(readSearch({ person: '0' }).person).toBeNull();
  });

  it('drops one thing it could not read rather than the whole address', () => {
    expect(readSearch({ person: 'banana', q: 'blade' })).toMatchObject({
      person: null,
      q: 'blade',
    });
  });

  it('treats an empty value as nothing, since a trimmed address should open nothing', () => {
    expect(readSearch({ show: '', item: '' })).toMatchObject({ show: null, item: null });
  });
});
