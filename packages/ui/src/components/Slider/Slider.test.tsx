import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Slider } from './Slider';
import type * as MotionReact from 'motion/react';

const motion = vi.hoisted(() => ({ isReduced: false }));

vi.mock('motion/react', async () => ({
  ...(await vi.importActual<typeof MotionReact>('motion/react')),
  useReducedMotion: () => motion.isReduced,
}));

const slider = (name = 'Seek') => screen.getByRole('slider', { name });

afterEach(() => {
  motion.isReduced = false;
});

describe('Slider', () => {
  it('reports where in the media it is', () => {
    render(<Slider label="Seek" value={30} max={120} onValueChange={vi.fn()} />);

    expect(slider()).toHaveAttribute('aria-valuenow', '30');
    expect(slider()).toHaveAttribute('max', '120');
  });

  it('seeks from the keyboard, so scrubbing does not need a pointer', async () => {
    const onSeek = vi.fn();
    const user = userEvent.setup();
    render(<Slider label="Seek" value={30} max={120} onValueChange={onSeek} />);

    slider().focus();
    await user.keyboard('{ArrowRight}');

    expect(onSeek).toHaveBeenCalledWith(31);
  });

  it('cannot be dragged before the duration is known', () => {
    render(<Slider label="Seek" value={0} max={0} onValueChange={vi.fn()} />);

    expect(slider()).toBeDisabled();
  });

  it('draws no preview until the bar is hovered', () => {
    render(
      <Slider
        label="Seek"
        value={30}
        max={120}
        onValueChange={vi.fn()}
        renderPreview={(value) => <span>preview at {value}</span>}
      />,
    );

    expect(screen.queryByText(/preview at/)).not.toBeInTheDocument();
  });

  it('stops drawing a preview once the pointer leaves', async () => {
    const user = userEvent.setup();
    render(
      <Slider
        label="Seek"
        value={30}
        max={120}
        onValueChange={vi.fn()}
        renderPreview={(value) => <span>preview at {value}</span>}
      />,
    );

    await user.unhover(slider());

    expect(screen.queryByText(/preview at/)).not.toBeInTheDocument();
  });

  it('is drawn for a page by default', () => {
    const { container } = render(
      <Slider label="Seek" value={30} max={120} onValueChange={vi.fn()} />,
    );

    expect(container.querySelector('[data-tone="default"]')).toBeInTheDocument();
  });

  it('can be drawn for sitting on top of video, where theme surfaces vanish', () => {
    const { container } = render(
      <Slider label="Seek" value={30} max={120} tone="overlay" onValueChange={vi.fn()} />,
    );

    expect(container.querySelector('[data-tone="overlay"]')).toBeInTheDocument();
  });
});

describe('the value a press on the track picks', () => {
  /**
   * Gives the track a width, which jsdom otherwise reports as nought.
   *
   * Where a press lands is arithmetic on the track's box, and a box of no
   * width maps every pointer to the same value.
   */
  const withTrackWidth = (width: number) => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      top: 0,
      bottom: 6,
      left: 0,
      right: width,
      width,
      height: 6,
      toJSON: () => ({}),
    });
  };

  /**
   * Presses the track at a point across it.
   *
   * jsdom implements none of the pointer capture the slider reaches for, so it
   * is stubbed rather than the press being sent somewhere it is not handled.
   */
  const press = (at: number) => {
    const control = slider().closest('[class*="touch-none"]');

    if (!(control instanceof HTMLElement)) {
      throw new Error('The slider has no control to press.');
    }

    control.setPointerCapture = () => undefined;
    control.releasePointerCapture = () => undefined;
    control.hasPointerCapture = () => false;

    fireEvent.pointerDown(control, { clientX: at, clientY: 3, buttons: 1, pointerId: 1 });
  };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const draw = (onValueChange: (value: number) => void) =>
    render(<Slider label="Seek" value={30} max={120} onValueChange={onValueChange} />);

  it('picks the beginning at the beginning of the track', () => {
    withTrackWidth(200);
    const onSeek = vi.fn();
    draw(onSeek);

    press(0);

    expect(onSeek).toHaveBeenCalledWith(0);
  });

  it('picks the middle at the middle of the track', () => {
    withTrackWidth(200);
    const onSeek = vi.fn();
    draw(onSeek);

    press(100);

    expect(onSeek).toHaveBeenCalledWith(60);
  });

  it('picks the end at the end of the track', () => {
    withTrackWidth(200);
    const onSeek = vi.fn();
    draw(onSeek);

    press(200);

    expect(onSeek).toHaveBeenCalledWith(120);
  });

  it('holds a press beyond the end to the end', () => {
    withTrackWidth(200);
    const onSeek = vi.fn();
    draw(onSeek);

    press(9000);

    expect(onSeek).toHaveBeenCalledWith(120);
  });
});

