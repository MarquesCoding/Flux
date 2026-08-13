import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CacheBreakdown } from './CacheBreakdown';

const CACHE = {
  previews: { count: 12, bytes: 3 * 1024 ** 3 },
  trickplay: { count: 12, bytes: 500 * 1024 ** 2 },
  sessions: { count: 1, bytes: 40 * 1024 ** 2 },
  atMs: Date.now(),
};

describe('CacheBreakdown', () => {
  it('shows what each kind of artefact costs', () => {
    render(
      <CacheBreakdown
        cache={CACHE}
        artwork={{ count: 40, bytes: 1024, atMs: Date.now() }}
        liveSessions={1}
      />,
    );

    expect(screen.getByText('Preview clips')).toBeInTheDocument();
    expect(screen.getByText('3.0 GB')).toBeInTheDocument();
    expect(screen.getByText('12 clips')).toBeInTheDocument();
  });

  it('adds the kinds up, across both services that measure them', () => {
    render(
      <CacheBreakdown
        cache={CACHE}
        artwork={{ count: 1, bytes: 20 * 1024 ** 2, atMs: Date.now() }}
        liveSessions={1}
      />,
    );

    expect(screen.getByText(/3.5 GB in total/)).toBeInTheDocument();
  });

  it('says when it counted, so a stale figure does not read as a live one', () => {
    render(<CacheBreakdown cache={CACHE} artwork={null} liveSessions={1} />);

    expect(screen.getByText(/counted just now/)).toBeInTheDocument();
  });

  it('says it is counting rather than showing an empty cache', () => {
    render(<CacheBreakdown cache={null} artwork={null} liveSessions={0} />);

    expect(screen.getByText('Counting what is on the disk.')).toBeInTheDocument();
    expect(screen.getAllByText('Still counting')).toHaveLength(4);
  });

  it('names every kind before any of them are known', () => {
    render(<CacheBreakdown cache={null} artwork={null} liveSessions={0} />);

    expect(screen.getByText('Artwork')).toBeInTheDocument();
    expect(screen.getByText('Transcode sessions')).toBeInTheDocument();
  });
});
