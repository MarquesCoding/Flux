import { afterEach, describe, expect, it, vi } from 'vitest';
import { askForADifferentServer, isTheDesktopClient } from './theDesktopShell';

const insideTheWindow = (): void => {
  document.documentElement.dataset['valenceDesktop'] = 'true';
};

afterEach(() => {
  delete document.documentElement.dataset['valenceDesktop'];
});

describe('isTheDesktopClient', () => {
  it('says no in a browser, which puts no mark on the document', () => {
    expect(isTheDesktopClient()).toBe(false);
  });

  it('says yes where the window marked the document before the page ran', () => {
    insideTheWindow();

    expect(isTheDesktopClient()).toBe(true);
  });

  it('says no for a mark that says anything else, rather than for merely being present', () => {
    document.documentElement.dataset['valenceDesktop'] = 'maybe';

    expect(isTheDesktopClient()).toBe(false);
  });
});

describe('askForADifferentServer', () => {
  it('asks the window, which is the only thing that can point itself somewhere else', () => {
    const heard = vi.fn();
    document.addEventListener('valence:change-server', heard);

    askForADifferentServer();

    expect(heard).toHaveBeenCalledOnce();

    document.removeEventListener('valence:change-server', heard);
  });

  it('asks nothing in particular in a browser, where nobody is listening', () => {
    expect(() => {
      askForADifferentServer();
    }).not.toThrow();
  });
});
