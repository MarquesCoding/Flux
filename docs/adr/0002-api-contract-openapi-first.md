# ADR-0002: OpenAPI-first API contract, not tRPC-primary

- **Status:** Accepted
- **Date:** 2026-08-09

## Context

An early proposal was Hono + tRPC. tRPC gives excellent end-to-end type safety
between a TypeScript server and a TypeScript client with almost no ceremony.

Three of our stated goals conflict with it:

1. **First-class third-party API support.** tRPC has no wire contract, no
   published schema, and no meaningful way for an outside developer to discover
   or consume the API without reading our source.
2. **Native desktop, mobile, and TV clients.** Swift, Kotlin, and C++ cannot
   consume a tRPC router. There is no code generation story for them.
3. **A polyglot plugin ecosystem.** ADR-0007 commits to a serializable RPC
   boundary specifically so non-JavaScript plugins remain possible. A plugin
   that wants to call the server API needs a contract it can generate against.

Jellyfin's API is widely criticised for being inconsistently generated and
poorly documented. Beating it requires the contract to be the artifact we design,
not a byproduct of the implementation.

## Decision

**`@hono/zod-openapi` is the only way HTTP routes are defined.** Zod schemas in
`packages/contracts` are the single source of truth. From them we derive:

- a runtime-validated Hono route (request and response validated, not just typed)
- an OpenAPI 3.1 document served at `/api/openapi.json` and committed to the repo
- full type inference for internal TypeScript clients via `hono/client`

Rules:

1. **No route may be registered outside the `contracts` schema set.** A route
   with no schema is a route that does not exist in the spec, and an undocumented
   endpoint is a bug.
2. **The committed OpenAPI document is checked in CI.** If a PR changes routes
   without regenerating the spec, CI fails. The spec is reviewable in diffs.
3. **Breaking changes to the spec require a version bump and an entry in the API
   changelog.** The API is a public interface from day one, not after 1.0.
4. **tRPC may be added later as an optional convenience layer over the same
   handlers**, for internal web-app calls only. It must never be the only way to
   reach a capability.

## Consequences

### What this gets us

A real, versioned, published contract. Native clients get generated SDKs in any
language. Third-party developers get a browsable, testable reference (ADR-0003).
Runtime validation at the edge, which tRPC's type-only guarantees do not provide
once an untrusted client is involved.

### What this costs us

More ceremony per endpoint than tRPC. Defining a schema, wiring the route, and
regenerating the spec is perhaps three times the keystrokes of a tRPC procedure.
We accept this; it is paid once per endpoint and repaid on every client.

Zod-to-OpenAPI does not express every Zod refinement cleanly. Some validation
logic will live in handlers rather than in the schema, and those cases must be
documented in the endpoint description so the spec is not misleading.

### What this forecloses

Cheap RPC-style iteration. Adding a quick internal endpoint is no longer a
two-line change, which will occasionally feel like friction during rapid work on
the web client.

## Alternatives considered

**tRPC primary, OpenAPI generated via `trpc-openapi`.** Rejected. The generated
spec is a lossy projection of the router, constrains procedure design to what
maps cleanly onto HTTP, and treats the public contract as second-class — exactly
the failure mode we are trying to avoid.

**gRPC / Protobuf.** Genuinely good for native clients and polyglot plugins, and
the strongest alternative. Rejected for the _public_ API because browser support
requires grpc-web plus a proxy, and because a self-hosted product's API needs to
be usable from `curl` and a browser address bar by hobbyist users. We do use a
binary protocol on the internal server-to-transcoder boundary (ADR-0009).

**Hand-written OpenAPI, implementation follows.** Rejected. Spec and code drift
apart within weeks without a generator binding them.

## Revisit when

- We have three or more native clients and their SDK generation proves painful.
- OpenAPI 3.1 tooling in a target client language turns out to be inadequate.
