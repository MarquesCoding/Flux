import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FormField } from './FormField';

describe('FormField', () => {
  it('says what is being asked for', () => {
    render(
      <FormField label="Rank">
        <input aria-label="Rank" />
      </FormField>,
    );

    expect(screen.getByText('Rank')).toBeInTheDocument();
  });

  it('names the question as a heading, so a screen reader can walk a form by its questions', () => {
    render(
      <FormField label="Libraries">
        <input aria-label="Libraries" />
      </FormField>,
    );

    expect(screen.getByRole('heading', { name: 'Libraries' })).toBeInTheDocument();
  });

  it('explains what answering it does, where the label alone leaves something unsaid', () => {
    render(
      <FormField label="Shape" description="What Valence sends, so the other end understands it.">
        <input aria-label="Shape" />
      </FormField>,
    );

    expect(
      screen.getByText('What Valence sends, so the other end understands it.'),
    ).toBeInTheDocument();
  });

  it('says nothing beneath the control unless there is something to say', () => {
    const { rerender } = render(
      <FormField label="Address">
        <input aria-label="Address" />
      </FormField>,
    );

    expect(screen.queryByText('Valence cannot send email.')).not.toBeInTheDocument();

    rerender(
      <FormField label="Address" hint="Valence cannot send email.">
        <input aria-label="Address" />
      </FormField>,
    );

    expect(screen.getByText('Valence cannot send email.')).toBeInTheDocument();
  });

  it('holds the control that answers it', () => {
    render(
      <FormField label="Name">
        <input aria-label="Name" />
      </FormField>,
    );

    expect(screen.getByLabelText('Name')).toBeInTheDocument();
  });

  it('draws no box of its own, since the control already carries an edge', () => {
    const { container } = render(
      <FormField label="Kind">
        <input aria-label="Kind" />
      </FormField>,
    );

    const field = container.querySelector('[data-slot="form-field"]');

    expect(field?.className).not.toContain('valence-float');
    expect(field?.className).not.toContain('border');
  });

  it('sets a display name so devtools can identify it', () => {
    expect(FormField.displayName).toBe('FormField');
  });
});
