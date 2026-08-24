import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { aFakePlatform } from '@ValenceClient/testing/aFakePlatform';
import { forgetPlatform, installPlatform } from '@ValenceClient/platform/installPlatform';
import { chooseTheme, chosenTheme, readTheme, whenThemeChanges } from './theme';

beforeEach(() => {
  installPlatform(aFakePlatform());
});

afterEach(() => {
  forgetPlatform();
});

describe('chosenTheme', () => {
  it('follows the machine until somebody says otherwise', () => {
    expect(chosenTheme()).toBe('system');
  });

  it('remembers a choice', () => {
    chooseTheme('light');

    expect(chosenTheme()).toBe('light');
  });

  it('forgets a choice rather than remembering the absence of one', () => {
    chooseTheme('dark');
    chooseTheme('system');

    expect(chosenTheme()).toBe('system');
  });

  it('reads nonsense on the device as following the machine', () => {
    installPlatform(aFakePlatform());
    chooseTheme('dark');
    aFakePlatform().store.write('valence.theme', 'chartreuse');

    expect(chosenTheme()).toBe('dark');
  });

  it('keeps it on the device, so another machine is unaffected', () => {
    chooseTheme('light');
    installPlatform(aFakePlatform());

    expect(chosenTheme()).toBe('system');
  });
});

describe('readTheme', () => {
  it('takes a theme a control handed back', () => {
    expect(readTheme('light')).toBe('light');
  });

  it('reads anything it does not know as following the machine', () => {
    expect(readTheme('chartreuse')).toBe('system');
  });
});

describe('whenThemeChanges', () => {
  it('tells whoever is drawing a control for it', () => {
    const told: string[] = [];

    whenThemeChanges((theme) => told.push(theme));
    chooseTheme('dark');

    expect(told).toEqual(['dark']);
  });

  it('stops telling a listener that let go', () => {
    const told: string[] = [];

    whenThemeChanges((theme) => told.push(theme))();
    chooseTheme('dark');

    expect(told).toEqual([]);
  });
});
