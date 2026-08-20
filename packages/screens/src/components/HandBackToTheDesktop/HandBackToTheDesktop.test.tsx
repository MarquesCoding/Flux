import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { handThisSessionToTheDesktop, sendThemBackToTheirDesktop } from '@FluxClient/session/auth';
import { HandBackToTheDesktop } from './HandBackToTheDesktop';

vi.mock('@FluxClient/session/auth', () => ({
  handThisSessionToTheDesktop: vi.fn(),
  sendThemBackToTheirDesktop: vi.fn(() => () => {}),
}));

const CARRIED = { client_id: 'electron', code_challenge: 'a-challenge', state: 'a-state' };

const asked = vi.mocked(handThisSessionToTheDesktop);

const followed = vi.mocked(sendThemBackToTheirDesktop);

beforeEach(() => {
  asked.mockReset();
  followed.mockClear();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('HandBackToTheDesktop', () => {
  it('offers the session that already exists, since there is no sign-in to hang a code on', async () => {
    asked.mockResolvedValue(true);

    render(<HandBackToTheDesktop carried={CARRIED} />);

    await waitFor(() => {
      expect(asked).toHaveBeenCalledWith(CARRIED);
    });
  });

  it('follows the code home once the server has minted one', async () => {
    asked.mockResolvedValue(true);

    render(<HandBackToTheDesktop carried={CARRIED} />);

    await waitFor(() => {
      expect(followed).toHaveBeenCalledOnce();
    });
  });

  it('says what is happening rather than flashing, since nobody opened this browser themselves', () => {
    asked.mockResolvedValue(true);

    render(<HandBackToTheDesktop carried={CARRIED} />);

    expect(screen.getByText('Taking you back to Flux…')).toBeInTheDocument();
  });

  it('says so where the server would not mint one, rather than waiting forever', async () => {
    asked.mockResolvedValue(false);

    render(<HandBackToTheDesktop carried={CARRIED} />);

    expect(await screen.findByText('That did not work')).toBeInTheDocument();
    expect(followed).not.toHaveBeenCalled();
  });

  it('stops watching when it goes, so a page left behind is not still polling', async () => {
    const stop = vi.fn();
    followed.mockReturnValue(stop);
    asked.mockResolvedValue(true);

    const { unmount } = render(<HandBackToTheDesktop carried={CARRIED} />);

    await waitFor(() => {
      expect(followed).toHaveBeenCalledOnce();
    });

    unmount();

    expect(stop).toHaveBeenCalledOnce();
  });
});
