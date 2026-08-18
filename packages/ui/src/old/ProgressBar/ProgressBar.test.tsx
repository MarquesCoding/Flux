import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ProgressBar } from './ProgressBar';

describe('ProgressBar', () => {
  it('is a progress bar to anything reading the page', () => {
    render(<ProgressBar label="Scanning Films" value={40} />);

    expect(screen.getByRole('progressbar', { name: 'Scanning Films' })).toBeInTheDocument();
  });

  it('says how far along it is', () => {
    render(<ProgressBar label="Scanning Films" value={40} />);

    expect(screen.getByRole('progressbar', { name: 'Scanning Films' })).toHaveAttribute(
      'aria-valuenow',
      '40',
    );
  });

  it('counts against what finishing means, not against a hundred', () => {
    render(<ProgressBar label="Scanning Films" value={3} max={12} />);

    const bar = screen.getByRole('progressbar', { name: 'Scanning Films' });

    expect(bar).toHaveAttribute('aria-valuenow', '3');
    expect(bar).toHaveAttribute('aria-valuemax', '12');
  });

  it('claims no progress at all when nothing has been counted yet', () => {
    render(<ProgressBar label="Scanning Films" value={null} />);

    expect(screen.getByRole('progressbar', { name: 'Scanning Films' })).not.toHaveAttribute(
      'aria-valuenow',
    );
  });

  it('paces rather than fills while it does not know', () => {
    const { container } = render(<ProgressBar label="Scanning Films" value={null} />);

    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('shows the stage before the bar', () => {
    render(
      <ProgressBar label="Scanning Films" value={40}>
        <span>Probing</span>
      </ProgressBar>,
    );

    expect(screen.getByText('Probing')).toBeInTheDocument();
  });

  it('shows the count after it, which a bar alone cannot give', () => {
    render(<ProgressBar label="Scanning Films" value={3} max={12} readout={<span>3/12</span>} />);

    expect(screen.getByText('3/12')).toBeInTheDocument();
  });

  it('sets a display name so devtools can identify it', () => {
    expect(ProgressBar.displayName).toBe('ProgressBar');
  });
});
