import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { forgetPlatform } from '@ValenceClient/platform/installPlatform';
import { aFakeHeldFiles } from '@ValenceClient/testing/aFakeHeldFiles';
import { installATestClient } from '@ValenceScreens/testing/installATestClient';
import { fakeMediaElement } from '@ValenceScreens/testing/fakeMediaElement';
import type { HeldFile } from '@ValenceContracts/schemas/HeldFile';
import { OfflinePlayer } from './OfflinePlayer';

const aFile = (over: Partial<HeldFile> = {}): HeldFile => ({
  downloadId: '00000000-0000-4000-8000-000000000001',
  mediaId: '00000000-0000-4000-8000-000000000002',
  seriesId: null,
  seriesTitle: null,
  title: 'The Third Man',
  quality: 'original',
  durationSeconds: 5940,
  ofBytes: 1_073_741_824,
  state: 'here',
  bytes: 1_073_741_824,
  bytesPerSecond: null,
  failure: null,
  keptAt: '2026-08-22T00:00:00.000Z',
  hasPoster: false,
  ...over,
});

beforeEach(() => {
  installATestClient({ held: aFakeHeldFiles().held });
});

afterEach(() => {
  forgetPlatform();
});

describe('OfflinePlayer', () => {
  it('says what is playing', () => {
    render(<OfflinePlayer file={aFile()} onLeave={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'The Third Man' })).toBeInTheDocument();
  });

  it('names the programme an episode belongs to', () => {
    render(<OfflinePlayer file={aFile({ seriesTitle: 'The Bureau' })} onLeave={vi.fn()} />);

    expect(screen.getByText('The Bureau')).toBeInTheDocument();
  });

  it('plays the copy on this machine rather than asking a server for one', () => {
    render(<OfflinePlayer file={aFile()} onLeave={vi.fn()} />);

    expect(screen.getByLabelText('The Third Man')).toHaveAttribute(
      'src',
      '/held/00000000-0000-4000-8000-000000000001',
    );
  });

  it('goes back to the shelf', async () => {
    const onLeave = vi.fn();

    render(<OfflinePlayer file={aFile()} onLeave={onLeave} />);

    await userEvent.click(screen.getByRole('button', { name: 'Back to downloads' }));

    expect(onLeave).toHaveBeenCalled();
  });

  it('offers a scrubber across the length of the film', () => {
    render(<OfflinePlayer file={aFile()} onLeave={vi.fn()} />);

    expect(screen.getByRole('slider', { name: /Scrub through The Third Man/ })).toBeInTheDocument();
  });

  it('starts where somebody left off', () => {
    const { container } = render(
      <OfflinePlayer file={aFile()} startAtSeconds={600} onLeave={vi.fn()} />,
    );

    const element = container.querySelector('video');

    expect(element?.currentTime).toBe(600);
  });

  it('says where they got to, so it can be told to the server later', () => {
    const onProgress = vi.fn();

    render(<OfflinePlayer file={aFile()} onLeave={vi.fn()} onProgress={onProgress} />);

    const element = screen.getByLabelText('The Third Man');
    const playing = fakeMediaElement(element);

    playing.loaded({ duration: 5940 });
    playing.playTo(300);

    expect(onProgress).toHaveBeenCalled();
  });
});
