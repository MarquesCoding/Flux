import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ScanProgressBar } from './ScanProgressBar';

describe('ScanProgressBar', () => {
  it('names the phase it is in', () => {
    render(<ScanProgressBar label="Scanning Movies" phase="probing" processed={4} total={10} />);

    expect(screen.getByText('Probing')).toBeInTheDocument();
    expect(
      screen.getByRole('progressbar', { name: 'Scanning Movies: Probing' }),
    ).toBeInTheDocument();
  });

  it('reports how far through the current phase it is', () => {
    render(<ScanProgressBar label="Scanning Movies" phase="probing" processed={4} total={10} />);

    const bar = screen.getByRole('progressbar', { name: 'Scanning Movies: Probing' });

    expect(bar).toHaveAttribute('aria-valuenow', '4');
    expect(bar).toHaveAttribute('aria-valuemax', '10');
    expect(screen.getByText('4/10')).toBeInTheDocument();
  });

  it('reads an unrecognised phase name as-is, rather than hiding it', () => {
    render(
      <ScanProgressBar label="Scanning Movies" phase="detecting" processed={null} total={null} />,
    );

    expect(screen.getByText('detecting')).toBeInTheDocument();
  });

  it('has no phase or numeric value before the scan has reported anything', () => {
    render(<ScanProgressBar label="Scanning Movies" phase={null} processed={null} total={null} />);

    const bar = screen.getByRole('progressbar', { name: 'Scanning Movies' });

    expect(bar).not.toHaveAttribute('aria-valuenow');
    expect(screen.queryByText(/\//)).not.toBeInTheDocument();
  });
});
