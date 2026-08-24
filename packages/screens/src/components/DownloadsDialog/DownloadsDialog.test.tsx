import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderInAnAddress } from '@ValenceScreens/testing/renderInAnAddress';
import { DownloadsDialog } from './DownloadsDialog';

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ downloads: [] }),
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('DownloadsDialog', () => {
  it('is shut when the address does not have it open', () => {
    renderInAnAddress(<DownloadsDialog isOpen={false} onClose={vi.fn()} />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('says what it is', () => {
    renderInAnAddress(<DownloadsDialog isOpen onClose={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'Downloads' })).toBeInTheDocument();
  });

  it('says a kept file is the viewer’s, since that is the thing worth knowing about one', () => {
    renderInAnAddress(<DownloadsDialog isOpen onClose={vi.fn()} />);

    expect(screen.getByText(/yours until you delete it/)).toBeInTheDocument();
  });

  it('shows what has been asked for', async () => {
    renderInAnAddress(<DownloadsDialog isOpen onClose={vi.fn()} />);

    expect(await screen.findByText(/Nothing prepared yet/)).toBeInTheDocument();
  });

  it('closes when the close button is pressed', async () => {
    const actor = userEvent.setup();
    const onClose = vi.fn();

    renderInAnAddress(<DownloadsDialog isOpen onClose={onClose} />);

    await actor.click(screen.getByRole('button', { name: 'Close' }));

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('sets a display name so devtools can identify it', () => {
    expect(DownloadsDialog.displayName).toBe('DownloadsDialog');
  });
});
