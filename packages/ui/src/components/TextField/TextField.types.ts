import type { HTMLInputAutoCompleteAttribute, ReactNode } from 'react';

/**
 * `time` is a 24-hour `HH:MM` value, which the browser renders in whatever
 * clock the viewer's locale uses while still handing back `HH:MM`.
 */
type TextFieldType = 'text' | 'email' | 'password' | 'url' | 'search' | 'number' | 'time';

type TextFieldProps = {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  type?: TextFieldType;
  description?: string;
  error?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  /**
   * The smallest and largest value a `number` field accepts.
   *
   * Native browser hints — the spinner arrows stop at the bound and out of
   * range shows as invalid — rather than validation this component does
   * itself, which is still the caller's to do against the parsed value.
   */
  min?: number;
  max?: number;
  /**
   * Whether the field is drawn as a pill.
   *
   * Matches the buttons it sits above. A square field over a pill button reads
   * as two designs sharing a form.
   */
  isPill?: boolean;
  /**
   * How tall the field is.
   *
   * `lg` matches a large button, which is what a field on its own screen wants
   * to be next to.
   */
  /**
   * `sm` stands the field beside a button without towering over it, which is
   * what a field in a table's header or a toolbar has to do.
   */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /**
   * Whether the field paints nothing of its own.
   *
   * For a page that is one question — a search screen — where a bordered box
   * would be a box drawn around the only thing on the page. The label is still
   * there for anybody who cannot see that.
   */
  isBare?: boolean;
  /**
   * Whether the label is drawn, or kept for readers alone.
   */
  isLabelHidden?: boolean;
  /**
   * Something drawn inside the field, before the text.
   */
  icon?: ReactNode;
  hasFocusOnMount?: boolean;
  autoComplete?: HTMLInputAutoCompleteAttribute;
  className?: string;
};

export type { TextFieldProps, TextFieldType };
