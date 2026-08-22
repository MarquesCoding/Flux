import { beforeEach, describe, expect, it, vi } from 'vitest';

const setIcon = vi.fn();

let dock: { setIcon: (path: string) => void } | undefined = { setIcon };

vi.mock('electron', () => ({
  app: {
    getAppPath: () => '/an/app',
    get dock() {
      return dock;
    },
  },
}));

const { theDockIcon } = await import('./theDockIcon');

beforeEach(() => {
  setIcon.mockClear();
  dock = { setIcon };
});

describe('theDockIcon', () => {
  it('puts Valence in the dock, which otherwise shows the engine it was run with', () => {
    theDockIcon();

    expect(setIcon).toHaveBeenCalledWith('/an/app/build/icon.png');
  });

  it('does nothing where there is no dock, which is everywhere but macOS', () => {
    dock = undefined;

    expect(() => {
      theDockIcon();
    }).not.toThrow();
  });
});
