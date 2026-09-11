import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TitleLogo } from './TitleLogo';

const { darkMock } = vi.hoisted(() => ({ darkMock: vi.fn(() => false) }));

vi.mock('@ValenceScreens/library/isDarkInk', () => ({ isDarkInk: darkMock }));

beforeEach(() => {
  darkMock.mockReset();
  darkMock.mockReturnValue(false);
});

describe('TitleLogo', () => {
  it('stays hidden until it has been looked at, so a black logo is never seen before it turns', () => {
    render(<TitleLogo src="/logo.png" alt="Arrival" />);

    expect(screen.getByRole('img', { name: 'Arrival' })).toHaveClass('opacity-0');
  });

  it('is drawn as it is once its lettering turns out to be light', () => {
    render(<TitleLogo src="/logo.png" alt="Arrival" />);

    const logo = screen.getByRole('img', { name: 'Arrival' });

    fireEvent.load(logo);

    expect(logo).toHaveClass('opacity-100');
    expect(logo).not.toHaveClass('invert');
  });

  it('is drawn in white where its lettering is dark, which vanishes over a picture', () => {
    darkMock.mockReturnValue(true);
    render(<TitleLogo src="/logo.png" alt="Arrival" />);

    const logo = screen.getByRole('img', { name: 'Arrival' });

    fireEvent.load(logo);

    expect(logo).toHaveClass('brightness-0', 'invert', 'opacity-100');
  });

  it('looks again at a new logo rather than keeping what it thought of the last', () => {
    darkMock.mockReturnValue(true);

    const { rerender } = render(<TitleLogo src="/one.png" alt="Arrival" />);

    fireEvent.load(screen.getByRole('img', { name: 'Arrival' }));

    rerender(<TitleLogo src="/two.png" alt="Arrival" />);

    expect(screen.getByRole('img', { name: 'Arrival' })).toHaveClass('opacity-0');
    expect(screen.getByRole('img', { name: 'Arrival' })).not.toHaveClass('invert');
  });

  it('says when it cannot be loaded, so the title can be set in type instead', () => {
    const onError = vi.fn();

    render(<TitleLogo src="/missing.png" alt="Arrival" onError={onError} />);

    fireEvent.error(screen.getByRole('img', { name: 'Arrival' }));

    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('keeps the size and place its caller gives it', () => {
    render(<TitleLogo src="/logo.png" alt="Arrival" className="max-h-[22svh]" />);

    expect(screen.getByRole('img', { name: 'Arrival' })).toHaveClass('max-h-[22svh]');
  });

  it('sets a display name so devtools can identify it', () => {
    expect(TitleLogo.displayName).toBe('TitleLogo');
  });
});
