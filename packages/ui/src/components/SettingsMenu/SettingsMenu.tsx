import { Icon } from '@ValenceUI/Icon';
import { CaretLeftIcon, CaretRightIcon, CheckIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import * as RadixPopover from '@radix-ui/react-popover';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Button } from '@ValenceUI/Button';
import { HoverHighlight } from '@ValenceUI/HoverHighlight';
import { Switch } from '@ValenceUI/Switch';
import { useSlidingHighlight } from '@ValenceUI/useSlidingHighlight';
import { cn } from '@ValenceUI/cn';
import { POPUP_MOTION } from '@ValenceUI/animations/motion';
import { Tooltip } from '@ValenceUI/Tooltip';
import { usePortalContainer } from '@ValenceUI/usePortalContainer';
import type {
  SettingsChoiceRow,
  SettingsMenuProps,
  SettingsPanelRow,
  SettingsRow,
} from './SettingsMenu.types';

const ROW = 'relative z-10 flex w-full items-center gap-4 rounded-sm px-3 py-2.5 text-left text-sm';

const SLIDE = 28;

/**
 * Reads what a row is currently set to, for the answer shown at its right — the chosen label for a
 * row of choices, the detail for a row that leads somewhere, and nothing at all for a toggle, whose
 * switch already says it.
 *
 * @param row - The row being read.
 * @returns The answer to show, or null where the row shows its own state.
 */
const answerOf = (row: SettingsRow): string | null => {
  if (row.kind === 'choice') {
    return row.choices.find((choice) => choice.id === row.selectedId)?.label ?? null;
  }

  return row.kind === 'toggle' ? null : (row.detail ?? null);
};

/**
 * Decides whether a row leads somewhere — to a list of choices or a panel — rather than doing
 * something where it stands, which is what decides whether it gets an arrow.
 *
 * @param row - The row being asked about.
 * @returns Whether pressing it opens something further.
 */
const opensSomething = (row: SettingsRow): row is SettingsChoiceRow | SettingsPanelRow =>
  row.kind === 'choice' || row.kind === 'panel';

/**
 * Everything about what is playing, behind one control: audio tracks, subtitles, quality, speed,
 * captions. Rows lead to their own panels rather than expanding in place, so the menu stays one
 * column wide over a picture rather than growing across it.
 *
 * @param label - What the menu is, read out to anybody who cannot see it.
 * @param trigger - The control that opens it.
 * @param triggerWhenOpen - What that control becomes while the menu is open.
 * @param rows - The settings, each a choice, a toggle or a panel.
 * @param onOpenChange - Told when the menu opens or closes.
 * @param isDisabled - Whether it can be opened at all.
 * @param className - Extra classes for the caller's own layout.
 */
