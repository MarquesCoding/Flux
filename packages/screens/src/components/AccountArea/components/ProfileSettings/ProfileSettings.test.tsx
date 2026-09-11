import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { chooseTheme, chosenTheme } from '@ValenceClient/shell/theme';
import { ProfileSettings } from './ProfileSettings';
import type { ViewerProfile } from '@ValenceContracts/schemas/ViewerProfile';
import type { ProfileDraft } from './ProfileSettings.types';

const PROFILE: ViewerProfile = {
  id: '00000000-0000-4000-8000-000000000002',
  name: 'Marques',
  colour: '#3a8ee8',
  avatar: { kind: 'initial' },
  askStillWatchingAfter: 4,
  showsWhatIamWatching: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const DRAFT: ProfileDraft = {
  name: PROFILE.name,
  colour: PROFILE.colour,
  avatar: PROFILE.avatar,
  askStillWatchingAfter: PROFILE.askStillWatchingAfter,
  showsWhatIamWatching: PROFILE.showsWhatIamWatching,
  photo: null,
};

beforeEach(() => {
  chooseTheme('system');
});

describe('ProfileSettings', () => {
  it('offers every theme there is, named the way the account menu names them', () => {
    render(<ProfileSettings profile={PROFILE} draft={DRAFT} onDraft={vi.fn()} />);

    const themes = screen.getByRole('group', { name: 'Theme' });

    for (const name of ['System', 'Light', 'Dark']) {
      expect(within(themes).getByRole('button', { name })).toBeInTheDocument();
    }
  });

  it('changes the theme at once, since how the screen looks is not part of the draft', async () => {
    const actor = userEvent.setup();
    const onDraft = vi.fn();

    render(<ProfileSettings profile={PROFILE} draft={DRAFT} onDraft={onDraft} />);

    await actor.click(
      within(screen.getByRole('group', { name: 'Theme' })).getByRole('button', { name: 'Dark' }),
    );

    expect(chosenTheme()).toBe('dark');
    expect(onDraft).not.toHaveBeenCalled();
  });

  it('writes a new name into the draft rather than saving it', async () => {
    const actor = userEvent.setup();
    const onDraft = vi.fn();

    render(<ProfileSettings profile={PROFILE} draft={DRAFT} onDraft={onDraft} />);

    await actor.type(screen.getByLabelText('Display name'), '!');

    expect(onDraft).toHaveBeenCalledWith(expect.objectContaining({ name: 'Marques!' }));
  });

  it('sets a display name so devtools can identify it', () => {
    expect(ProfileSettings.displayName).toBe('ProfileSettings');
  });
});
