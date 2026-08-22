import { Icon } from '@FluxUI/Icon';
import { CaretDownIcon, CheckIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import * as RadixMenu from '@radix-ui/react-dropdown-menu';
import { Button } from '@FluxUI/Button';
import { cn } from '@FluxUI/cn';
import { POPUP_MOTION } from '@FluxUI/animations/motion';
import { usePortalContainer } from '@FluxUI/usePortalContainer';
import type { SectionBarProps } from './SectionBar.types';

const PILL = [
  'relative flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-md px-3.5 text-sm',
  'transition-colors duration-[var(--duration-fast)] ease-[var(--ease-soft)]',
].join(' ');

const MARK_MOTION = { type: 'spring', stiffness: 480, damping: 38 } as const;

/**
 * The bar across the top of an area — the admin pages, an account — where related sections are
 * grouped so a family of pages opens as one thing rather than as five siblings. Carries the same
 * travelling mark the dock uses.
 *
 * A family opens on a press rather than on a pointer resting over it. Opening on hover reads well
 * until it meets a click: the pointer opens the menu, the click that follows toggles it, and the
 * menu shuts on the very press meant to open it. Every other menu in Valence opens on a press, and one
 * that behaves like the rest is worth more than one that anticipates.
 *
 * @param groups - The sections, in groups.
 * @param value - Which section is showing.
 * @param onValueChange - Told which section was chosen.
 * @param label - What the bar is for, read out to anybody who cannot see it.
 * @param className - Extra classes for the caller's own layout.
 */
const SectionBar = ({ label, groups, value, onValueChange, className }: SectionBarProps) => {
  const portalContainer = usePortalContainer();

  const prefersReducedMotion = useReducedMotion();
  const [pointedAt, setPointedAt] = useState<string | null>(null);

  const [opened, setOpened] = useState<string | null>(null);

  /**
   * Names the group a pill belongs to, which is what the travelling mark moves between — a family
   * of sections is one destination as far as the mark is concerned, so moving within a family does
   * not send it sliding.
   *
   * @param groupIndex - Which group the pill sits in.
   * @param itemId - The pill itself, used where its group has no name.
   * @returns The name to treat the pill as, for the purposes of the mark.
   */
  const nameOf = (groupIndex: number, itemId: string): string =>
    groups[groupIndex]?.label ?? itemId;

  const here = groups.reduce<string | null>(
    (found, group, at) =>
      found ?? (group.items.some((item) => item.id === value) ? nameOf(at, value) : null),
    null,
  );

  const lit = pointedAt ?? opened ?? here;

  const mark = (
    <motion.span
      layoutId="section-bar-mark"
      transition={prefersReducedMotion === true ? { duration: 0 } : MARK_MOTION}
      className="absolute inset-0 -z-10 rounded-md bg-[var(--surface-active)]"
    />
  );

  return (
    <nav
      aria-label={label}
      onPointerLeave={() => {
        setPointedAt(null);
      }}
      onBlur={() => {
        setPointedAt(null);
      }}
      className={cn(
        'flux-rail flux-glass relative flex w-fit max-w-full items-center gap-1 overflow-x-auto rounded-lg p-1.5',
        className,
      )}
    >
      {groups.map((group, index) => {
        const holds = group.items.some((item) => item.id === value);
        const opens = group.label !== undefined && group.items.length > 1;
        const named = group.label ?? '';

        return (
          <div
            key={group.label ?? `group-${index.toString()}`}
            className="relative z-10 flex items-center gap-1"
          >
            {index === 0 ? null : (
              <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-[var(--surface-divider)]" />
            )}

            {opens && group.label !== undefined ? (
              <RadixMenu.Root
                modal={false}
                open={opened === named}
                onOpenChange={(isOpen) => {
                  setOpened((was) => (isOpen ? named : was === named ? null : was));
                }}
              >
                <RadixMenu.Trigger
                  onPointerEnter={() => {
                    setPointedAt(named);
                  }}
                  onFocus={() => {
                    setPointedAt(named);
                  }}
                  className={cn(
                    PILL,
                    lit === named || holds
                      ? 'font-medium text-text'
                      : 'text-text-muted hover:text-text focus-visible:text-text',
                  )}
                >
                  {lit === named ? mark : null}

                  {group.label}

                  <Icon of={CaretDownIcon} size={14} />
                </RadixMenu.Trigger>

                <RadixMenu.Portal
                  {...(portalContainer === undefined ? {} : { container: portalContainer })}
                >
                  <RadixMenu.Content
                    sideOffset={8}
                    align="start"
                    aria-label={group.label}
                    className={cn(
                      'flux-glass flex min-w-44 flex-col rounded-lg p-1.5 text-sm text-text',
                      POPUP_MOTION,
                    )}
                  >
                    <RadixMenu.Group className="flex flex-col">
                      <RadixMenu.Label className="px-3 py-1.5 text-xs uppercase tracking-[0.14em] text-text-muted">
                        {group.label}
                      </RadixMenu.Label>

                      <RadixMenu.RadioGroup
                        value={value}
                        onValueChange={(next) => {
                          onValueChange(String(next));
                        }}
                        className="flex flex-col"
                      >
                        {group.items.map((item) => (
                          <RadixMenu.RadioItem
                            key={item.id}
                            value={item.id}
                            className={cn(
                              'flex cursor-default items-center justify-between gap-4 rounded-sm px-3 py-2.5',
                              'outline-none transition-colors duration-[var(--duration-fast)]',
                              'data-[highlighted]:bg-[var(--surface-hover)]',
                            )}
                          >
                            {item.label}

                            <RadixMenu.ItemIndicator className="flex size-4 shrink-0 items-center justify-center text-accent">
                              <Icon of={CheckIcon} size={15} />
                            </RadixMenu.ItemIndicator>
                          </RadixMenu.RadioItem>
                        ))}
                      </RadixMenu.RadioGroup>
                    </RadixMenu.Group>
                  </RadixMenu.Content>
                </RadixMenu.Portal>
              </RadixMenu.Root>
            ) : (
              group.items.map((item) => (
                <Button
                  key={item.id}
                  variant="bare"
                  size="none"
                  isActive={item.id === value}
                  aria-current={item.id === value ? 'page' : undefined}
                  onPointerEnter={() => {
                    setPointedAt(nameOf(index, item.id));
                  }}
                  onFocus={() => {
                    setPointedAt(nameOf(index, item.id));
                  }}
                  onClick={() => {
                    onValueChange(item.id);
                  }}
                  className={cn(
                    PILL,
                    lit === nameOf(index, item.id) || item.id === value
                      ? 'font-medium text-text'
                      : 'text-text-muted hover:text-text focus-visible:text-text',
                  )}
                >
                  {lit === nameOf(index, item.id) ? mark : null}

                  {item.label}
                </Button>
              ))
            )}
          </div>
        );
      })}
    </nav>
  );
};

SectionBar.displayName = 'SectionBar';

export { SectionBar };
