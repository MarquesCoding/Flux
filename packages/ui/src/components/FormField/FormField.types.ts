import type { ReactNode } from 'react';

type FormFieldProps = {
  label: string;
  description?: string;
  hint?: string;
  children: ReactNode;
  className?: string;
};

export type { FormFieldProps };
