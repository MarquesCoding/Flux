import { render, screen } from '@testing-library/react';
import { FolderOpenIcon } from '@phosphor-icons/react';
import { describe, expect, it } from 'vitest';
import { NothingHere } from './NothingHere';

describe('NothingHere', () => {
  it('says what is missing as a heading, so a screen reader has somewhere to land', () => {
    render(<NothingHere of={FolderOpenIcon} title="No libraries yet" detail="Add one." />);

    expect(screen.getByRole('heading', { name: 'No libraries yet' })).toBeInTheDocument();
  });

  it('says why, rather than only that', () => {
    render(
      <NothingHere of={FolderOpenIcon} title="No libraries yet" detail="Point one at a folder." />,
    );

    expect(screen.getByText('Point one at a folder.')).toBeInTheDocument();
  });

  it('draws nothing to press where there is nothing to be done', () => {
    render(
      <NothingHere of={FolderOpenIcon} title="Nothing kept" detail="The heart puts it here." />,
    );

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('draws what it was given to press', () => {
    render(
      <NothingHere
        of={FolderOpenIcon}
        title="No libraries yet"
        detail="Add one."
        action={<button type="button">Add a library</button>}
      />,
    );

    expect(screen.getByRole('button', { name: 'Add a library' })).toBeInTheDocument();
  });

  it('takes the page only when asked to, since most of these sit under a heading', () => {
    const { container, rerender } = render(
      <NothingHere of={FolderOpenIcon} title="Nothing" detail="Nothing." />,
    );

    expect(container.firstElementChild?.className).toContain('py-24');

    rerender(<NothingHere of={FolderOpenIcon} title="Nothing" detail="Nothing." fills />);

    expect(container.firstElementChild?.className).toContain('min-h-[70vh]');
  });
});
