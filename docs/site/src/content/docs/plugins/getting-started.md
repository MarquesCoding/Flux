---
title: Writing a plugin
description: What a Valence plugin is, and what it is deliberately not allowed to do.
---

## Plugins run in their own process

A Valence plugin does not run inside the server. It runs in a child process with
no filesystem access, no network access and no subprocess access, and reaches
everything through a broker that checks each call against the permissions the
plugin declared.

This costs roughly 40–60 MB of memory per active plugin. That is the honest
price of the model, and it is why plugins start lazily and shut down when idle.

## Declare what you need

```json
{
  "id": "tmdb-metadata",
  "name": "TMDB Metadata",
  "version": "1.0.0",
  "apiVersion": "^1.0.0",
  "author": "You",
  "description": "Fetches film and series metadata from TMDB.",
  "extensionPoints": ["MetadataProvider"],
  "capabilities": [
    { "kind": "network", "domains": ["api.themoviedb.org"] },
    { "kind": "library", "access": "read" }
  ],
  "entry": "dist/plugin.js"
}
```

Everything the broker will grant appears here, so the administrator sees a
complete list before your plugin runs, and a diff of it when you update.

## Three rules the broker enforces

1. **You get handles, not paths.** `media.probe(handle)` rather than a filename.
   Path traversal stops being a category of bug that can exist.
2. **Network access is declared.** There are no sockets; `http.fetch()` is
   host-implemented and checked against your allowlist, redirects included.
3. **Everything crossing the boundary is serialisable.** No functions, no
   proxies, no shared memory. This is what keeps a WebAssembly runtime an
   additive option rather than a rewrite.

## If the broker does not expose what you need

Open an issue. Extension-point requests are a first-class issue type with a
fast path, deliberately, so that a brokered model does not become a wall.
