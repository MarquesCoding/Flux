import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { render, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useBrowsingPresence } from './useBrowsingPresence';
import type { ViewerProfile } from '@ValenceContracts/schemas/ViewerProfile';

const fetchProfiles = vi.fn<() => Promise<ViewerProfile[]>>();
const readCurrentProfile = vi.fn<() => string | null>();

vi.mock('@ValenceClient/profiles/fetchProfiles', () => ({
  fetchProfiles: () => fetchProfiles(),
}));

vi.mock('@ValenceClient/profiles/currentProfile', () => ({
  readCurrentProfile: () => readCurrentProfile(),
}));

const KindSchema = z.object({ kind: z.string() }).nullable().catch(null);

const seen: (string | null)[] = [];

const heard = (event: Event) => {
  const said = event instanceof CustomEvent ? KindSchema.parse(event.detail) : null;

  seen.push(said === null ? null : said.kind);
};

const aProfile = (showsWhatIamWatching: boolean): ViewerProfile => ({
  id: 'profile-1',
  name: 'Marques',
  colour: '#8b5ce8',
  avatar: { kind: 'initial' },
  askStillWatchingAfter: 3,
  showsWhatIamWatching,
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
});

const draw = () => {
  const Showing = () => {
    useBrowsingPresence();

    return null;
  };

  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <Showing />
    </QueryClientProvider>,
  );
};

beforeEach(() => {
  seen.length = 0;
  fetchProfiles.mockReset().mockResolvedValue([aProfile(true)]);
  readCurrentProfile.mockReset().mockReturnValue('profile-1');
  document.documentElement.dataset['valenceDesktop'] = 'true';
  document.addEventListener('flux:now-watching', heard);
});

afterEach(() => {
  document.removeEventListener('flux:now-watching', heard);
  delete document.documentElement.dataset['valenceDesktop'];
});

describe('useBrowsingPresence', () => {
  it('says somebody has Valence open, so a status stands between the things they watch', async () => {
    draw();

    await waitFor(() => {
      expect(seen).toContain('browsing');
    });
  });

  it('says nothing where the profile never asked to be shown', async () => {
    fetchProfiles.mockResolvedValue([aProfile(false)]);

    draw();

    await waitFor(() => {
      expect(seen.length).toBeGreaterThan(0);
    });

    expect(seen).not.toContain('browsing');
  });

  it('says nothing in a browser, which has no window to say it to', async () => {
    delete document.documentElement.dataset['valenceDesktop'];

    draw();

    await waitFor(() => {
      expect(seen.length).toBeGreaterThan(0);
    });

    expect(seen).not.toContain('browsing');
  });

  it('takes the status down on the way out, so a closed client is not left watching', async () => {
    const { unmount } = draw();

    await waitFor(() => {
      expect(seen).toContain('browsing');
    });

    unmount();

    expect(seen.at(-1)).toBeNull();
  });
});
