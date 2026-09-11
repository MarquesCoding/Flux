import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { HoverCard } from './HoverCard';

describe('HoverCard', () => {
  it('draws what it is about, and nothing more until a pointer rests on it', () => {
    render(<HoverCard detail="Encoded on the graphics card">VideoToolbox</HoverCard>);

    expect(screen.getByText('VideoToolbox')).toBeInTheDocument();
    expect(screen.queryByText('Encoded on the graphics card')).not.toBeInTheDocument();
  });

  it('says more once a pointer has rested on it', async () => {
    const user = userEvent.setup();

    render(<HoverCard detail="Encoded on the graphics card">VideoToolbox</HoverCard>);

    await user.hover(screen.getByText('VideoToolbox'));

    expect(
      await screen.findByText('Encoded on the graphics card', {}, { timeout: 3000 }),
    ).toBeInTheDocument();
  });

  it('stands on the flat surface every floating panel shares', async () => {
    const user = userEvent.setup();

    render(<HoverCard detail="Encoded on the graphics card">VideoToolbox</HoverCard>);

    await user.hover(screen.getByText('VideoToolbox'));

    const card = (
      await screen.findByText('Encoded on the graphics card', {}, { timeout: 3000 })
    ).closest('[data-slot="hover-card-content"]');

    expect(card).toHaveClass('valence-float');
    expect(card?.className).not.toContain('valence-glass');
  });

  it('sets a display name so devtools can identify it', () => {
    expect(HoverCard.displayName).toBe('HoverCard');
  });
});
