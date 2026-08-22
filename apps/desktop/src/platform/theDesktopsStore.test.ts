import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { theDesktopsStore } from './theDesktopsStore';

const onDisk = new Map<string, string>();

const written: string[] = [];

const aBridge = () => ({
  preferences: {
    held: Object.freeze(Object.fromEntries(onDisk)),
    write: (key: string, value: string) => {
      onDisk.set(key, value);
      written.push(`${key}=${value}`);
    },
    forget: (key: string) => {
      onDisk.delete(key);
      written.push(`${key} gone`);
    },
  },
});

beforeEach(() => {
  onDisk.clear();
  written.length = 0;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('theDesktopsStore', () => {
  it('answers with what the file already held, so somebody is asked once rather than at every launch', () => {
    onDisk.set('valence.server.address', 'https://valence.example.com');
    vi.stubGlobal('valence', aBridge());

    expect(theDesktopsStore().read('valence.server.address')).toBe('https://valence.example.com');
  });

  it('answers a read without waiting, since a preference is read while something is drawn', () => {
    vi.stubGlobal('valence', aBridge());

    const store = theDesktopsStore();
    store.write('the-theme', 'dark');

    expect(store.read('the-theme')).toBe('dark');
  });

  it('puts what it was told on the file, which is the point of the file', () => {
    vi.stubGlobal('valence', aBridge());

    theDesktopsStore().write('the-theme', 'dark');

    expect(written).toEqual(['the-theme=dark']);
  });

  it('lets go on the file as well as in hand', () => {
    onDisk.set('the-theme', 'dark');
    vi.stubGlobal('valence', aBridge());

    const store = theDesktopsStore();
    store.forget('the-theme');

    expect(store.read('the-theme')).toBeNull();
    expect(written).toEqual(['the-theme gone']);
  });

  it('answers with nothing for a preference nobody has set', () => {
    vi.stubGlobal('valence', aBridge());

    expect(theDesktopsStore().read('never-set')).toBeNull();
  });
});
