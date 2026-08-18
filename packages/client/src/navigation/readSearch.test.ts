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

  it('leaves out what was not asked for, since the router writes this back to the address', () => {
    expect(readSearch({})).toEqual({});
  });

  it('opens no dialog about somebody who could not exist', () => {
    expect(readSearch({ person: 'banana' }).person).toBeUndefined();
    expect(readSearch({ person: '-3' }).person).toBeUndefined();
    expect(readSearch({ person: '2.5' }).person).toBeUndefined();
    expect(readSearch({ person: '0' }).person).toBeUndefined();
  });

  it('drops one thing it could not read rather than the whole address', () => {
    expect(readSearch({ person: 'banana', q: 'blade' })).toEqual({ q: 'blade' });
  });

  it('treats an empty value as nothing, since a trimmed address should open nothing', () => {
    expect(readSearch({ show: '', item: '' })).toEqual({});
  });
});
