import { render, renderHook, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { shellContext } from '@FluxClient/shell/shellContext';
import { aShell } from '@FluxClient/testing/aShell';
import { useShell } from './useShell';
import type { ReactNode } from 'react';

describe('useShell', () => {
  it('hands a page what it shares with every other page', () => {
    const held = aShell({ title: 'Living Room' });

    const { result } = renderHook(() => useShell(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <shellContext.Provider value={held}>{children}</shellContext.Provider>
      ),
    });

    expect(result.current.title).toBe('Living Room');
    expect(result.current.user.name).toBe('Operator');
  });

  it('refuses to guess where there is no shell above it', () => {
    expect(() => render(<Loose />)).toThrow(/outside the application shell/);

    expect(screen.queryByText('never drawn')).not.toBeInTheDocument();
  });
});

/**
 * A page rendered where no shell is, which is a routing mistake rather than a state to render.
 */
const Loose = () => {
  useShell();

  return <p>never drawn</p>;
};

Loose.displayName = 'Loose';
