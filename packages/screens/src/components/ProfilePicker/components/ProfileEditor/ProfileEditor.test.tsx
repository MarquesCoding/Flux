import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProfileEditor } from './ProfileEditor';
import type { ViewerProfile } from '@ValenceContracts/schemas/ViewerProfile';

const PROFILE: ViewerProfile = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Marques',
  colour: '#3a8ee8',
  avatar: { kind: 'initial' },
  askStillWatchingAfter: 4,
  showsWhatIamWatching: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

type FetchLike = (input: string, init?: RequestInit) => Promise<{ ok: boolean }>;

const fetchMock = vi.fn<FetchLike>();

const createObjectURL = vi.fn().mockReturnValue('blob:chosen');

Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL });
Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });

/**
 * What was sent, and where.
 */
const sentTo = (): { url: string; method: string } => {
  const call = fetchMock.mock.calls.at(-1);

  return { url: call?.[0] ?? '', method: call?.[1]?.method ?? '' };
};

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ ok: true });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ProfileEditor', () => {
  it('starts from what the profile already is', () => {
    render(<ProfileEditor profile={PROFILE} onSaved={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getByLabelText('Name')).toHaveValue('Marques');
  });

  it('starts empty for somebody who does not exist yet', () => {
    render(<ProfileEditor profile={null} onSaved={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getByLabelText('Name')).toHaveValue('');
  });

  it('shows every drawn face at once, since choosing a picture is done by looking', () => {
    render(<ProfileEditor profile={PROFILE} onSaved={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Use the bottts face' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Use the thumbs face' })).toBeInTheDocument();
  });

  it('saves a change to an existing profile', async () => {
    const actor = userEvent.setup();

    render(<ProfileEditor profile={PROFILE} onSaved={vi.fn()} onCancel={vi.fn()} />);

    await actor.clear(screen.getByLabelText('Name'));
    await actor.type(screen.getByLabelText('Name'), 'Sam');
    await actor.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(sentTo()).toEqual({ url: `/api/profiles/${PROFILE.id}`, method: 'PATCH' });
    });
  });

  it('adds somebody who did not exist', async () => {
    const actor = userEvent.setup();

    render(<ProfileEditor profile={null} onSaved={vi.fn()} onCancel={vi.fn()} />);

    await actor.type(screen.getByLabelText('Name'), 'Sam');
    await actor.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() => {
      expect(sentTo()).toEqual({ url: '/api/profiles', method: 'POST' });
    });
  });

  it('says when it has saved', async () => {
    const onSaved = vi.fn();
    const actor = userEvent.setup();

    render(<ProfileEditor profile={PROFILE} onSaved={onSaved} onCancel={vi.fn()} />);

    await actor.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledOnce();
    });
  });

  it('does not say it saved when it did not', async () => {
    fetchMock.mockResolvedValue({ ok: false });

    const onSaved = vi.fn();
    const actor = userEvent.setup();

    render(<ProfileEditor profile={PROFILE} onSaved={onSaved} onCancel={vi.fn()} />);

    await actor.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });

    expect(onSaved).not.toHaveBeenCalled();
  });

  it('will not save somebody with no name', async () => {
    const actor = userEvent.setup();

    render(<ProfileEditor profile={PROFILE} onSaved={vi.fn()} onCancel={vi.fn()} />);

    await actor.clear(screen.getByLabelText('Name'));

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('changes every drawn face at once when a different set is asked for', async () => {
    const actor = userEvent.setup();
    const { container } = render(
      <ProfileEditor profile={PROFILE} onSaved={vi.fn()} onCancel={vi.fn()} />,
    );

    const before = container.querySelector('img')?.getAttribute('src');

    await actor.click(screen.getByRole('button', { name: /Different faces/ }));

    expect(container.querySelector('img')?.getAttribute('src')).not.toBe(before);
  });

  it('shows a photograph before it is kept, since a picture is chosen by looking', async () => {
    const actor = userEvent.setup();
    const { container } = render(
      <ProfileEditor profile={PROFILE} onSaved={vi.fn()} onCancel={vi.fn()} />,
    );

    await actor.upload(
      screen.getByLabelText(/Upload a photograph/),
      new File(['picture'], 'me.webp', { type: 'image/webp' }),
    );

    expect(container.querySelector('img')?.getAttribute('src')).toBe('blob:chosen');
  });

  it('uploads a photograph after the profile it belongs to is saved', async () => {
    const actor = userEvent.setup();

    render(<ProfileEditor profile={PROFILE} onSaved={vi.fn()} onCancel={vi.fn()} />);

    await actor.upload(
      screen.getByLabelText(/Upload a photograph/),
      new File(['picture'], 'me.webp', { type: 'image/webp' }),
    );
    await actor.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(sentTo()).toEqual({ url: `/api/profiles/${PROFILE.id}/photo`, method: 'PUT' });
    });
  });

  it('does not offer a photograph for a profile that does not exist yet', () => {
    render(<ProfileEditor profile={null} onSaved={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.queryByLabelText(/Upload a photograph/)).not.toBeInTheDocument();
  });

  it('can be abandoned', async () => {
    const onCancel = vi.fn();
    const actor = userEvent.setup();

    render(<ProfileEditor profile={PROFILE} onSaved={vi.fn()} onCancel={onCancel} />);

    await actor.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('offers a way to say how many episodes may carry on before asking', () => {
    render(<ProfileEditor profile={PROFILE} onSaved={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Never ask' })).toBeInTheDocument();
  });

  it('starts on what the profile is already set to', () => {
    render(
      <ProfileEditor
        profile={{ ...PROFILE, askStillWatchingAfter: 0 }}
        onSaved={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Never ask' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('explains what the setting is for, since the name alone does not', () => {
    render(<ProfileEditor profile={PROFILE} onSaved={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getByText(/does not mark half a series as watched/)).toBeInTheDocument();
  });
});
