import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderInAnAddress } from '@ValenceScreens/testing/renderInAnAddress';
import { AdminDialog } from './AdminDialog';
import type { AdminOverview } from '@ValenceClient/admin/fetchAdmin';

vi.mock('@ValenceScreens/components/AdminArea/AdminArea', () => ({
  AdminArea: () => <p>The panels</p>,
}));

const OVERVIEW: AdminOverview = {
  users: [],
  settings: {
    hasCatalogueKey: false,
    trustedOrigins: ['http://localhost:5173'],
    cookieSecure: false,
    hardwareAccel: '',
  },
  transcoder: {
    isReachable: true,
    address: 'unix:/tmp/valence-transcoder.sock',
    ffmpegVersion: '9.0.1',
    ffmpegSupported: true,
    hardwareAccels: ['videotoolbox'],
    rejectedEncoders: [],
    concurrentRenders: 0,
    chains: [],
  },
  library: { itemCount: 15, libraryCount: 2, bytes: 0 },
  artwork: null,
  jobs: { stalled: [] },
};

const fetchMock = vi.fn();

/**
 * Draws the dialog open on a panel, with the server answering however the caller says.
 *
 * @param overview - What the server reports about itself.
 * @param panel - Which panel the address names.
 * @returns What the dialog was told.
 */
const draw = (overview: AdminOverview = OVERVIEW, panel: string | null = 'overview') => {
  fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve(overview) });

  const told = { onPanel: vi.fn(), onJob: vi.fn(), onClose: vi.fn() };

  renderInAnAddress(<AdminDialog panel={panel} job={null} {...told} />);

  return told;
};

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('AdminDialog', () => {
  it('is shut when the address names no panel', () => {
    draw(OVERVIEW, null);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('says what it is', async () => {
    draw();

    expect(await screen.findByRole('heading', { name: 'Server' })).toBeInTheDocument();
  });

  it('says whether the media service is up, since that is true of every panel', async () => {
    draw();

    expect(await screen.findByText(/Media service up/)).toBeInTheDocument();
  });

  it('says when the media service is not up, which is the thing worth knowing', async () => {
    draw({
      ...OVERVIEW,
      transcoder: { ...OVERVIEW.transcoder, isReachable: false, ffmpegVersion: null },
    });

    expect(await screen.findByText('Media service unreachable')).toBeInTheDocument();
  });

  it('marks a backend this machine cannot actually do', async () => {
    draw({ ...OVERVIEW, settings: { ...OVERVIEW.settings, hardwareAccel: 'nvenc' } });

    const shown = await screen.findAllByText('NVENC · forced');

    expect(shown.some((node) => node.className.includes('border-danger'))).toBe(true);
  });

  it('leaves a backend the machine verified unmarked', async () => {
    draw({ ...OVERVIEW, settings: { ...OVERVIEW.settings, hardwareAccel: 'videotoolbox' } });

    const shown = await screen.findAllByText('VideoToolbox · forced');

    expect(shown.some((node) => node.className.includes('border-danger'))).toBe(false);
  });

  it('offers every panel as a tab, with the one in the address chosen', async () => {
    draw(OVERVIEW, 'roles');

    expect(await screen.findByRole('tab', { name: 'Roles', selected: true })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Overview' })).toBeInTheDocument();
  });

  it('falls back to the overview where the address names a panel it does not have', async () => {
    draw(OVERVIEW, 'nonsense');

    expect(
      await screen.findByRole('tab', { name: 'Overview', selected: true }),
    ).toBeInTheDocument();
  });

  it('tells the address which panel was chosen rather than holding it itself', async () => {
    const actor = userEvent.setup();
    const told = draw();

    await actor.click(await screen.findByRole('tab', { name: 'Roles' }));

    await waitFor(() => {
      expect(told.onPanel).toHaveBeenCalledWith('roles');
    });
  });

  it('closes when the close button is pressed', async () => {
    const actor = userEvent.setup();
    const told = draw();

    await actor.click(await screen.findByRole('button', { name: 'Close' }));

    expect(told.onClose).toHaveBeenCalledOnce();
  });

  it('draws the panels beneath its head', async () => {
    draw();

    expect(await screen.findByText('The panels')).toBeInTheDocument();
  });

  it('sets a display name so devtools can identify it', () => {
    expect(AdminDialog.displayName).toBe('AdminDialog');
  });
});
