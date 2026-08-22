import type shaka from 'shaka-player/dist/shaka-player.compiled';

type ShakaSchemePlugin = shaka.extern.SchemePlugin;

type ShakaNetworking = {
  NetworkingEngine: {
    registerScheme: (
      scheme: string,
      plugin: ShakaSchemePlugin,
      priority?: number,
      reportsProgress?: boolean,
    ) => void;
  };
  HttpFetchPlugin: { parse: ShakaSchemePlugin };
};

const ALREADY_KNOWN = new Set(['http:', 'https:', 'blob:', 'data:', 'file:']);

const AS_THE_ENGINE_REGISTERS_HTTP = { priority: 2, reportsProgress: true } as const;

/**
 * Teaches the media engine to fetch from the scheme the application itself was served from.
 *
 * The engine registers its fetch plugin against `http` and `https` and nothing else. An address in
 * any other scheme is not rejected as a bad address — the load simply never starts, which reaches
 * somebody watching as a film that would not play and says nothing about why.
 *
 * The server hands back a manifest address relative to the application, which is `http` in a browser
 * and the host's own scheme in the desktop client. So this is written as the page's own scheme
 * rather than as any particular one: a browser finds `http` already known and does nothing at all,
 * and a host that serves the application from a scheme of its own is understood without this having
 * to know which host that is. The plugin is the engine's own; only the name it answers to is new.
 *
 * @param net - The engine's networking, as its module exposes it.
 * @param protocol - The scheme the page was served from, colon and all.
 */
const teachShakaOurScheme = (net: ShakaNetworking, protocol: string): void => {
  if (!protocol.endsWith(':') || protocol.length < 2 || ALREADY_KNOWN.has(protocol)) {
    return;
  }

  net.NetworkingEngine.registerScheme(
    protocol.slice(0, -1),
    net.HttpFetchPlugin.parse,
    AS_THE_ENGINE_REGISTERS_HTTP.priority,
    AS_THE_ENGINE_REGISTERS_HTTP.reportsProgress,
  );
};

export type { ShakaNetworking, ShakaSchemePlugin };

export { ALREADY_KNOWN, AS_THE_ENGINE_REGISTERS_HTTP, teachShakaOurScheme };
