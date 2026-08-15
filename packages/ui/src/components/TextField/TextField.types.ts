import type { HTMLInputAutoCompleteAttribute, ReactNode } from 'react';

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
  min?: number;
  max?: number;
  isPill?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  isBare?: boolean;
  isLabelHidden?: boolean;
  icon?: ReactNode;
  hasFocusOnMount?: boolean;
  autoComplete?: HTMLInputAutoCompleteAttribute;
  className?: string;
};

export type { TextFieldProps };
