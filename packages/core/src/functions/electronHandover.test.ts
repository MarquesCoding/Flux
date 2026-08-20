import { describe, expect, it } from 'vitest';
import { electronHandover } from './electronHandover';

const ALL_THREE = { client_id: 'electron', code_challenge: 'a-challenge', state: 'a-state' };

describe('electronHandover', () => {
  it('picks out the three a desktop client sends somebody with', () => {
    expect(electronHandover(ALL_THREE)).toEqual(ALL_THREE);
  });

  it('ignores everything else in the address', () => {
    expect(electronHandover({ ...ALL_THREE, library: 'abc', redirect: '/somewhere' })).toEqual(
      ALL_THREE,
    );
  });

  it('answers with nothing for an ordinary visit, which is most of them', () => {
    expect(electronHandover({})).toBeNull();
  });

  it('refuses two of three, which is a query with something missing rather than a handover', () => {
    expect(electronHandover({ client_id: 'electron', state: 'a-state' })).toBeNull();
    expect(electronHandover({ client_id: 'electron', code_challenge: 'a-challenge' })).toBeNull();
    expect(electronHandover({ code_challenge: 'a-challenge', state: 'a-state' })).toBeNull();
  });

  it('refuses an empty one, which is the same as it not being there', () => {
    expect(electronHandover({ ...ALL_THREE, state: '' })).toBeNull();
  });
});
