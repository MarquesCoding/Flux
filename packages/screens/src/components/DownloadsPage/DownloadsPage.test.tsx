import { screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderInAnAddress } from '@ValenceScreens/testing/renderInAnAddress';
import { DownloadsPage } from './DownloadsPage';

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

describe('DownloadsPage', () => {
  it('says what the page is', () => {
    renderInAnAddress(<DownloadsPage />);

    expect(screen.getByRole('heading', { name: 'Downloads' })).toBeInTheDocument();
  });

  it('says a kept file is the viewer’s, since that is the thing worth knowing about one', () => {
    renderInAnAddress(<DownloadsPage />);

    expect(screen.getByText(/yours until you delete it/)).toBeInTheDocument();
  });

  it('shows what has been asked for', async () => {
    renderInAnAddress(<DownloadsPage />);

    expect(await screen.findByText(/Nothing prepared yet/)).toBeInTheDocument();
  });

  it('sets a display name so devtools can identify it', () => {
    expect(DownloadsPage.displayName).toBe('DownloadsPage');
  });
});