const SettingsMenu = ({
  label,
  trigger,
  triggerWhenOpen,
  rows,
  onOpenChange,
  isDisabled = false,
  className,
}: SettingsMenuProps) => {
  const portalContainer = usePortalContainer();

  const [openId, setOpenId] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  const { containerRef, rect, follow, clear } = useSlidingHighlight();

  const opened =
    rows.find(
      (row): row is SettingsChoiceRow | SettingsPanelRow =>
        opensSomething(row) && row.id === openId,
    ) ?? null;

  const travel = prefersReducedMotion === true ? 0 : SLIDE;

  const close = () => {
    setOpenId(null);
  };

  return (
    <RadixPopover.Root
      onOpenChange={(open) => {
        if (!open) {
          close();
        }

        setIsOpen(open);
        onOpenChange?.(open);
      }}
    >
      <Tooltip label={label}>
        <RadixPopover.Trigger
          aria-label={label}
          disabled={isDisabled}
          className={cn(
            'inline-flex size-10 shrink-0 items-center justify-center rounded-md outline-none',
            'text-current hover:bg-[var(--surface-hover)]',
            'transition-colors duration-[var(--duration-instant)] ease-[var(--ease-out)]',
            'motion-reduce:transition-none focus-visible:ring-[3px] focus-visible:ring-ring',
            'data-[state=open]:bg-[var(--surface-active)] disabled:cursor-not-allowed disabled:opacity-50',
            className,
          )}
        >
          {isOpen ? (triggerWhenOpen ?? trigger) : trigger}
        </RadixPopover.Trigger>
      </Tooltip>

      <RadixPopover.Portal
        {...(portalContainer === undefined ? {} : { container: portalContainer })}
      >
        <RadixPopover.Content
          aria-label={label}
          side="top"
          sideOffset={12}
          align="end"
          collisionPadding={12}
          data-slot="settings-menu"
          className={cn(
            'z-50 valence-glass valence-glass--popover flex w-80 flex-col overflow-hidden rounded-lg p-1.5 text-text outline-none',
            POPUP_MOTION,
          )}
        >
          <AnimatePresence initial={false} mode="wait">
            <motion.div
              key={opened?.id ?? 'root'}
              initial={{ opacity: 0, x: opened === null ? -travel : travel }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: opened === null ? travel : -travel }}
              transition={{ duration: prefersReducedMotion === true ? 0 : 0.18, ease: 'easeOut' }}
              ref={containerRef}
              onPointerMove={follow}
              onPointerLeave={clear}
              onFocusCapture={follow}
              onBlurCapture={clear}
              className="relative flex max-h-[66vh] flex-col overflow-y-auto"
            >
              <HoverHighlight rect={rect} radius="nested" className="bg-[var(--surface-hover)]" />

              {opened === null
                ? rows.map((row) => {
                    const answer = answerOf(row);

                    if (row.kind === 'toggle') {
                      return (
                        <Switch
                          key={row.id}
                          data-highlight={row.id}
                          label={row.label}
                          isOn={row.isOn}
                          onToggle={row.onToggle}
                          icon={row.icon}
                          tone="overlay"
                          className={cn(ROW, 'shrink-0 ')}
                        />
                      );
                    }

                    if (row.kind === 'custom') {
                      return (
                        <div
                          key={row.id}
                          data-highlight={row.id}
                          className={cn(ROW, 'shrink-0 cursor-default')}
                        >
                          <span className="shrink-0 text-text-muted">{row.icon}</span>

                          <span className="flex min-w-0 flex-1 flex-col">
                            <span className="truncate">{row.label}</span>
                            {answer === null ? null : (
                              <span className="truncate text-xs text-text-muted">{answer}</span>
                            )}
                          </span>

                          {row.control}
                        </div>
                      );
                    }

                    return (
                      <Button
                        key={row.id}
                        data-highlight={row.id}
                        variant="bare"
                        size="none"
                        onClick={() => {
                          if (row.kind === 'action') {
                            row.onSelect();

                            return;
                          }

                          setOpenId(row.id);
                        }}
                        className={cn(ROW, 'shrink-0 ')}
                      >
                        <span className="shrink-0 text-text-muted">{row.icon}</span>
                        <span className="shrink-0">{row.label}</span>

                        <span className="flex min-w-0 flex-1 items-center justify-end gap-1 text-text-muted">
                          <span className="truncate" title={answer ?? undefined}>
                            {answer}
                          </span>
                          <Icon of={CaretRightIcon} size={16} className="shrink-0" />
                        </span>
                      </Button>
                    );
                  })
                : [
                    <Button
                      key="back"
                      variant="bare"
                      size="none"
                      onClick={close}
                      className={cn(
                        ROW,
                        'shrink-0 border-b border-[var(--surface-line)] font-medium ',
                      )}
                    >
                      <Icon of={CaretLeftIcon} size={18} />
                      {opened.label}
                    </Button>,

                    ...(opened.kind === 'panel'
                      ? [
                          <div key="content" className="px-1 py-2">
                            {opened.content}
                          </div>,
                        ]
                      : opened.choices.map((choice) => (
                          <Button
                            key={choice.id}
                            data-highlight={choice.id}
                            variant="bare"
                            size="none"
                            role="menuitemradio"
                            aria-checked={choice.id === opened.selectedId}
                            onClick={() => {
                              opened.onSelect(choice.id);
                              close();
                            }}
                            className={cn(ROW, 'shrink-0 ')}
                          >
                            <span className="flex size-4 shrink-0 items-center justify-center">
                              {choice.id === opened.selectedId ? (
                                <Icon of={CheckIcon} size={16} />
                              ) : null}
                            </span>

                            <span className="flex min-w-0 flex-1 flex-col">
                              <span className="truncate">{choice.label}</span>
                              {choice.detail === undefined ? null : (
                                <span className="truncate text-xs text-text-muted">
                                  {choice.detail}
                                </span>
                              )}
                            </span>
                          </Button>
                        ))),
                  ]}
            </motion.div>
          </AnimatePresence>
        </RadixPopover.Content>
      </RadixPopover.Portal>
    </RadixPopover.Root>
  );
};

SettingsMenu.displayName = 'SettingsMenu';

export { SettingsMenu };
