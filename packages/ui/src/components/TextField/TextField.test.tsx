import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TextField } from './TextField';

const Harness = ({ label = 'Email' }: { label?: string }) => {
  const [value, setValue] = useState('');

  return <TextField label={label} value={value} onValueChange={setValue} />;
};

describe('TextField', () => {
  it('associates its label with the input', () => {
    render(<TextField label="Email" value="" onValueChange={vi.fn()} />);

    expect(screen.getByLabelText('Email')).toBeInTheDocument();
  });

  it('reports each typed character', async () => {
    const onValueChange = vi.fn();
    const user = userEvent.setup();
    render(<TextField label="Email" value="" onValueChange={onValueChange} />);

    await user.type(screen.getByLabelText('Email'), 'a');

    expect(onValueChange).toHaveBeenCalledWith('a');
  });

  it('accumulates typed text when driven by state', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.type(screen.getByLabelText('Email'), 'flux');

    expect(screen.getByLabelText('Email')).toHaveValue('flux');
  });

  it('renders a description linked to the input', () => {
    render(
      <TextField
        label="Origin"
        value=""
        onValueChange={vi.fn()}
        description="The URL you reach this server on"
      />,
    );

    expect(screen.getByLabelText('Origin')).toHaveAccessibleDescription(
      'The URL you reach this server on',
    );
  });

  it('marks itself invalid and announces the error', () => {
    render(
      <TextField label="Email" value="nope" onValueChange={vi.fn()} error="Enter a valid email" />,
    );

    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a valid email');
  });

  it('says nothing about validity when there is no error', () => {
    render(<TextField label="Email" value="" onValueChange={vi.fn()} />);

    expect(screen.getByLabelText('Email')).not.toHaveAttribute('aria-invalid');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('masks a password field', () => {
    render(<TextField label="Password" value="" onValueChange={vi.fn()} type="password" />);

    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password');
  });

  it('bounds a number field to the range given', () => {
    render(
      <TextField label="Minutes" value="" onValueChange={vi.fn()} type="number" min={1} max={59} />,
    );

    const input = screen.getByLabelText('Minutes');

    expect(input).toHaveAttribute('type', 'number');
    expect(input).toHaveAttribute('min', '1');
    expect(input).toHaveAttribute('max', '59');
  });

  it('draws a time field against a dark surface', () => {
    render(<TextField label="Time" value="03:00" onValueChange={vi.fn()} type="time" />);

    const input = screen.getByLabelText('Time');

    expect(input).toHaveAttribute('type', 'time');
    expect(input.className).toContain('[color-scheme:dark]');
  });

  it('does not accept input when disabled', async () => {
    const onValueChange = vi.fn();
    const user = userEvent.setup();
    render(<TextField label="Email" value="" onValueChange={onValueChange} disabled />);

    await user.type(screen.getByLabelText('Email'), 'a');

    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('sets a display name so devtools can identify it', () => {
    expect(TextField.displayName).toBe('TextField');
  });

  describe('wearing no box', () => {
    it('keeps the label for a reader even when the page does not show it', () => {
      render(<TextField label="Search" value="" onValueChange={vi.fn()} isBare isLabelHidden />);

      expect(screen.getByLabelText('Search')).toBeInTheDocument();
      expect(screen.getByText('Search')).toHaveClass('sr-only');
    });

    it('drops the border and the fixed height it would otherwise have', () => {
      render(<TextField label="Search" value="" onValueChange={vi.fn()} isBare size="xl" />);

      const input = screen.getByLabelText('Search');

      expect(input).toHaveClass('bg-transparent');
      expect(input).not.toHaveClass('h-16');
    });

    it('still reports what was typed', async () => {
      const onValueChange = vi.fn();
      const user = userEvent.setup();
      render(<TextField label="Search" value="" onValueChange={onValueChange} isBare />);

      await user.type(screen.getByLabelText('Search'), 'a');

      expect(onValueChange).toHaveBeenCalledWith('a');
    });
  });

  it('announces itself as a search box when it is one', () => {
    render(<TextField label="Search" value="" onValueChange={vi.fn()} type="search" />);

    expect(screen.getByRole('searchbox', { name: 'Search' })).toBeInTheDocument();
  });

  it('takes focus on mount for a field that is the whole point of the page', () => {
    render(<TextField label="Search" value="" onValueChange={vi.fn()} hasFocusOnMount />);

    expect(screen.getByLabelText('Search')).toHaveFocus();
  });

  it('leaves focus alone otherwise', () => {
    render(<TextField label="Email" value="" onValueChange={vi.fn()} />);

    expect(screen.getByLabelText('Email')).not.toHaveFocus();
  });

  it('shows an icon beside the field without stealing its label', () => {
    render(
      <TextField
        label="Search"
        value=""
        onValueChange={vi.fn()}
        icon={<span data-testid="glass" aria-hidden />}
      />,
    );

    expect(screen.getByTestId('glass')).toBeInTheDocument();
    expect(screen.getByLabelText('Search')).toBeInTheDocument();
  });
});

describe('the sizes a field comes in', () => {
  const heightOf = (size: 'sm' | 'md' | 'lg' | 'xl') => {
    const { container } = render(
      <TextField label="Search" size={size} value="" onValueChange={vi.fn()} />,
    );

    return container.querySelector('input')?.className ?? '';
  };

  it('is the same height as a small button', () => {
    expect(heightOf('sm')).toContain('h-7');
  });

  it('is the same height as an ordinary button by default', () => {
    expect(heightOf('md')).toContain('h-9');
  });

  it('is the same height as a large button', () => {
    expect(heightOf('lg')).toContain('h-10');
  });

  it('is the same height as the largest button', () => {
    expect(heightOf('xl')).toContain('h-12');
  });

  it('rounds itself fully when asked to be a pill', () => {
    const { container } = render(
      <TextField label="Search" isPill value="" onValueChange={vi.fn()} />,
    );

    expect(container.querySelector('input')?.className).toContain('rounded-full');
  });

  it('carries no shape at all when it is bare, since something else owns that', () => {
    const { container } = render(
      <TextField label="Search" isBare value="" onValueChange={vi.fn()} />,
    );

    const className = container.querySelector('input')?.className ?? '';

    expect(className).not.toContain('rounded-full');
    expect(className).not.toContain('rounded-xl');
  });

  it('fills in what a browser should offer, when it was told', () => {
    const { container } = render(
      <TextField label="Email" autoComplete="email" value="" onValueChange={vi.fn()} />,
    );

    expect(container.querySelector('input')).toHaveAttribute('autocomplete', 'email');
  });
});