describe('the preview that follows the pointer', () => {
  /**
   * Gives the bar a width, which jsdom otherwise reports as nought.
   *
   * Everything the preview does is arithmetic on the bar's box, and a box of
   * no width is the one case the component refuses to guess from — so without
   * this there is nothing to test.
   */
  const withTrackWidth = (width: number, offsetWidth = 0) => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      top: 0,
      bottom: 0,
      left: 0,
      right: width,
      width,
      height: 6,
      toJSON: () => ({}),
    });

    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(offsetWidth);
  };

  const move = (at: number) => {
    const control = slider().closest('[class*="touch-none"]');

    if (!(control instanceof HTMLElement)) {
      throw new Error('The slider has no control to move a pointer across.');
    }

    fireEvent.pointerMove(control, { clientX: at });
  };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const draw = (max = 120) =>
    render(
      <Slider
        label="Seek"
        value={30}
        max={max}
        onValueChange={vi.fn()}
        renderPreview={(value) => <span>preview at {Math.round(value).toString()}</span>}
      />,
    );

  it('names the time under the pointer, not the time being played', () => {
    withTrackWidth(200);
    draw();

    move(100);

    expect(screen.getByText('preview at 60')).toBeInTheDocument();
  });

  it('reads the very start and the very end of the bar', () => {
    withTrackWidth(200);
    draw();

    move(0);

    expect(screen.getByText('preview at 0')).toBeInTheDocument();

    move(200);

    expect(screen.getByText('preview at 120')).toBeInTheDocument();
  });

  it('holds a pointer beyond either end to the ends of the bar', () => {
    withTrackWidth(200);
    draw();

    move(-500);

    expect(screen.getByText('preview at 0')).toBeInTheDocument();

    move(9000);

    expect(screen.getByText('preview at 120')).toBeInTheDocument();
  });

  it('keeps the preview from hanging off the near edge', () => {
    withTrackWidth(200, 80);
    draw();

    move(100);
    move(0);

    expect(screen.getByText('preview at 0').parentElement).toHaveStyle({ left: '40px' });
  });

  it('keeps the preview from hanging off the far edge', () => {
    withTrackWidth(200, 80);
    draw();

    move(100);
    move(200);

    expect(screen.getByText('preview at 120').parentElement).toHaveStyle({ left: '160px' });
  });

  it('draws nothing before the duration is known', () => {
    withTrackWidth(200);
    draw(0);

    move(100);

    expect(screen.queryByText(/preview at/)).not.toBeInTheDocument();
  });

  it('draws nothing while the bar has no width to measure against', () => {
    withTrackWidth(0);
    draw();

    move(100);

    expect(screen.queryByText(/preview at/)).not.toBeInTheDocument();
  });

  it('draws the preview without motion for somebody who asked for less', () => {
    motion.isReduced = true;

    render(<Slider label="Seek" value={30} max={120} onValueChange={vi.fn()} />);

    expect(slider()).toBeInTheDocument();
  });
});
