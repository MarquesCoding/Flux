import clsx from 'clsx'
import type { ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Merges class names, resolving conflicting Tailwind utilities so that a
 * caller-supplied class always wins over a component default.
 */
const cn = (...inputs: ClassValue[]): string => twMerge(clsx(inputs))

export { cn }
