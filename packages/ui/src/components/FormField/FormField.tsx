import { cn } from '@ValenceUI/cn';
import type { FormFieldProps } from './FormField.types';

/**
 * One thing a form asks for: what it is, what answering it means, and the control that answers it,
 * stacked in that order. The same shape for every field in every dialog — a form whose rows each
 * arrange themselves reads as several forms in one panel, and the eye has to hunt for the next
 * question rather than running down a column to it.
 *
 * Stacked rather than set side by side, because a form inside a companion column has a third of the
 * room a dialog has, and a label beside its control is the first thing to break there.
 *
 * No box of its own. The control already carries an edge, and a card drawn around it is a box inside
 * a box — which reads as a group of things rather than as one question, and leaves a margin of dead
 * space wherever the control is smaller than the card.
 *
 * @param label - What is being asked for.
 * @param description - What answering it does, said in a line or two.
 * @param hint - Anything to say after the control, such as what happens to what was typed.
 * @param children - The control that answers it.
 * @param className - Extra classes for the caller's own layout.
 */
const FormField = ({ label, description, hint, children, className }: FormFieldProps) => (
  <div data-slot="form-field" className={cn('flex flex-col gap-2', className)}>
    <div className="flex flex-col gap-1">
      <h4 className="text-[0.9375rem] font-semibold leading-tight text-text">{label}</h4>

      {description === undefined ? null : (
        <span className="font-body text-[0.8125rem] leading-snug text-text-muted">
          {description}
        </span>
      )}
    </div>

    <div className="flex min-w-0 flex-col gap-2">{children}</div>

    {hint === undefined ? null : (
      <span className="font-body text-xs leading-snug text-text-muted">{hint}</span>
    )}
  </div>
);

FormField.displayName = 'FormField';

export { FormField };
