# ADR-0003: Scalar for API reference, Starlight for guides

- **Status:** Accepted
- **Date:** 2026-08-09

## Context

"Better developer and documentation support" is a stated primary goal, not a
nice-to-have. Jellyfin's weakness here is one of the main reasons this project
exists. That makes documentation tooling an architectural decision rather than a
detail to settle later.

Two distinct needs, often conflated:

- **Reference** — every endpoint, every schema, every field, generated from the
  contract and therefore always correct.
- **Guides** — plugin authoring, deployment, theming, architecture, migration.
  Hand-written, narrative, and the actual differentiator.

A generated reference cannot teach someone to write a plugin. A hand-written
guide cannot stay accurate across 200 endpoints.

## Decision

**Two surfaces, one spec.**

**Scalar** (`@scalar/hono-api-reference`) renders the OpenAPI document from
ADR-0002 as the interactive API reference, mounted at `/api/reference` on the
running server.

**Starlight** hosts guides, plugin SDK documentation, deployment, and
architecture at `docs/site`, published separately, with the Scalar reference
embedded or linked.

Three constraints on the Scalar integration:

1. **Assets are self-hosted, never loaded from a CDN.** This is a self-hosted
   media server; a meaningful share of installs are LAN-only, behind restrictive
   firewalls, or fully air-gapped. A documentation page that requires internet
   access to render is broken for exactly the users most likely to read it.
2. **The interactive API client is enabled by default on private-network binds
   and gated behind an admin setting otherwise.** It executes real requests
   against a live server with real credentials.
3. **The reference is served by the app itself, at a stable path.** A user
   debugging their own instance should reach the docs for _their_ version, not
   for whatever is on the website.

Starlight ships a `plugin-sdk` section generated in part from the SDK's TSDoc,
so the plugin API reference cannot drift from the code.

## Consequences

### What this gets us

Correct-by-construction endpoint reference with a built-in request playground —
a genuinely strong first-run experience for a plugin author. Version-matched
docs for self-hosters. Prose docs in a fast, accessible, well-maintained static
site generator that treats content as Markdown in the repo, so documentation
changes travel in the same PR as the code.

### What this costs us

Two documentation surfaces to style and keep coherent. Self-hosting Scalar's
assets means tracking its releases ourselves rather than getting fixes
automatically. Bundle size in the server image grows by the Scalar bundle.

### What this forecloses

Nothing significant. Both are replaceable; the OpenAPI spec is the durable
artifact and any renderer can consume it.

## Alternatives considered

**Swagger UI.** Rejected. Weaker UX, and its OpenAPI 3.1 support has historically
lagged — 3.1 is what Zod-to-OpenAPI emits.

**Redoc.** Good reference rendering, but no interactive client. The playground is
a large part of what makes a plugin author's first hour productive.

**Docusaurus instead of Starlight.** Comparable and defensible. Starlight is
lighter, faster to build, and has better default accessibility. Docusaurus wins
if we later need heavy versioned docs and a plugin marketplace frontend in the
same site; revisit then.

**Scalar alone, no prose site.** Rejected. This would reproduce Jellyfin's exact
failure: an endpoint list mistaken for documentation.

## Revisit when

- We need multi-version documentation (docs for 2.x and 3.x simultaneously).
- A plugin marketplace needs to live on the same site as the docs.
