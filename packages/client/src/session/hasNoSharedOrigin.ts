import { platformInUse } from '@FluxClient/platform/installPlatform';

/**
 * Says whether this client serves its own pages, and so shares no origin with the server.
 *
 * A browser is answered by the Flux that served it, and everything about a cookie works. A desktop
 * window is answered by whichever Flux somebody named, and nothing about a cookie does — which is
 * the whole premise of ADR-0026. Having been told where the server is, rather than deriving it from
 * the page, is exactly the condition that makes the difference.
 *
 * It is a question worth asking rather than answering everywhere: what a browser must not do is hold
 * a credential it does not need. It already has a better one.
 *
 * @returns Whether this client has an origin of its own.
 */
const hasNoSharedOrigin = (): boolean => platformInUse().whereTheServerIs() !== '';

export { hasNoSharedOrigin };
