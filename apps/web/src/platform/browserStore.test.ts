import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { theBrowsersStore } from './browserStore';

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

const store = theBrowsersStore();

describe('theBrowsersStore', () => {
  it('reads back what it was given', () => {
    store.write('valence.thing', 'kept');

    expect(store.read('valence.thing')).toBe('kept');
  });

  it('says nothing for something it was never given', () => {
    expect(store.read('valence.nothing')).toBeNull();
  });

  it('forgets what it is asked to forget', () => {
    store.write('valence.thing', 'kept');
    store.forget('valence.thing');

    expect(store.read('valence.thing')).toBeNull();
  });

  it('answers with nothing where storage is refused, as a private window refuses it', () => {
    vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
      throw new Error('private mode');
    });

    expect(store.read('valence.thing')).toBeNull();
  });

  it('carries on where a write is refused, rather than stopping anybody watching', () => {
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });

    expect(() => {
      store.write('valence.thing', 'kept');
    }).not.toThrow();
  });

  it('carries on where forgetting is refused too', () => {
    vi.spyOn(window.localStorage, 'removeItem').mockImplementation(() => {
      throw new Error('private mode');
    });

    expect(() => {
      store.forget('valence.thing');
    }).not.toThrow();
  });
});
