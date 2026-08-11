import type { HTMLInputAutoCompleteAttribute, ReactNode } from 'react';

type TextFieldType = 'text' | 'email' | 'password' | 'url' | 'search';

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
  size?: 'md' | 'lg' | 'xl';
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
