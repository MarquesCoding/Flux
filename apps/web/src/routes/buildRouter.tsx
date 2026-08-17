import { createRootRoute, createRoute, createRouter } from '@tanstack/react-router';
import { readSearch } from '@FluxWeb/navigation/readSearch';
import type { ReactNode } from 'react';

/**
 * Builds the router: the addresses Flux serves, what each of them carries, and what to draw at all
 * of them.
 *
 * Every address draws the same thing, because Flux is one screen with a player and a stack of
 * dialogs over it rather than a set of pages — moving between the films page and something playing
 * must not tear the player down and build it again. So the routes exist to say which addresses are
 * real and to read what they carry, and the shell reads where it is from the router rather than
 * from `window.location`.
 *
 * @param shell - What to draw, which is the whole application.
 * @returns The router, ready to hand to a provider.
 */
const buildRouter = (shell: () => ReactNode) => {
  const root = createRootRoute({ component: shell });

  const nothing = () => null;
  const carries = { validateSearch: readSearch };

  const routes = [
    createRoute({ getParentRoute: () => root, path: '/', component: nothing, ...carries }),
    createRoute({
      getParentRoute: () => root,
      path: '/watch/$mediaId',
      component: nothing,
      ...carries,
    }),
    createRoute({
      getParentRoute: () => root,
      path: '/share/$token',
      component: nothing,
      ...carries,
    }),
    createRoute({
      getParentRoute: () => root,
      path: '/media/$mediaId',
      component: nothing,
      ...carries,
    }),
    createRoute({ getParentRoute: () => root, path: '/$', component: nothing, ...carries }),
  ];

  return createRouter({ routeTree: root.addChildren(routes) });
};

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof buildRouter>;
  }
}

export { buildRouter };
