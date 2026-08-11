import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CaptionSettings } from './CaptionSettings';
import { DEFAULT_CAPTION_STYLE } from '@FluxWeb/playback/captionStyle';
import type { CaptionSettingsProps } from './CaptionSettings.types';

const draw = (overrides: Partial<CaptionSettingsProps> = {}) => {
  const props: CaptionSettingsProps = {
    style: DEFAULT_CAPTION_STYLE,
    onChange: vi.fn(),
    onReset: vi.fn(),
    ...overrides,
  };

  render(<CaptionSettings {...props} />);

  return props;
};

describe('CaptionSettings', () => {
  it('names itself so it can be found and dismissed', () => {
    draw();

    expect(screen.getByRole('region', { name: 'Caption settings' })).toBeInTheDocument();
  });

  it('shows a preview drawn the way the captions will be', () => {
    draw({ style: { ...DEFAULT_CAPTION_STYLE, color: '#ffff00', fontScale: 200 } });

    expect(screen.getByLabelText('Caption preview')).toHaveStyle({
      color: 'rgba(255, 255, 0, 1)',
      fontSize: '200%',
    });
  });

  it('reports a change of size', async () => {
    const user = userEvent.setup();
    const props = draw();

    screen.getByRole('slider', { name: 'Caption size' }).focus();
    await user.keyboard('{ArrowRight}');

    expect(props.onChange).toHaveBeenCalledWith(expect.objectContaining({ fontScale: 110 }));
  });

  it('never shrinks captions below what is readable', async () => {
    const user = userEvent.setup();
    const props = draw({ style: { ...DEFAULT_CAPTION_STYLE, fontScale: 50 } });

    screen.getByRole('slider', { name: 'Caption size' }).focus();
    await user.keyboard('{ArrowLeft}');

    expect(props.onChange).toHaveBeenCalledWith(expect.objectContaining({ fontScale: 50 }));
  });

  it('reports a change of background opacity as a fraction', async () => {
    const user = userEvent.setup();
    const props = draw({ style: { ...DEFAULT_CAPTION_STYLE, backgroundOpacity: 0.5 } });

    screen.getByRole('slider', { name: 'Caption background opacity' }).focus();
    await user.keyboard('{ArrowRight}');

    expect(props.onChange).toHaveBeenCalledWith(
      expect.objectContaining({ backgroundOpacity: 0.55 }),
    );
  });

  it('reports a change of font', async () => {
    const user = userEvent.setup();
    const props = draw();

    await user.click(screen.getByRole('button', { name: 'Monospace' }));

    expect(props.onChange).toHaveBeenCalledWith(expect.objectContaining({ fontFamily: 'mono' }));
  });

  it('reports a change of edge treatment', async () => {
    const user = userEvent.setup();
    const props = draw();

    await user.click(screen.getByRole('button', { name: 'Drop shadow' }));

    expect(props.onChange).toHaveBeenCalledWith(expect.objectContaining({ edgeStyle: 'shadow' }));
  });

  it('separates the text colour from the background colour', async () => {
    const user = userEvent.setup();
    const props = draw();

    // Two rows of the same colours, one for the lettering and one for what is
    // behind it. The second belongs to the background.
    const [text, background] = screen.getAllByRole('button', { name: 'Yellow' });

    expect(text).toBeInTheDocument();
    expect(background).toBeInTheDocument();

    await user.click(background ?? screen.getByText('Yellow'));

    expect(props.onChange).toHaveBeenCalledWith(
      expect.objectContaining({ backgroundColor: '#ffff00' }),
    );
  });

  it('puts everything back on request', async () => {
    const user = userEvent.setup();
    const props = draw();

    await user.click(screen.getByRole('button', { name: 'Reset to defaults' }));

    expect(props.onReset).toHaveBeenCalledTimes(1);
  });

  it('brings no way out of its own, since the panel around it has one', () => {
    draw();

    expect(
      screen.queryByRole('button', { name: 'Close caption settings' }),
    ).not.toBeInTheDocument();
  });

  it('sets a display name so devtools can identify it', () => {
    expect(CaptionSettings.displayName).toBe('CaptionSettings');
  });
});
