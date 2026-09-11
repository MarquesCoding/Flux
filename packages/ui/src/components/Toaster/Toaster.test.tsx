import { act, render, screen } from '@testing-library/react';
import { toast } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Toaster } from './Toaster';

beforeEach(() => {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
});

afterEach(() => {
  act(() => {
    toast.dismiss();
  });
  vi.unstubAllGlobals();
});

describe('Toaster', () => {
  it('shows a notice once one is raised', async () => {
    render(<Toaster />);

    act(() => {
      toast('Saved');
    });

    expect(await screen.findByText('Saved')).toBeInTheDocument();
  });

  it('draws each notice on the flat surface every floating panel shares', async () => {
    render(<Toaster />);

    act(() => {
      toast('Saved');
    });

    const notice = (await screen.findByText('Saved')).closest('[data-sonner-toast]');

    expect(notice?.className).toContain('valence-float');
    expect(notice?.className).not.toContain('valence-glass');
  });

  it('sets a display name so devtools can identify it', () => {
    expect(Toaster.displayName).toBe('Toaster');
  });
});
