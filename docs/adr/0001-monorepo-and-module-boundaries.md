# ADR-0001: Monorepo layout and module boundaries

- **Status:** Accepted
- **Date:** 2026-08-09

## Context

The project spans a React web client, a TypeScript API server, a Rust media
service, a plugin SDK published to third parties, and a documentation site.
These share type definitions and must version together for a coherent release,
but they have different toolchains and different audiences.

We also intend to ship native desktop, mobile, and TV clients later. Whatever we
choose now must not assume every consumer of our types is TypeScript, and must
not assume every consumer lives in this repository.

## Decision

A single pnpm workspace with Turborepo for task orchestration, laid out as:

```
apps/
  web/            Vite + React web client
  server/         Hono API, plugin broker, library, requests
  transcoder/     Rust media service (cargo, not pnpm)
packages/
  contracts/      Zod schemas -> OpenAPI 3.1 spec. Source of truth.
  plugin-sdk/     Public plugin API types, host RPC client, test harness
  create-plugin/  Scaffolding CLI
  ui/             Design tokens and shared components
  config/         Shared tsconfig, eslint, prettier
docs/
  adr/            This directory
  site/           Starlight documentation site
```

Boundary rules, enforced in review and by lint config:

1. **`packages/contracts` depends on nothing in the workspace.** It is the root
   of the dependency graph. Everything else may depend on it.
2. **`apps/*` never import from each other.** Cross-app communication happens
   over a network boundary described in `contracts`.
3. **`packages/plugin-sdk` never imports from `apps/server`.** It is a public
   package with an independent version and support window. If it needs a type
   from the server, that type belongs in `contracts` or in the SDK itself.
4. **`packages/ui` contains no data fetching.** Presentational only, so that
   native clients and plugin iframes can reuse the token layer.

The Rust service lives inside the monorepo but is built by cargo. Turborepo
invokes it through a thin task wrapper; it is not a pnpm workspace member.

## Consequences

### What this gets us

One version, one changelog, one CI pipeline, and atomic changes across a schema
and its consumers. Contributors clone once and get everything.

### What this costs us

CI is heavier than it would be for separate repos, and a Rust toolchain becomes
a prerequisite for a full build even for contributors who only touch the web
client. We mitigate this with Turborepo task filtering (`--filter=web...`) and a
documented "frontend only" setup path.

### What this forecloses

Independently versioned server and client releases. If we later need the web
client to ship on its own cadence, extracting `apps/web` means extracting the
shared token and contract packages too — plan on a week, not an afternoon.

## Alternatives considered

**Polyrepo.** Rejected. Type sharing across five repositories via published
packages would mean a version-bump dance for every schema change, at a stage
where schemas change constantly.

**Nx instead of Turborepo.** Nx is more capable, particularly its dependency
graph enforcement, but is heavier to learn. Turborepo's remote caching covers
our actual need. Revisit if boundary rules become hard to enforce by convention.

**Rust as a git submodule.** Rejected. Submodules make single-PR changes across
the API and the media service impossible, which is exactly the change we expect
to make most often early on.

## Revisit when

- The plugin SDK's release cadence diverges materially from the server's.
- Full-repo CI exceeds ~15 minutes on a cache miss.
