import { useSyncExternalStore } from 'react';
import { isPageCovered, watchPageCover } from '@ValenceUI/pageCover';

/**
 * Whether a dialog or anything else is standing over the page, for the parts of a screen that
 * should hold still while somebody is looking at something else.
 */
const useIsPageCovered = (): boolean =>
  useSyncExternalStore(watchPageCover, isPageCovered, () => false);

export { useIsPageCovered };
