import { screen, waitFor } from '@testing-library/react';
import { renderInAnAddress } from '@FluxScreens/testing/renderInAnAddress';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProfilePicker } from './ProfilePicker';
import type { ViewerProfile } from '@FluxContracts/schemas/ViewerProfile';

const profileOf = (name: string, at: number): ViewerProfile => ({
  id: `00000000-0000-4000-8000-${at.toString().padStart(12, '0')}`,
  name,
  colour: '#3a8ee8',
  avatar: { kind: 'initial' },
  askStillWatchingAfter: 4,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});

const HOUSEHOLD = ['Marques', 'Sam'].map(profileOf);

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ProfilePicker', () => {
  it('asks who is watching', () => {
    renderInAnAddress(
      <ProfilePicker profiles={HOUSEHOLD} onChoose={vi.fn()} onChanged={vi.fn()} />,
    );

    expect(screen.getByText('Who is watching?')).toBeInTheDocument();
  });

  it('shows everybody sharing the account', () => {
    renderInAnAddress(
      <ProfilePicker profiles={HOUSEHOLD} onChoose={vi.fn()} onChanged={vi.fn()} />,
    );

    expect(screen.getByRole('button', { name: /Marques/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sam/ })).toBeInTheDocument();
  });

  it('says who was chosen', async () => {
    const onChoose = vi.fn();
    const actor = userEvent.setup();

    renderInAnAddress(
      <ProfilePicker profiles={HOUSEHOLD} onChoose={onChoose} onChanged={vi.fn()} />,
    );

    await actor.click(screen.getByRole('button', { name: /Sam/ }));

    expect(onChoose).toHaveBeenCalledWith(HOUSEHOLD[1]);
  });

  it('offers no way to change the account on the way in', () => {
    renderInAnAddress(
      <ProfilePicker profiles={HOUSEHOLD} onChoose={vi.fn()} onChanged={vi.fn()} />,
    );

    expect(screen.queryByRole('button', { name: 'Edit Marques' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add' })).not.toBeInTheDocument();
  });

  it('offers to change the account when it was opened to do that', () => {
    renderInAnAddress(
      <ProfilePicker profiles={HOUSEHOLD} onChoose={vi.fn()} onChanged={vi.fn()} isEditable />,
    );

    expect(screen.getByRole('button', { name: 'Edit Marques' })).toBeInTheDocument();
  });

  it('opens the editor on somebody', async () => {
    const actor = userEvent.setup();

    renderInAnAddress(
      <ProfilePicker profiles={HOUSEHOLD} onChoose={vi.fn()} onChanged={vi.fn()} isEditable />,
    );

    await actor.click(screen.getByRole('button', { name: 'Edit Marques' }));

    expect(screen.getByLabelText('Name')).toHaveValue('Marques');
  });

  it('offers to add somebody', async () => {
    const actor = userEvent.setup();

    renderInAnAddress(
      <ProfilePicker profiles={HOUSEHOLD} onChoose={vi.fn()} onChanged={vi.fn()} isEditable />,
    );

    await actor.click(screen.getByRole('button', { name: /Add/ }));

    expect(screen.getByLabelText('Name')).toHaveValue('');
  });

  it('removes somebody, and says so', async () => {
    const onChanged = vi.fn();
    const actor = userEvent.setup();

    renderInAnAddress(
      <ProfilePicker profiles={HOUSEHOLD} onChoose={vi.fn()} onChanged={onChanged} isEditable />,
    );

    await actor.click(screen.getByRole('button', { name: 'Remove Sam' }));

    await waitFor(() => {
      expect(onChanged).toHaveBeenCalledOnce();
    });
  });

  it('will not remove the last profile, which would leave nowhere to record viewing', () => {
    renderInAnAddress(
      <ProfilePicker
        profiles={[HOUSEHOLD[0] ?? profileOf('Marques', 0)]}
        onChoose={vi.fn()}
        onChanged={vi.fn()}
        isEditable
      />,
    );

    expect(screen.queryByRole('button', { name: /Remove/ })).not.toBeInTheDocument();
  });

  it('stops offering to add once the household is full', () => {
    renderInAnAddress(
      <ProfilePicker
        profiles={['One', 'Two', 'Three', 'Four', 'Five', 'Six'].map(profileOf)}
        onChoose={vi.fn()}
        onChanged={vi.fn()}
        isEditable
      />,
    );

    expect(screen.queryByRole('button', { name: /^Add$/ })).not.toBeInTheDocument();
  });
});
