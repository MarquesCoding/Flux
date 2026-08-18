# Flux

A self-hosted streaming platform with first-class plugin, theme, API and
documentation support, plus integrated media requesting.

## Read before writing any code

- [`docs/code-standards.md`](docs/code-standards.md) — binding coding rules
- [`docs/adr/`](docs/adr/README.md) — architecture decisions and their reasoning

The standards document is authoritative. What follows is a summary for quick
reference, not a substitute for reading it.

## Non-negotiables

1. **TypeScript and Rust only.** No JavaScript files, including config.
2. **No duplication across modules.** Needed twice means extracted and shared.
3. **No `../` imports.** Use `@FluxUI/*`, `@FluxClient/*`, `@FluxContracts/*`,
   `@FluxCore/*`, `@FluxSDK/*`.
4. **No `index.ts` / `index.tsx`.** No barrel files, ever.
5. **`export { ComponentName }`** — named exports only, no default exports and
   no module objects. One member per file, filename matches the member. Set
   `displayName` on every component.
6. **No comments.** TSDoc on functions only — one sentence saying what it does,
   plus `@param`/`@returns` where the name and type do not already say it. Never
   on a type, a constant or a property. Rust `///` and `// SAFETY:` on `unsafe`
   blocks. Lint directives with a reason. Nothing else — no `TODO`, no
   commented-out code, no section banners.
7. **No `any`, no `unknown`, no `as` assertions.** `as const` and `satisfies`
   are fine. Untrusted input enters through a Zod schema.
8. **One FluxUI component owns each interactive element.** `<button>` lives in
   `Button`, text inputs in `TextField`, `<input type="file">` in `FilePicker`,
   `<dialog>` in `Dialog` — and nowhere else, including elsewhere in FluxUI.
   Every other control composes one of those; there is no `IconButton`. ESLint
   enforces it.
9. **No raw SVG anywhere.** Icons come from `@hugeicons/core-free-icons` and are
   drawn by `@FluxUI/Icon`, never by the renderer directly.
10. **Every function and component has a co-located Vitest test.**
11. **Conventional Commits.**

## File layout

```
components/MediaCard/
  MediaCard.tsx
  MediaCard.types.ts
  MediaCard.test.tsx
  animations/fadeIn.tsx
  components/MediaCardBadge/
    MediaCardBadge.tsx
    MediaCardBadge.test.tsx
```

PascalCase for components and their type/test files. camelCase for hooks and
standalone functions. snake_case for Rust modules.

## Stack

| Layer        | Choice                              | ADR                                                                                  |
| ------------ | ----------------------------------- | ------------------------------------------------------------------------------------ |
| API contract | Hono + `@hono/zod-openapi`          | [0002](docs/adr/0002-api-contract-openapi-first.md)                                  |
| Docs         | Scalar + Starlight                  | [0003](docs/adr/0003-documentation-scalar-and-starlight.md)                          |
| Auth         | better-auth                         | [0004](docs/adr/0004-authentication-better-auth.md)                                  |
| Data         | Postgres + Drizzle + pg-boss        | [0005](docs/adr/0005-data-layer-postgres-drizzle-pgboss.md)                          |
| Plugins      | Process-per-plugin, brokered        | [0007](docs/adr/0007-plugin-runtime-brokered.md)                                     |
| Media        | Rust + FFmpeg child process         | [0009](docs/adr/0009-media-pipeline-rust-ffmpeg.md)                                  |
| UI           | Radix + Tailwind + CVA + Motion     | [0018](docs/adr/0018-fluxui-on-radix-and-shadcn-conventions.md)                      |
| Dialogs      | Base UI, and nothing else is        | [0021](docs/adr/0021-dialogs-are-built-on-base-ui.md)                                |
| Lint         | oxlint + ESLint + husky             | [0014](docs/adr/0014-lint-and-commit-enforcement.md)                                 |
| Realtime     | One WebSocket, viewer + admin feeds | [0017](docs/adr/0017-realtime-one-socket-two-feeds.md)                               |
| Web state    | TanStack Query + TanStack Router    | [0019](docs/adr/0019-server-state-in-tanstack-query-addresses-in-tanstack-router.md) |

**Not used:** the shadcn registry (its conventions are adopted, its generated code
is not — see [0018](docs/adr/0018-fluxui-on-radix-and-shadcn-conventions.md)),
Redis, SQLite, tRPC as a primary API, barrel files.

## Where front-end code goes

The application is `packages/client` and `packages/screens`; a client is a host
that runs it
([0022](docs/adr/0022-the-application-is-a-package-and-a-client-is-a-host.md),
[0023](docs/adr/0023-screens-are-part-of-the-application-not-of-a-host.md)).

| Directory          | What it holds                                                |
| ------------------ | ------------------------------------------------------------ |
| `packages/client`  | What Flux is: readers, queries, realtime, session, sharing   |
| `packages/screens` | What Flux looks like: every screen, and the routes onto them |
| `apps/web`         | What a browser is: entry, platform, socket, service worker   |

- **Neither package may import `@FluxWeb/*`.** ESLint says so. Neither reaches
  into a client. `packages/client` may not import `@FluxUI/*` either — it does
  not draw — while `packages/screens` is what draws.
- **Anything either needs from a client is a port on `Platform`** — today a
  device store, what to call this client, which client this is, and opening a
  socket. A host installs them with `installPlatform` before anything else runs.
- **A host is eight source files.** If something you are adding to `apps/web`
  is not the entry point, a platform port or a browser API, it belongs in a
  package.

## Working expectations

- **Adding a FluxUI component?** Add its alias line to `tsconfig.paths.json`.
  Component aliases are listed explicitly, one per component — TS path mapping
  cannot expand `@FluxUI/*` to `components/*/*.tsx`.
- **Missing a FluxUI component?** Add it to FluxUI. Do not work around it locally
  with a raw element.
- **A rule appears to conflict with a library's expectations?** Raise it rather
  than silently deviating. Rules are amendable; silent exceptions are not.
- **Never lower a coverage threshold or disable a lint rule to make a build
  pass.** Both are their own PR with their own justification.
- **Accepted ADRs are immutable.** A changed decision is a new ADR that
  supersedes the old one, never an edit to the original.
