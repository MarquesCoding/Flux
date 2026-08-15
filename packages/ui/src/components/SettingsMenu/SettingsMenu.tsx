import { useState } from 'react';
import { Popover } from '@base-ui/react/popover';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { RiArrowLeftSLine, RiArrowRightSLine, RiCheckLine } from '@remixicon/react';
import { Button } from '@FluxUI/Button';
import { HoverHighlight } from '@FluxUI/HoverHighlight';
import { Switch } from '@FluxUI/Switch';
import { useSlidingHighlight } from '@FluxUI/useSlidingHighlight';
import { cn } from '@FluxUI/cn';
import { Tooltip } from '@FluxUI/Tooltip';
import { usePortalContainer } from '@FluxUI/usePortalContainer';
import type {
  SettingsChoiceRow,
  SettingsMenuProps,
  SettingsPanelRow,
  SettingsRow,
} from './SettingsMenu.types';

const POPUP_MOTION = cn(
  'origin-[var(--transform-origin)] transition-[transform,opacity] duration-[var(--duration-base)] ease-[var(--ease-soft)]',
  'data-[starting-style]:scale-95 data-[starting-style]:opacity-0',
  'data-[ending-style]:scale-95 data-[ending-style]:opacity-0',
);

const ROW =
  'relative z-10 flex w-full items-center gap-4 rounded-[1.375rem] px-3 py-2.5 text-left text-sm';

const SLIDE = 28;

/**
 * What a row is currently set to.
 */
const answerOf = (row: SettingsRow): string | null => {
  if (row.kind === 'choice') {
    return row.choices.find((choice) => choice.id === row.selectedId)?.label ?? null;
  }

  return row.kind === 'toggle' ? null : (row.detail ?? null);
};

/**
 * Whether a row leads somewhere rather than doing something in place.
 */
const opensSomething = (row: SettingsRow): row is SettingsChoiceRow | SettingsPanelRow =>
  row.kind === 'choice' || row.kind === 'panel';

/**
 * Everything about what is playing, behind one control.
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
    <Popover.Root
      onOpenChange={(open) => {
        if (!open) {
          close();
        }

        setIsOpen(open);
        onOpenChange?.(open);
      }}
    >
      <Tooltip label={label}>
        <Popover.Trigger
          aria-label={label}
          disabled={isDisabled}
          className={cn(
            'inline-flex size-10 shrink-0 items-center justify-center rounded-full',
            'text-current transition-colors hover:bg-[var(--surface-hover)]',
            'data-[popup-open]:bg-[var(--surface-active)] disabled:cursor-not-allowed disabled:opacity-50',
            className,
          )}
        >
          {isOpen ? (triggerWhenOpen ?? trigger) : trigger}
        </Popover.Trigger>
      </Tooltip>

      <Popover.Portal container={portalContainer}>
        <Popover.Positioner
          side="top"
          sideOffset={12}
          align="end"
          collisionPadding={12}
          className="z-50"
        >
          <Popover.Popup
            aria-label={label}
            className={cn(
              'flux-glass flex w-80 flex-col overflow-hidden rounded-xl p-1.5 text-text',
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
                            <RiArrowRightSLine size={16} className="shrink-0" aria-hidden />
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
                        <RiArrowLeftSLine size={18} aria-hidden />
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
                                  <RiCheckLine size={16} aria-hidden />
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
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
};

SettingsMenu.displayName = 'SettingsMenu';

export { SettingsMenu };
