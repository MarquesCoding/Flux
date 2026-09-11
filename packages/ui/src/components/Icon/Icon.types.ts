// eslint-disable-next-line no-restricted-imports -- Icon is the one place the set's own types are named, so it stays swappable in one file
import type { IconSvgElement } from '@hugeicons/react';

type IconGlyph = IconSvgElement;

type IconProps = {
  of: IconGlyph;
  whenActive?: IconGlyph;
  isActive?: boolean;
  size?: number;
  className?: string;
  label?: string;
};

export type { IconGlyph, IconProps };
