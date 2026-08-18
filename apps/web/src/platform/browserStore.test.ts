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
    store.write('flux.thing', 'kept');

    expect(store.read('flux.thing')).toBe('kept');
  });

  it('says nothing for something it was never given', () => {
    expect(store.read('flux.nothing')).toBeNull();
  });

  it('forgets what it is asked to forget', () => {
    store.write('flux.thing', 'kept');
    store.forget('flux.thing');

    expect(store.read('flux.thing')).toBeNull();
  });

  it('answers with nothing where storage is refused, as a private window refuses it', () => {
    vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
      throw new Error('private mode');
    });

    expect(store.read('flux.thing')).toBeNull();
  });

  it('carries on where a write is refused, rather than stopping anybody watching', () => {
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });

    expect(() => {
      store.write('flux.thing', 'kept');
    }).not.toThrow();
  });

  it('carries on where forgetting is refused too', () => {
    vi.spyOn(window.localStorage, 'removeItem').mockImplementation(() => {
      throw new Error('private mode');
    });

    expect(() => {
      store.forget('flux.thing');
    }).not.toThrow();
  });
});
