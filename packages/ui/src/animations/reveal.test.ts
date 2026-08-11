import { describe, expect, it } from 'vitest';
import {
  revealVariants,
  revealTransition,
  riseVariants,
  fadeVariants,
  staggerVariants,
} from './reveal';

describe('revealVariants', () => {
  it('lifts content into place by default', () => {
    expect(revealVariants(false)).toBe(riseVariants);
  });

  it('fades rather than moves when movement is unwelcome', () => {
    expect(revealVariants(true)).toBe(fadeVariants);
  });

  it('treats an unknown preference as no preference', () => {
    expect(revealVariants(null)).toBe(riseVariants);
  });

  it('still transitions when movement is unwelcome, rather than snapping', () => {
    expect(fadeVariants.hidden).toMatchObject({ opacity: 0 });
    expect(fadeVariants.shown).toMatchObject({ opacity: 1 });
    expect(fadeVariants.hidden).not.toHaveProperty('y');
  });
});

describe('revealTransition', () => {
  it('moves on a spring, so motion carries weight', () => {
    expect(revealTransition(false)).toMatchObject({ type: 'spring' });
  });

  it('takes longer to settle the larger the thing moving is', () => {
    expect(revealTransition(false, 'heavy')).toMatchObject({
      type: 'spring',
      stiffness: 180,
    });
    expect(revealTransition(false, 'light')).toMatchObject({
      type: 'spring',
      stiffness: 320,
    });
  });

  it('drops the spring entirely when movement is unwelcome', () => {
    expect(revealTransition(true)).not.toHaveProperty('type', 'spring');
    expect(revealTransition(true, 'heavy')).not.toHaveProperty('type', 'spring');
  });
});

describe('staggerVariants', () => {
  it('brings children in one after another', () => {
    expect(staggerVariants.shown).toMatchObject({
      transition: { staggerChildren: 0.06 },
    });
  });

  it('takes them out in the order they came, reversed', () => {
    expect(staggerVariants.gone).toMatchObject({
      transition: { staggerDirection: -1 },
    });
  });
});
