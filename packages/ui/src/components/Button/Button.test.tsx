import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button } from './Button';

describe('Button', () => {
  it('renders its children as an accessible button', () => {
    render(<Button>Play</Button>);

    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
  });

  it('defaults to type button so it never submits a form implicitly', () => {
    render(<Button>Play</Button>);

    expect(screen.getByRole('button', { name: 'Play' })).toHaveAttribute('type', 'button');
  });

  it('calls onClick when pressed', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<Button onClick={onClick}>Play</Button>);

    await user.click(screen.getByRole('button', { name: 'Play' }));

    expect(onClick).toHaveBeenCalledOnce();
  });

  it('does not call onClick when disabled', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(
      <Button disabled onClick={onClick}>
        Play
      </Button>,
    );

    await user.click(screen.getByRole('button', { name: 'Play' }));

    expect(onClick).not.toHaveBeenCalled();
  });

  it('marks itself busy and disabled while loading', () => {
    render(<Button isLoading>Play</Button>);

    const button = screen.getByRole('button', { name: /Play/ });

    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).toBeDisabled();
  });

  it('shows a spinner while loading', () => {
    render(<Button isLoading>Play</Button>);

    expect(screen.getByRole('status', { name: 'Working' })).toBeInTheDocument();
  });

  it('shows no spinner when not loading', () => {
    render(<Button>Play</Button>);

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('lets a caller class override a variant default', () => {
    render(<Button className="bg-danger">Play</Button>);

    expect(screen.getByRole('button', { name: 'Play' })).toHaveClass('bg-danger');
  });

  it('sets a display name so devtools can identify it', () => {
    expect(Button.displayName).toBe('Button');
  });

  it('offers a glossy treatment for the controls that matter most', () => {
    render(<Button variant="glossy">Play</Button>);

    expect(screen.getByRole('button', { name: 'Play' })).toHaveClass('flux-gloss');
  });

  it('rounds fully when asked for a pill', () => {
    render(<Button isPill>Play</Button>);

    expect(screen.getByRole('button', { name: 'Play' })).toHaveClass('rounded-full');
  });

  it('is a rounded box otherwise', () => {
    render(<Button>Save</Button>);

    expect(screen.getByRole('button', { name: 'Save' })).toHaveClass('rounded-lg');
  });

  it('offers a size for a hero control', () => {
    render(
      <Button size="xl" variant="glossy">
        Watch now
      </Button>,
    );

    expect(screen.getByRole('button', { name: 'Watch now' })).toHaveClass('h-14');
  });

  describe('wearing only an icon', () => {
    it('takes its accessible name from the label, since a glyph has none', () => {
      render(
        <Button isIconOnly label="Mute">
          <span aria-hidden>x</span>
        </Button>,
      );

      expect(screen.getByRole('button', { name: 'Mute' })).toBeInTheDocument();
    });

    it('becomes square rather than a box with words in it', () => {
      render(
        <Button isIconOnly size="md" label="Mute">
          <span aria-hidden>x</span>
        </Button>,
      );

      const button = screen.getByRole('button', { name: 'Mute' });

      expect(button).toHaveClass('size-10');
      expect(button).not.toHaveClass('px-4');
    });

    it('rounds fully without being asked, because a square icon reads as a disc', () => {
      render(
        <Button isIconOnly label="Mute">
          <span aria-hidden>x</span>
        </Button>,
      );

      expect(screen.getByRole('button', { name: 'Mute' })).toHaveClass('rounded-full');
    });

    it('still calls onClick', async () => {
      const onClick = vi.fn();
      const user = userEvent.setup();
      render(
        <Button isIconOnly label="Mute" onClick={onClick}>
          <span aria-hidden>x</span>
        </Button>,
      );

      await user.click(screen.getByRole('button', { name: 'Mute' }));

      expect(onClick).toHaveBeenCalledOnce();
    });

    it('still refuses to be pressed when disabled', async () => {
      const onClick = vi.fn();
      const user = userEvent.setup();
      render(
        <Button isIconOnly label="Mute" disabled onClick={onClick}>
          <span aria-hidden>x</span>
        </Button>,
      );

      await user.click(screen.getByRole('button', { name: 'Mute' }));

      expect(onClick).not.toHaveBeenCalled();
    });
  });

  describe('naming itself', () => {
    it('shows the label to whoever rests a pointer on it', async () => {
      const user = userEvent.setup();
      render(
        <Button isIconOnly label="Mute">
          <span aria-hidden>x</span>
        </Button>,
      );

      await user.hover(screen.getByRole('button', { name: 'Mute' }));

      expect(await screen.findByText('Mute')).toBeInTheDocument();
    });

    it('keeps quiet when the name is already written beside it', async () => {
      const user = userEvent.setup();
      render(
        <Button label="Mute" hasTooltip={false}>
          Mute
        </Button>,
      );

      await user.hover(screen.getByRole('button', { name: 'Mute' }));

      expect(screen.getAllByText('Mute')).toHaveLength(1);
    });
  });

  describe('saying what is in force', () => {
    it('says it is pressed rather than only looking it', () => {
      render(<Button isActive>Subtitles</Button>);

      expect(screen.getByRole('button', { name: 'Subtitles' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
    });

    it('claims nothing when it is not a toggle', () => {
      render(<Button>Subtitles</Button>);

      expect(screen.getByRole('button', { name: 'Subtitles' })).not.toHaveAttribute('aria-pressed');
    });
  });

  describe('named looks rather than classes at the call site', () => {
    it('offers a treatment for a control laid over artwork', () => {
      render(<Button variant="overlay">Close</Button>);

      const button = screen.getByRole('button', { name: 'Close' });

      expect(button).toHaveClass('bg-scrim');
      expect(button).toHaveClass('text-on-scrim');
    });

    it('paints an overlay control from tokens, so a theme can move it', () => {
      render(<Button variant="overlay">Close</Button>);

      expect(screen.getByRole('button', { name: 'Close' })).not.toHaveClass('bg-black/50');
    });

    it('offers a treatment for text that reads as a way somewhere', () => {
      render(<Button variant="link">A Sign of Affection</Button>);

      expect(screen.getByRole('button', { name: 'A Sign of Affection' })).toHaveClass(
        'underline-offset-4',
      );
    });
  });

  describe('painted by its caller', () => {
    it('imposes no layout on an episode row, a card or a menu row that draws its own', () => {
      render(
        <Button variant="bare" size="none" className="flex flex-col text-left">
          Season 2
        </Button>,
      );

      const button = screen.getByRole('button', { name: 'Season 2' });

      expect(button).not.toHaveClass('items-center');
      expect(button).not.toHaveClass('justify-center');
      expect(button).not.toHaveClass('shrink-0');
    });

    it('still centres a control that is not bare', () => {
      render(<Button>Play</Button>);

      const button = screen.getByRole('button', { name: 'Play' });

      expect(button).toHaveClass('items-center');
      expect(button).toHaveClass('justify-center');
    });

    it('keeps a box to lay its own contents out in', () => {
      render(<Button variant="bare" size="none" label="Use red" className="size-9" />);

      expect(screen.getByRole('button', { name: 'Use red' })).toHaveClass('inline-flex');
    });

    it('leaves corners to the caller too', () => {
      render(
        <Button variant="bare" size="none">
          Season 2
        </Button>,
      );

      expect(screen.getByRole('button', { name: 'Season 2' })).not.toHaveClass('rounded-lg');
    });

    it('brings no skin of its own when bare', () => {
      render(
        <Button variant="bare" size="none" className="text-left">
          Season 2
        </Button>,
      );

      const button = screen.getByRole('button', { name: 'Season 2' });

      expect(button).not.toHaveClass('bg-accent');
      expect(button).not.toHaveClass('h-10');
      expect(button).toHaveClass('text-left');
    });

    it('keeps the behaviour of a button while wearing none of its look', async () => {
      const onClick = vi.fn();
      const user = userEvent.setup();
      render(
        <Button variant="bare" size="none" onClick={onClick}>
          Season 2
        </Button>,
      );

      const button = screen.getByRole('button', { name: 'Season 2' });

      expect(button).toHaveAttribute('type', 'button');

      await user.click(button);

      expect(onClick).toHaveBeenCalledOnce();
    });

    it('can be its own content, for a control that is a coloured square', () => {
      render(<Button variant="bare" size="none" label="Use red" />);

      expect(screen.getByRole('button', { name: 'Use red' })).toBeEmptyDOMElement();
    });
  });
});
