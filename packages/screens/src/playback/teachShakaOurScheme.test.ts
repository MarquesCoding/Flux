import { describe, expect, it, vi } from 'vitest';
import { teachShakaOurScheme } from './teachShakaOurScheme';
import type { ShakaNetworking, ShakaSchemePlugin } from './teachShakaOurScheme';

const parse: ShakaSchemePlugin = () => {
  throw new Error('the plugin is registered with the engine, never called by us');
};

const networking = (): { net: ShakaNetworking; registerScheme: ReturnType<typeof vi.fn> } => {
  const registerScheme = vi.fn();

  return {
    registerScheme,
    net: { NetworkingEngine: { registerScheme }, HttpFetchPlugin: { parse } },
  };
};

describe('teachShakaOurScheme', () => {
  it('registers the engine own fetch plugin against the scheme the page came from', () => {
    const { net, registerScheme } = networking();

    teachShakaOurScheme(net, 'valence:');

    expect(registerScheme).toHaveBeenCalledWith('valence', parse, 2, true);
  });

  it('says the plugin reports progress, since the bitrate readout counts what it downloads', () => {
    const { net, registerScheme } = networking();

    teachShakaOurScheme(net, 'valence:');

    expect(registerScheme.mock.calls[0]?.[3]).toBe(true);
  });

  it('leaves http alone, which the engine already knows and a browser always uses', () => {
    const { net, registerScheme } = networking();

    teachShakaOurScheme(net, 'http:');

    expect(registerScheme).not.toHaveBeenCalled();
  });

  it('leaves https alone', () => {
    const { net, registerScheme } = networking();

    teachShakaOurScheme(net, 'https:');

    expect(registerScheme).not.toHaveBeenCalled();
  });

  it('registers nothing for a protocol that is not one, rather than a scheme with no name', () => {
    const { net, registerScheme } = networking();

    teachShakaOurScheme(net, '');
    teachShakaOurScheme(net, ':');
    teachShakaOurScheme(net, 'valence');

    expect(registerScheme).not.toHaveBeenCalled();
  });
});
