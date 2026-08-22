import { describe, expect, it } from 'vitest';
import { PluginManifestSchema } from './PluginManifest';

const validManifest = {
  id: 'tmdb-metadata',
  name: 'TMDB Metadata',
  version: '1.2.0',
  apiVersion: '^1.0.0',
  author: 'Valence Community',
  description: 'Fetches film and series metadata from TMDB.',
  extensionPoints: ['MetadataProvider'],
  capabilities: [
    { kind: 'network', domains: ['api.themoviedb.org'] },
    { kind: 'library', access: 'read' },
  ],
  entry: 'dist/plugin.js',
};

describe('PluginManifestSchema', () => {
  it('accepts a complete manifest', () => {
    const result = PluginManifestSchema.parse(validManifest);

    expect(result.id).toBe('tmdb-metadata');
    expect(result.capabilities).toHaveLength(2);
  });

  it('accepts a manifest declaring no capabilities', () => {
    const result = PluginManifestSchema.parse({ ...validManifest, capabilities: [] });

    expect(result.capabilities).toHaveLength(0);
  });

  it('rejects a plugin id that is not kebab-case', () => {
    expect(() => PluginManifestSchema.parse({ ...validManifest, id: 'TMDB_Metadata' })).toThrow();
  });

  it('rejects a network capability with no domains', () => {
    expect(() =>
      PluginManifestSchema.parse({
        ...validManifest,
        capabilities: [{ kind: 'network', domains: [] }],
      }),
    ).toThrow();
  });

  it('rejects an unknown capability kind', () => {
    expect(() =>
      PluginManifestSchema.parse({
        ...validManifest,
        capabilities: [{ kind: 'filesystem', paths: ['/'] }],
      }),
    ).toThrow();
  });

  it('rejects a manifest with no extension points', () => {
    expect(() => PluginManifestSchema.parse({ ...validManifest, extensionPoints: [] })).toThrow();
  });

  it('rejects an unknown extension point', () => {
    expect(() =>
      PluginManifestSchema.parse({ ...validManifest, extensionPoints: ['DatabaseAccess'] }),
    ).toThrow();
  });

  it('rejects a non-semver version', () => {
    expect(() => PluginManifestSchema.parse({ ...validManifest, version: 'v1' })).toThrow();
  });

  it('caps the storage quota a plugin may request', () => {
    expect(() =>
      PluginManifestSchema.parse({
        ...validManifest,
        capabilities: [{ kind: 'storage', quotaBytes: 999_000_000 }],
      }),
    ).toThrow();
  });
});
