import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RequestFailed } from '@ValenceClient/query/RequestFailed';
import { FolderBrowser } from './FolderBrowser';
import type { FolderListing } from '@ValenceContracts/schemas/Folder';

const fetchFoldersMock = vi.hoisted(() => vi.fn());

vi.mock('@ValenceClient/admin/fetchFolders', () => ({ fetchFolders: fetchFoldersMock }));

const LISTINGS: Record<string, FolderListing> = {
  places: {
    path: null,
    parent: null,
    folders: [
      { name: '/', path: '/' },
      { name: '/media', path: '/media' },
    ],
    isTruncated: false,
  },
  '/media': {
    path: '/media',
    parent: '/',
    folders: [
      { name: 'films', path: '/media/films' },
      { name: 'shows', path: '/media/shows' },
    ],
    isTruncated: false,
  },
  '/media/films': { path: '/media/films', parent: '/media', folders: [], isTruncated: false },
  '/locked': { path: '/locked', parent: '/', folders: [], isTruncated: false },
};

beforeEach(() => {
  fetchFoldersMock.mockReset();
  fetchFoldersMock.mockImplementation((path: string | null) => {
    if (path === '/locked') {
      return Promise.reject(new RequestFailed('/api/admin/folders', 403));
    }

    const found = LISTINGS[path ?? 'places'];

    return found === undefined
      ? Promise.reject(new RequestFailed('/api/admin/folders', 404))
      : Promise.resolve(found);
  });
});

/**
 * Draws the browser with a cache of its own.
 *
 * @param start - What was typed before browsing.
 * @returns What it was told.
 */
const draw = (start = '') => {
  const onChoose = vi.fn();
  const onCancel = vi.fn();

  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <FolderBrowser start={start} onChoose={onChoose} onCancel={onCancel} />
    </QueryClientProvider>,
  );

  return { onChoose, onCancel };
};

describe('FolderBrowser', () => {
  it('opens on the places to start from when nothing was typed', async () => {
    draw();

    expect(await screen.findByRole('button', { name: '/media' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Use this folder' })).toBeDisabled();
  });

  it('opens on the folder already typed', async () => {
    draw('/media');

    expect(await screen.findByRole('button', { name: 'films' })).toBeInTheDocument();
  });

  it('falls back to the places to start from when the typed folder is not there', async () => {
    draw('/nowhere');

    expect(await screen.findByRole('button', { name: '/media' })).toBeInTheDocument();
  });

  it('opens a folder when it is pressed, and goes back up a level', async () => {
    const user = userEvent.setup();

    draw('/media');

    await user.click(await screen.findByRole('button', { name: 'films' }));

    expect(await screen.findByText('No folders in here.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Up a folder' }));

    expect(await screen.findByRole('button', { name: 'shows' })).toBeInTheDocument();
  });

  it('steps back along the trail to a folder on the way down', async () => {
    const user = userEvent.setup();

    draw('/media/films');

    await screen.findByText('No folders in here.');

    await user.click(screen.getByRole('button', { name: 'media' }));

    expect(await screen.findByRole('button', { name: 'films' })).toBeInTheDocument();
  });

  it('chooses the folder it is looking at', async () => {
    const user = userEvent.setup();
    const { onChoose } = draw('/media');

    await user.click(await screen.findByRole('button', { name: 'films' }));
    await screen.findByText('No folders in here.');
    await user.click(screen.getByRole('button', { name: 'Use this folder' }));

    expect(onChoose).toHaveBeenCalledWith('/media/films');
  });

  it('says so when it may not read a folder', async () => {
    draw('/locked');

    expect(
      await screen.findByText('Valence is not allowed to read that folder.'),
    ).toBeInTheDocument();
  });

  it('closes without choosing when cancelled', async () => {
    const user = userEvent.setup();
    const { onChoose, onCancel } = draw();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onCancel).toHaveBeenCalled();
    expect(onChoose).not.toHaveBeenCalled();
  });
});
