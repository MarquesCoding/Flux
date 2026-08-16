import clsx from 'clsx';
import type { ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merges class names and resolves conflicting Tailwind utilities, so that a class passed in by a
 * caller always beats the component's own default rather than depending on which happens to be
 * written first in the stylesheet.
 *
 * @param inputs - Class names, conditionals and arrays, in any of the forms clsx accepts.
 * @returns The merged class list.
 */
const cn = (...inputs: ClassValue[]): string => twMerge(clsx(inputs));

export { cn };
