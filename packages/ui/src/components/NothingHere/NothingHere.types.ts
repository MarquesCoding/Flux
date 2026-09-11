import type { ReactNode } from 'react';
import type { IconGlyph } from '@ValenceUI/Icon.types';

type NothingHereProps = {
  of: IconGlyph;
  title: string;
  detail?: string;
  action?: ReactNode;
  fills?: boolean;
};

export type { NothingHereProps };
