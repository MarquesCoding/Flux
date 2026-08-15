import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OptionMenu } from './OptionMenu';
import type { MenuGroup } from './OptionMenu.types';

const speed = (onSelect = vi.fn()): MenuGroup => ({
  name: 'Playback Speed',
  selectedId: '1',
  onSelect,
  options: [
    { id: '0.5', label: '0.5x' },
    { id: '1', label: '1x' },
    { id: '2', label: '2x' },
  ],
});

const open = async (groups: MenuGroup[]) => {
  const user = userEvent.setup();
  render(<OptionMenu label="Playback speed" trigger={<span>1x</span>} groups={groups} />);

  await user.click(screen.getByRole('button', { name: 'Playback speed' }));

  return user;
};

describe('OptionMenu', () => {
  it('keeps its choices out of the way until asked', () => {
    render(<OptionMenu label="Playback speed" trigger={<span>1x</span>} groups={[speed()]} />);

    expect(screen.queryByRole('menuitemradio', { name: /0.5x/ })).not.toBeInTheDocument();
  });

  it('offers every choice once opened', async () => {
    await open([speed()]);

    expect(await screen.findByRole('menuitemradio', { name: '0.5x' })).toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', { name: '2x' })).toBeInTheDocument();
  });

  it('marks the choice already in force', async () => {
    await open([speed()]);

    expect(await screen.findByRole('menuitemradio', { name: '1x' })).toBeChecked();
  });

  it('reports a choice by its id rather than its label', async () => {
    const onSelect = vi.fn();
    const user = await open([speed(onSelect)]);

    await user.click(await screen.findByRole('menuitemradio', { name: '2x' }));

    expect(onSelect).toHaveBeenCalledWith('2');
  });

  it('closes once a choice is made', async () => {
    const user = await open([speed()]);

    await user.click(await screen.findByRole('menuitemradio', { name: '2x' }));

    expect(screen.queryByRole('menuitemradio', { name: '2x' })).not.toBeInTheDocument();
  });

  it('offers two lists side by side when a decision has two parts', async () => {
    await open([
      {
        name: 'Audio',
        selectedId: 'ja',
        options: [{ id: 'ja', label: 'Japanese' }],
        onSelect: vi.fn(),
      },
      {
        name: 'Subtitles',
        selectedId: 'en',
        options: [
          { id: 'en', label: 'English' },
          { id: 'de', label: 'Deutsch' },
        ],
        onSelect: vi.fn(),
      },
    ]);

    expect(await screen.findByText('Audio')).toBeInTheDocument();
    expect(screen.getByText('Subtitles')).toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', { name: 'Japanese' })).toBeChecked();
    expect(screen.getByRole('menuitemradio', { name: 'Deutsch' })).not.toBeChecked();
  });

  it('shows the note attached to a choice', async () => {
    await open([
      {
        name: 'Subtitles',
        selectedId: 'en',
        options: [{ id: 'en', label: 'English', detail: 'forced' }],
        onSelect: vi.fn(),
      },
    ]);

    expect(await screen.findByText('forced')).toBeInTheDocument();
  });

  it('cannot be opened while disabled', () => {
    render(
      <OptionMenu label="Playback speed" trigger={<span>1x</span>} groups={[speed()]} isDisabled />,
    );

    expect(screen.getByRole('button', { name: 'Playback speed' })).toBeDisabled();
  });

  describe('in fullscreen', () => {
    /**
     * Says an element is fullscreen the way a browser reports it.
     *
     * jsdom implements neither `requestFullscreen` nor `fullscreenElement`,
     * so the property is set and the event dispatched by hand. That is what
     * the component actually reads: it never asks for fullscreen, it only
     * answers what the document says afterwards.
     */
    const goFullscreen = (element: Element | null) => {
      Object.defineProperty(document, 'fullscreenElement', {
        configurable: true,
        value: element,
        writable: true,
      });

      document.dispatchEvent(new Event('fullscreenchange'));
    };

    afterEach(() => {
      goFullscreen(null);
    });

    it('opens inside the element that is fullscreen, where it can be seen', async () => {
      const stage = document.createElement('div');

      document.body.append(stage);
      goFullscreen(stage);

      const user = userEvent.setup();

      render(<OptionMenu label="Playback speed" trigger={<span>1x</span>} groups={[speed()]} />, {
        container: stage.appendChild(document.createElement('div')),
      });

      await user.click(screen.getByRole('button', { name: 'Playback speed' }));

      const chosen = await screen.findByRole('menuitemradio', { name: '2x' });

      expect(stage.contains(chosen)).toBe(true);
    });

    it('opens in the body again once fullscreen is left, with no leftover', async () => {
      const stage = document.createElement('div');

      document.body.append(stage);
      goFullscreen(stage);
      goFullscreen(null);

      await open([speed()]);

      const chosen = await screen.findByRole('menuitemradio', { name: '2x' });

      expect(document.body.contains(chosen)).toBe(true);
      expect(stage.contains(chosen)).toBe(false);
    });
  });

  it('sets a display name so devtools can identify it', () => {
    expect(OptionMenu.displayName).toBe('OptionMenu');
  });
});
