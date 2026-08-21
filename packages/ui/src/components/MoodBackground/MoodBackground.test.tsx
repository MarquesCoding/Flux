import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MoodBackground } from './MoodBackground';
import type * as MotionReact from 'motion/react';

const motion = vi.hoisted(() => ({ isReduced: false }));

vi.mock('motion/react', async () => ({
  ...(await vi.importActual<typeof MotionReact>('motion/react')),
  useReducedMotion: () => motion.isReduced,
}));

/**
 * The lights themselves, one per colour the page was given.
 */
const blooms = (container: HTMLElement): HTMLElement[] =>
  Array.from(container.querySelectorAll('.flux-bloom')).filter(
    (found): found is HTMLElement => found instanceof HTMLElement,
  );

afterEach(() => {
  motion.isReduced = false;
});

describe('MoodBackground', () => {
  it('puts a light where the picture said it came from', () => {
    const { container } = render(
      <MoodBackground lights={[{ color: 'rgb(10, 20, 30)', at: '77% 12%' }]} />,
    );

    expect(blooms(container)[0]?.style.background).toContain('77% 12%');
  });

  it('lights the page from each colour it is given', () => {
    const { container } = render(
      <MoodBackground lights={[{ color: 'rgb(120, 40, 200)' }, { color: 'rgb(20, 160, 120)' }]} />,
    );

    expect(blooms(container)).toHaveLength(2);
    expect(blooms(container)[0]?.style.background).toContain('rgb(120, 40, 200)');
  });

  it('falls back to the house colour when nothing on screen has any light to give', () => {
    const { container } = render(<MoodBackground />);

    expect(blooms(container).length).toBeGreaterThan(0);
    expect(blooms(container)[0]?.style.background).toContain('rgb(56 68 150)');
  });

  it('ignores a colour that is not one', () => {
    const { container } = render(
      <MoodBackground lights={[{ color: '' }, { color: 'rgb(20, 160, 120)' }]} />,
    );

    expect(blooms(container)).toHaveLength(1);
  });

  it('draws no more lights than it has places to put them', () => {
    const { container } = render(
      <MoodBackground
        lights={[
          { color: '#111111' },
          { color: '#222222' },
          { color: '#333333' },
          { color: '#444444' },
          { color: '#555555' },
          { color: '#666666' },
        ]}
      />,
    );

    expect(blooms(container).length).toBeLessThanOrEqual(5);
  });

  it('keeps the page under the light, so the foot of the screen is the page', () => {
    const { container } = render(<MoodBackground lights={[{ color: '#112233' }]} />);

    expect(container.querySelector('.flux-mood-fade')).not.toBeNull();
  });

  it('lets the light wander where a screen is being waited on', () => {
    const { container } = render(<MoodBackground lights={[{ color: '#112233' }]} isDrifting />);

    expect(blooms(container)[0]?.className).toContain('flux-bloom--drift');
  });

  it('holds it still everywhere else', () => {
    const { container } = render(<MoodBackground lights={[{ color: '#112233' }]} />);

    expect(blooms(container)[0]?.className).not.toContain('flux-bloom--drift');
  });

  it('sets a display name so devtools can identify it', () => {
    expect(MoodBackground.displayName).toBe('MoodBackground');
  });

  it('stops the lights drifting for somebody who asked for less motion', () => {
    motion.isReduced = true;

    const { container } = render(<MoodBackground lights={[{ color: '#112233' }]} hasGrid />);

    expect(blooms(container)[0]?.className).not.toContain('flux-bloom--drift');
  });

  it('hands a film to the grid it already draws rather than laying a second one over it', () => {
    const { container } = render(<MoodBackground hasGrid film={() => undefined} />);

    expect(container.querySelectorAll('canvas')).toHaveLength(1);
  });

  it('brings the grid out for a film even where there was no grid before', () => {
    const { container } = render(<MoodBackground film={() => undefined} />);

    expect(container.querySelector('canvas')).toBeInTheDocument();
  });

  it('holds the film to the window rather than to the top of a page being scrolled', () => {
    const { container } = render(<MoodBackground film={() => undefined} />);

    expect(container.firstElementChild?.className).toContain('flux-below-the-bar');
  });

  it('stays where it was put when there is no film', () => {
    const { container } = render(<MoodBackground hasGrid />);

    expect(container.firstElementChild?.className).not.toContain('flux-below-the-bar');
  });
});
