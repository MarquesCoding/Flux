import { Toaster as SonnerToaster } from 'sonner';
import type { ToasterProps } from './Toaster.types';

/**
 * Where everything the application has to say arrives. Mounted once, near the root; a second one
 * would show every message twice.
 *
 * Sonner is wrapped rather than reached for directly so that a toast is a Flux component like any
 * other: callers say what happened and this decides how it looks, which is what stops sixty screens
 * each inventing their own banner. It carries the product's own surface, border and radius rather
 * than the library's defaults.
 *
 * There is normally one, at the root. The exception is the player: it goes fullscreen, and a toast
 * portalled to the document is drawn behind a fullscreen video, which is to say not drawn. A named
 * toaster inside the player takes the messages addressed to it and nothing else.
 *
 * @param theme - Which way round to paint, following whatever the page is set to.
 * @param id - Which toaster this is, for messages addressed somewhere other than the page.
 * @returns Where toasts are drawn.
 */
const Toaster = ({ theme = 'system', id }: ToasterProps) => (
  <SonnerToaster
    {...(id === undefined ? {} : { id })}
    theme={theme}
    position="bottom-right"
    offset={24}
    mobileOffset={16}
    gap={10}
    visibleToasts={4}
    toastOptions={{
      duration: 5000,
      classNames: {
        toast: [
          'group !flux-glass !rounded-md !border !border-[var(--surface-line)]',
          '!bg-[var(--color-card)] !text-[var(--color-card-foreground)]',
          '!shadow-[var(--shadow-lifted)] !font-body',
        ].join(' '),
        title: '!text-sm !font-medium',
        description: '!text-xs !text-[var(--color-muted-foreground)]',
        actionButton:
          '!rounded-md !bg-[var(--color-primary)] !text-[var(--color-primary-foreground)] !text-xs !font-medium',
        cancelButton:
          '!rounded-md !bg-[var(--surface-hover)] !text-[var(--color-foreground)] !text-xs',
        closeButton:
          '!rounded-md !border-[var(--surface-line)] !bg-[var(--color-card)] !text-[var(--color-muted-foreground)]',
        error: '!text-[var(--color-destructive)]',
      },
    }}
  />
);

Toaster.displayName = 'Toaster';

export { Toaster };
