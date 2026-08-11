import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FilePicker } from './FilePicker';

const fileOf = (name: string) => new File(['a picture'], name, { type: 'image/webp' });

/**
 * The control itself, found the way a screen reader would name it — by its
 * label rather than by a test identifier. Matched loosely because the label
 * also wraps whatever the caller drew inside it.
 */
const inputOf = (): HTMLElement => screen.getByLabelText(/Upload a photograph/);

describe('FilePicker', () => {
  it('names itself for anybody who cannot see the control', () => {
    render(
      <FilePicker label="Upload a photograph" accept="image/webp" onPick={vi.fn()}>
        <span>Choose</span>
      </FilePicker>,
    );

    expect(inputOf()).toBeInTheDocument();
  });

  it('shows whatever it was given to show, since the native control cannot be styled', () => {
    render(
      <FilePicker label="Upload a photograph" accept="image/webp" onPick={vi.fn()}>
        <span>Choose</span>
      </FilePicker>,
    );

    expect(screen.getByText('Choose')).toBeInTheDocument();
  });

  it('reports the file that was chosen', async () => {
    const onPick = vi.fn();
    const actor = userEvent.setup();

    render(
      <FilePicker label="Upload a photograph" accept="image/webp" onPick={onPick}>
        <span>Choose</span>
      </FilePicker>,
    );

    await actor.upload(inputOf(), fileOf('me.webp'));

    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ name: 'me.webp' }));
  });

  it('counts the same file twice, rather than ignoring the second attempt', async () => {
    const onPick = vi.fn();
    const actor = userEvent.setup();

    render(
      <FilePicker label="Upload a photograph" accept="image/webp" onPick={onPick}>
        <span>Choose</span>
      </FilePicker>,
    );

    await actor.upload(inputOf(), fileOf('me.webp'));
    await actor.upload(inputOf(), fileOf('me.webp'));

    expect(onPick).toHaveBeenCalledTimes(2);
  });

  it('says which files it will take', () => {
    render(
      <FilePicker label="Upload a photograph" accept="image/webp,video/webm" onPick={vi.fn()}>
        <span>Choose</span>
      </FilePicker>,
    );

    expect(inputOf()).toHaveAttribute('accept', 'image/webp,video/webm');
  });

  it('takes nothing while it is disabled', () => {
    render(
      <FilePicker label="Upload a photograph" accept="image/webp" onPick={vi.fn()} disabled>
        <span>Choose</span>
      </FilePicker>,
    );

    expect(inputOf()).toBeDisabled();
  });
});
