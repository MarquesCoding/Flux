import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DialogFooter } from './DialogFooter';

describe('DialogFooter', () => {
  it('holds the answers to the dialog', () => {
    render(
      <DialogFooter>
        <span>Cancel</span>
        <span>Save</span>
      </DialogFooter>,
    );

    expect(screen.getByRole('contentinfo')).toHaveTextContent('CancelSave');
  });

  it('gives every answer the same width, so none is suggested by being larger', () => {
    render(
      <DialogFooter>
        <span>Save</span>
      </DialogFooter>,
    );

    expect(screen.getByRole('contentinfo')).toHaveClass('[grid-auto-columns:1fr]', '[&>*]:w-full');
  });

  it('is the colour of the dialog, set off from its content by a hairline alone', () => {
    render(
      <DialogFooter>
        <span>Save</span>
      </DialogFooter>,
    );

    const foot = screen.getByRole('contentinfo');

    expect(foot).toHaveClass('border-t');
    expect(foot.className).not.toContain('bg-');
  });

  it('keeps the classes a caller gave it', () => {
    render(
      <DialogFooter className="justify-end">
        <span>Save</span>
      </DialogFooter>,
    );

    expect(screen.getByRole('contentinfo')).toHaveClass('justify-end');
  });

  it('sets a display name so devtools can identify it', () => {
    expect(DialogFooter.displayName).toBe('DialogFooter');
  });
});
