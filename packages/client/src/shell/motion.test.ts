import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { aFakePlatform } from '@ValenceClient/testing/aFakePlatform';
import { forgetPlatform, installPlatform } from '@ValenceClient/platform/installPlatform';
import { chooseMotion, chosenMotion, readMotion, whenMotionChanges } from './motion';

beforeEach(() => {
  installPlatform(aFakePlatform());
});

afterEach(() => {
  forgetPlatform();
});

describe('chosenMotion', () => {
  it('follows the machine until somebody says otherwise', () => {
    expect(chosenMotion()).toBe('system');
  });

  it('remembers a choice to be still', () => {
    chooseMotion('reduced');

    expect(chosenMotion()).toBe('reduced');
  });

  it('remembers a choice to move anyway, which is not the same as not choosing', () => {
    chooseMotion('full');

    expect(chosenMotion()).toBe('full');
  });

  it('forgets a choice rather than remembering the absence of one', () => {
    chooseMotion('reduced');
    chooseMotion('system');

    expect(chosenMotion()).toBe('system');
  });

  it('keeps it on the device, so another machine is unaffected', () => {
    chooseMotion('reduced');
    installPlatform(aFakePlatform());

    expect(chosenMotion()).toBe('system');
  });
});

describe('readMotion', () => {
  it('takes an answer a control handed back', () => {
    expect(readMotion('reduced')).toBe('reduced');
  });

  it('reads anything it does not know as following the machine', () => {
    expect(readMotion('slightly')).toBe('system');
  });
});

describe('whenMotionChanges', () => {
  it('tells whoever is drawing a control for it', () => {
    const told: string[] = [];

    whenMotionChanges((motion) => told.push(motion));
    chooseMotion('reduced');

    expect(told).toEqual(['reduced']);
  });

  it('stops telling a listener that let go', () => {
    const told: string[] = [];

    whenMotionChanges((motion) => told.push(motion))();
    chooseMotion('reduced');

    expect(told).toEqual([]);
  });
});
