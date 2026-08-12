import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MatchCorrection } from './MatchCorrection';

const correctMatchMock = vi.hoisted(() => vi.fn());

vi.mock('@FluxWeb/library/fetchLibrary', () => ({
  correctMatch: correctMatchMock,
}));

const MEDIA = '9c858901-8a57-4791-81fe-4c455b099bc9';

beforeEach(() => {
  correctMatchMock.mockReset();
  correctMatchMock.mockResolvedValue({ corrected: 10 });
});

describe('MatchCorrection', () => {
  it('will not send until something id-shaped has been pasted', () => {
    render(<MatchCorrection mediaId={MEDIA} isEpisode onCorrected={vi.fn()} />);

    expect(screen.getByRole('button', { name: /Read it again/ })).toBeDisabled();
  });

  it('takes an address, which is what people actually copy', async () => {
    const user = userEvent.setup();
    render(<MatchCorrection mediaId={MEDIA} isEpisode onCorrected={vi.fn()} />);

    await user.type(
      screen.getByLabelText('Catalogue address'),
      'https://www.themoviedb.org/tv/97546-ted-lasso',
    );
    await user.click(screen.getByRole('button', { name: /Read it again/ }));

    expect(correctMatchMock).toHaveBeenCalledWith(
      MEDIA,
      'https://www.themoviedb.org/tv/97546-ted-lasso',
      'tv',
    );
  });

  it('says which catalogue a bare number should be read from', async () => {
    const user = userEvent.setup();
    render(<MatchCorrection mediaId={MEDIA} isEpisode={false} onCorrected={vi.fn()} />);

    await user.type(screen.getByLabelText('Catalogue address'), '315162');
    await user.click(screen.getByRole('button', { name: /Read it again/ }));

    expect(correctMatchMock).toHaveBeenCalledWith(MEDIA, '315162', 'movie');
  });

  it('says a correction reaches the whole series, so nobody expects otherwise', () => {
    render(<MatchCorrection mediaId={MEDIA} isEpisode onCorrected={vi.fn()} />);

    expect(screen.getByText(/whole series is corrected/)).toBeInTheDocument();
  });

  it('says nothing about series for a film', () => {
    render(<MatchCorrection mediaId={MEDIA} isEpisode={false} onCorrected={vi.fn()} />);

    expect(screen.queryByText(/whole series/)).not.toBeInTheDocument();
  });

  it('tells the page to read itself again once the correction lands', async () => {
    const onCorrected = vi.fn();
    const user = userEvent.setup();
    render(<MatchCorrection mediaId={MEDIA} isEpisode onCorrected={onCorrected} />);

    await user.type(screen.getByLabelText('Catalogue address'), 'themoviedb.org/tv/230059');
    await user.click(screen.getByRole('button', { name: /Read it again/ }));

    await waitFor(() => {
      expect(onCorrected).toHaveBeenCalled();
    });
  });

  it('shows what went wrong rather than failing quietly', async () => {
    correctMatchMock.mockResolvedValue({ problem: 'The server could not be reached.' });

    const onCorrected = vi.fn();
    const user = userEvent.setup();
    render(<MatchCorrection mediaId={MEDIA} isEpisode onCorrected={onCorrected} />);

    await user.type(screen.getByLabelText('Catalogue address'), 'themoviedb.org/tv/230059');
    await user.click(screen.getByRole('button', { name: /Read it again/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent('could not be reached');
    expect(onCorrected).not.toHaveBeenCalled();
  });

  it('sets a display name so devtools can identify it', () => {
    expect(MatchCorrection.displayName).toBe('MatchCorrection');
  });
});
