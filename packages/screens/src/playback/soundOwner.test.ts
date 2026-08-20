import { afterEach, describe, expect, it, vi } from 'vitest';
import { claimSound, forgetSoundClaims } from './soundOwner';

afterEach(() => {
  forgetSoundClaims();
});

describe('claimSound', () => {
  it('gives the sound to the only clip asking for it', () => {
    const hero = vi.fn();

    claimSound(hero);

    expect(hero).toHaveBeenLastCalledWith(true);
  });

  it('hands it to whatever opened over the top', () => {
    const hero = vi.fn();
    const dialog = vi.fn();

    claimSound(hero);
    claimSound(dialog);

    expect(hero).toHaveBeenLastCalledWith(false);
    expect(dialog).toHaveBeenLastCalledWith(true);
  });

  it('hands it back when that goes away again', () => {
    const hero = vi.fn();
    const dialog = vi.fn();

    claimSound(hero);

    const close = claimSound(dialog);

    close();

    expect(hero).toHaveBeenLastCalledWith(true);
  });

  it('says nothing more to a clip that has already gone', () => {
    const hero = vi.fn();
    const leave = claimSound(hero);

    leave();

    const said = hero.mock.calls.length;
    const dialog = vi.fn();

    claimSound(dialog);

    expect(hero.mock.calls.length).toBe(said);
    expect(dialog).toHaveBeenLastCalledWith(true);
  });

  it('passes it down the stack rather than to the oldest claim', () => {
    const hero = vi.fn();
    const show = vi.fn();
    const detail = vi.fn();

    claimSound(hero);

    const closeShow = claimSound(show);

    claimSound(detail);
    closeShow();

    expect(detail).toHaveBeenLastCalledWith(true);
    expect(hero).toHaveBeenLastCalledWith(false);
  });

  it('is unbothered by a claim being given up twice', () => {
    const hero = vi.fn();
    const dialog = vi.fn();
    const leave = claimSound(hero);

    leave();
    leave();
    claimSound(dialog);

    expect(dialog).toHaveBeenLastCalledWith(true);
  });
});
