import { beforeEach, describe, expect, it, vi } from 'vitest';
import { theDesktopsStore } from './theDesktopsStore';

const onDisk = new Map<string, string | number>();

let refuse = false;

vi.mock('@tauri-apps/plugin-store', () => ({
  load: () => {
    if (refuse) {
      return Promise.reject(new Error('There is nowhere to keep a file.'));
    }

    return Promise.resolve({
      entries: () => Promise.resolve([...onDisk.entries()]),
      set: (key: string, value: string | number) => {
        onDisk.set(key, value);

        return Promise.resolve();
      },
      delete: (key: string) => {
        onDisk.delete(key);

        return Promise.resolve();
      },
    });
  },
}));

beforeEach(() => {
  onDisk.clear();
  refuse = false;
});

describe('theDesktopsStore', () => {
  it('knows nothing before it has read the file', () => {
    onDisk.set('the-theme', 'dark');

    expect(theDesktopsStore().read('the-theme')).toBeNull();
  });

  it('answers with what the file held, so somebody is asked once rather than at every launch', async () => {
    onDisk.set('flux.server.address', 'https://flux.example.com');

    const store = theDesktopsStore();
    await store.hydrate();

    expect(store.read('flux.server.address')).toBe('https://flux.example.com');
  });

  it('ignores what the file held that is not a preference, rather than trusting the shape', async () => {
    onDisk.set('the-theme', 42);

    const store = theDesktopsStore();
    await store.hydrate();

    expect(store.read('the-theme')).toBeNull();
  });

  it('answers a read without waiting, since a preference is read while something is drawn', async () => {
    const store = theDesktopsStore();
    await store.hydrate();

    store.write('the-theme', 'dark');

    expect(store.read('the-theme')).toBe('dark');
  });

  it('puts what it was told on disk, which is the point of the file', async () => {
    const store = theDesktopsStore();
    await store.hydrate();

    store.write('the-theme', 'dark');
    await Promise.resolve();

    expect(onDisk.get('the-theme')).toBe('dark');
  });

  it('lets go on disk as well as in hand', async () => {
    onDisk.set('the-theme', 'dark');

    const store = theDesktopsStore();
    await store.hydrate();

    store.forget('the-theme');
    await Promise.resolve();

    expect(store.read('the-theme')).toBeNull();
    expect(onDisk.has('the-theme')).toBe(false);
  });

  it('still holds a preference for this run where there is no file to keep one in', async () => {
    refuse = true;

    const store = theDesktopsStore();
    await store.hydrate();

    store.write('the-theme', 'dark');

    expect(store.read('the-theme')).toBe('dark');
  });
});
