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

  it('gives every answer the same width once there is room, so none is suggested by being larger', () => {
    render(
      <DialogFooter>
        <span>Save</span>
      </DialogFooter>,
    );

    expect(screen.getByRole('contentinfo')).toHaveClass(
      'sm:grid-flow-col',
      'sm:[grid-auto-columns:1fr]',
      '[&>*]:w-full',
    );
  });

  it('stacks them on a phone, where three answers across cannot fit and a button will not shrink', () => {
    render(
      <DialogFooter>
        <span>Save</span>
      </DialogFooter>,
    );

    const foot = screen.getByRole('contentinfo');

    expect(foot).toHaveClass('grid');
    expect(foot.className).not.toMatch(/(^|\s)grid-flow-col/);
    expect(foot.className).not.toMatch(/(^|\s)\[grid-auto-columns:1fr\]/);
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
