import type { ReactNode } from 'react';
import type { Icon as PhosphorIcon } from '@phosphor-icons/react';

type NothingHereProps = {
  of: PhosphorIcon;
  title: string;
  detail: string;
  action?: ReactNode;
  fills?: boolean;
};

export type { NothingHereProps };
