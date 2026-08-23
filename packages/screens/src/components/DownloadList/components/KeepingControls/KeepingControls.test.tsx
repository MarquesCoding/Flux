import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { forgetPlatform } from '@ValenceClient/platform/installPlatform';
import { aFakeHeldFiles } from '@ValenceClient/testing/aFakeHeldFiles';
import type { FakeHeldFiles } from '@ValenceClient/testing/aFakeHeldFiles';
import { installATestClient } from '@ValenceScreens/testing/installATestClient';
import type { Download } from '@ValenceContracts/schemas/Download';
import type { HeldFile } from '@ValenceContracts/schemas/HeldFile';
import { KeepingControls } from './KeepingControls';

const prepared: Download = {
  id: '00000000-0000-4000-8000-000000000001',
  mediaId: '00000000-0000-4000-8000-000000000002',
  seriesId: null,
  seriesTitle: null,
  title: 'The Third Man',
  quality: 'original',
  audioLanguages: [],
  state: 'ready',
  progress: 1,
  bytesPerSecond: null,
  sizeBytes: 1_073_741_824,
  failure: null,
  askedAt: '2026-08-22T00:00:00.000Z',
  readyAt: '2026-08-22T00:10:00.000Z',
};

const aFile = (over: Partial<HeldFile> = {}): HeldFile => ({
  downloadId: prepared.id,
  mediaId: prepared.mediaId,
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

let files: FakeHeldFiles;

beforeEach(() => {
  files = aFakeHeldFiles();
  installATestClient({ held: files.held });
});

afterEach(() => {
  forgetPlatform();
});

describe('KeepingControls', () => {
  it('offers to keep something the device does not have', () => {
    render(<KeepingControls download={prepared} held={null} />);

    expect(screen.getByRole('button', { name: 'Keep on this device' })).toBeInTheDocument();
  });

  it('asks the device to hold it', async () => {
    render(<KeepingControls download={prepared} held={null} />);

    await userEvent.click(screen.getByRole('button', { name: 'Keep on this device' }));

    await waitFor(() => {
      expect(files.asked[0]?.downloadId).toBe(prepared.id);
    });
  });

  it('says when it is already here', () => {
    render(<KeepingControls download={prepared} held={aFile()} />);

    expect(screen.getByText('On this device')).toBeInTheDocument();
  });

  it('lets go of the copy here without touching the server’s', async () => {
    render(<KeepingControls download={prepared} held={aFile()} />);

    await userEvent.click(screen.getByRole('button', { name: /Remove The Third Man/ }));

    await waitFor(() => {
      expect(files.dropped).toEqual([prepared.id]);
    });
  });

  it('shows a transfer as it moves', () => {
    render(<KeepingControls download={prepared} held={aFile({ state: 'fetching', bytes: 10 })} />);

    expect(screen.getByRole('button', { name: /Stop fetching/ })).toBeInTheDocument();
  });

  it('carries on with a stopped one', async () => {
    render(<KeepingControls download={prepared} held={aFile({ state: 'paused', bytes: 10 })} />);

    await userEvent.click(screen.getByRole('button', { name: /Carry on fetching/ }));

    await waitFor(() => {
      expect(files.paused).toEqual([[prepared.id, false]]);
    });
  });

  it('offers another go at one that failed', async () => {
    render(
      <KeepingControls
        download={prepared}
        held={aFile({ state: 'failed', failure: 'The disk is full.' })}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));

    await waitFor(() => {
      expect(files.paused).toEqual([[prepared.id, false]]);
    });
  });
});
