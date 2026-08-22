import { Toaster as SonnerToaster } from 'sonner';
import type { ToasterProps } from './Toaster.types';

/**
 * Where everything the application has to say arrives. Mounted once, near the root; a second one
 * would show every message twice.
 *
 * Sonner is wrapped rather than reached for directly so that a toast is a Valence component like any
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
 * @param position - Which corner they arrive in, since a toast over a film wants to be clear of the controls.
 * @returns Where toasts are drawn.
 */
const Toaster = ({ theme = 'system', id, position = 'bottom-right' }: ToasterProps) => (
  <SonnerToaster
    {...(id === undefined ? {} : { id })}
    theme={theme}
    position={position}
    offset={24}
    mobileOffset={16}
    gap={10}
    visibleToasts={4}
    toastOptions={{
      duration: 5000,
      classNames: {
        toast: [
          'group !valence-glass !rounded-xl !border !border-[var(--glass-edge)]',
          '!bg-[var(--glass-tint)] !text-text',
          '!shadow-[var(--glass-shadow)] !font-body',
        ].join(' '),
        title: '!text-sm !font-medium',
        description: '!text-xs !text-[var(--color-muted-foreground)]',
        actionButton:
          '!rounded-pill !bg-[var(--color-primary)] !text-[var(--color-primary-foreground)] !text-xs !font-medium',
        cancelButton:
          '!rounded-pill !bg-[var(--surface-hover)] !text-[var(--color-foreground)] !text-xs',
        closeButton:
          '!rounded-pill !border-[var(--glass-edge)] !bg-[var(--surface-hover)] !text-[var(--color-muted-foreground)]',
        error: '!text-[var(--color-destructive)]',
      },
    }}
  />
);

Toaster.displayName = 'Toaster';

export { Toaster };
