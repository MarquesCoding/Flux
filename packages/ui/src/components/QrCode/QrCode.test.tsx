import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { QrCode } from './QrCode';

const OTP_URI = 'otpauth://totp/Valence:admin@valence.test?secret=JBSWY3DPEHPK3PXP&issuer=Valence';

describe('QrCode', () => {
  it('renders the value as an image with an accessible name', async () => {
    render(<QrCode value={OTP_URI} label="Two-factor setup code" />);

    expect(await screen.findByRole('img', { name: 'Two-factor setup code' })).toBeInTheDocument();
  });

  it('encodes the value as a data url', async () => {
    render(<QrCode value={OTP_URI} label="Two-factor setup code" />);

    await waitFor(() => {
      expect(screen.getByRole('img', { name: 'Two-factor setup code' })).toHaveAttribute(
        'src',
        expect.stringContaining('data:image/png;base64,'),
      );
    });
  });

  it('honours a requested size', async () => {
    render(<QrCode value={OTP_URI} label="Setup code" size={256} />);

    const image = await screen.findByRole('img', { name: 'Setup code' });

    expect(image).toHaveAttribute('width', '256');
  });

  it('sets a display name so devtools can identify it', () => {
    expect(QrCode.displayName).toBe('QrCode');
  });
});
