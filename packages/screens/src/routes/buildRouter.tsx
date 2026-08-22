import {
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
} from '@tanstack/react-router';
import { readSearch } from '@ValenceClient/navigation/readSearch';
import { App } from '@ValenceScreens/components/App/App';
import { SignedIn } from '@ValenceScreens/components/SignedIn/SignedIn';
import { ValenceShell } from '@ValenceScreens/components/ValenceShell/ValenceShell';
import { HomePage } from '@ValenceScreens/components/HomePage/HomePage';
import { scrollKeyOf } from '@ValenceScreens/routes/scrollKeyOf';
import { PageProblem } from '@ValenceScreens/components/PageProblem/PageProblem';

const SharePage = lazyRouteComponent(
  async () => import('@ValenceScreens/components/SharePage/SharePage'),
  'SharePage',
);

const WatchPage = lazyRouteComponent(
  async () => import('@ValenceScreens/components/WatchPage/WatchPage'),
  'WatchPage',
);

const BrowsePage = lazyRouteComponent(
  async () => import('@ValenceScreens/components/BrowsePage/BrowsePage'),
  'BrowsePage',
);

const SearchPage = lazyRouteComponent(
  async () => import('@ValenceScreens/components/SearchPage/SearchPage'),
  'SearchPage',
);

const AccountPage = lazyRouteComponent(
  async () => import('@ValenceScreens/components/AccountPage/AccountPage'),
  'AccountPage',
);

const AdminPage = lazyRouteComponent(
  async () => import('@ValenceScreens/components/AdminPage/AdminPage'),
  'AdminPage',
);

const BooksPage = lazyRouteComponent(
  async () => import('@ValenceScreens/components/BooksPage/BooksPage'),
  'BooksPage',
);

const ReadPage = lazyRouteComponent(
  async () => import('@ValenceScreens/components/ReadPage/ReadPage'),
  'ReadPage',
);

const BROWSABLE = ['/shows', '/films', '/new', '/favourites'] as const;

/**
 * Builds the router: every address Valence serves, what it carries, and what is drawn there.
 *
 * Three layers, because three things have different lifetimes. The root decides whether this server
 * has been set up at all. Inside it, everything but a share link is behind the way in, and that
 * layer holds what the pages share — who is watching, what has been seen, the watch party. Inside
 * that again, the sections sit in the chrome, so moving between them changes the page and leaves the
 * dock, the dialogs and the player alone.
 *
 * Everything but the home page is loaded when it is first asked for, so an account that never opens
 * the admin page never downloads it. A page that throws draws its own apology rather than taking the
 * application with it, and the browser is left to put the scroll back where it was.
 *
 * @param title - What this instance is called.
 * @returns The router, ready to hand to a provider.
 */
const buildRouter = (title = 'Valence') => {
  const root = createRootRoute({ component: () => <App initialTitle={title} /> });

  const carries = { validateSearch: readSearch };

  const share = createRoute({
    getParentRoute: () => root,
    path: '/share/$token',
    component: () => <SharePage name={title} />,
    ...carries,
  });

  const signedIn = createRoute({
    getParentRoute: () => root,
    id: 'signed-in',
    component: () => <SignedIn title={title} />,
  });

  const watch = createRoute({
    getParentRoute: () => signedIn,
    path: '/watch/$mediaId',
    component: WatchPage,
    ...carries,
  });

  const read = createRoute({
    getParentRoute: () => signedIn,
    path: '/read/$bookId',
    component: ReadPage,
    ...carries,
  });

  const shell = createRoute({
    getParentRoute: () => signedIn,
    id: 'shell',
    component: ValenceShell,
  });

  const sections = [
    createRoute({ getParentRoute: () => shell, path: '/', component: HomePage, ...carries }),
    createRoute({
      getParentRoute: () => shell,
      path: '/search',
      component: SearchPage,
      ...carries,
    }),
    createRoute({
      getParentRoute: () => shell,
      path: '/account',
      component: AccountPage,
      ...carries,
    }),
    createRoute({ getParentRoute: () => shell, path: '/admin', component: AdminPage, ...carries }),
    createRoute({ getParentRoute: () => shell, path: '/read', component: BooksPage, ...carries }),
    ...BROWSABLE.map((path) =>
      createRoute({ getParentRoute: () => shell, path, component: BrowsePage, ...carries }),
    ),
    createRoute({ getParentRoute: () => shell, path: '/$', component: HomePage, ...carries }),
  ];

  return createRouter({
    routeTree: root.addChildren([
      share,
      signedIn.addChildren([watch, read, shell.addChildren(sections)]),
    ]),
    defaultErrorComponent: PageProblem,
    scrollRestoration: true,
    getScrollRestorationKey: scrollKeyOf,
  });
};

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof buildRouter>;
  }
}

export { buildRouter };
