# Valence

A self-hosted streaming platform with first-class plugin, theme, API and
documentation support, plus integrated media requesting.

## Read before writing any code

- [`CODING_STANDARD.md`](CODING_STANDARD.md) — binding coding rules

The standards document is authoritative. What follows is a summary for quick
reference, not a substitute for reading it.

## Non-negotiables

1. **TypeScript and Rust only.** No JavaScript files, including config.
2. **No duplication across modules.** Needed twice means extracted and shared.
3. **No `../` imports.** Use `@ValenceUI/*`, `@ValenceClient/*`, `@ValenceContracts/*`,
   `@ValenceCore/*`, `@ValenceSDK/*`.
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
8. **One ValenceUI component owns each interactive element.** `<button>` lives in
   `Button`, text inputs in `TextField`, `<input type="file">` in `FilePicker`,
   `<dialog>` in `Dialog` — and nowhere else, including elsewhere in ValenceUI.
   Every other control composes one of those; there is no `IconButton`. ESLint
   enforces it.
9. **No raw SVG anywhere.** Icons come from `@hugeicons/core-free-icons` and are
   drawn by `@ValenceUI/Icon`, never by the renderer directly.
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

| Layer         | Choice                              |
| ------------- | ----------------------------------- |
| API contract  | Hono + `@hono/zod-openapi`          |
| API reference | Scalar, served at `/api/reference`  |
| Auth          | better-auth                         |
| Data          | Postgres + Drizzle + pg-boss        |
| Plugins       | Process-per-plugin, brokered        |
| Media         | Rust + FFmpeg child process         |
| UI            | Radix + Tailwind + CVA + Motion     |
| Desktop       | Electron, a window onto the server  |
| Lint          | oxlint + ESLint + husky             |
| Realtime      | One WebSocket, viewer + admin feeds |
| Web state     | TanStack Query + TanStack Router    |

**Not used:** the shadcn registry (its conventions are adopted, its generated code
is not), Redis, SQLite, tRPC as a primary API, barrel files.

## Where front-end code goes

The application is `packages/client` and `packages/screens`; a client is a host
that runs it.

| Directory          | What it holds                                                   |
| ------------------ | --------------------------------------------------------------- |
| `packages/client`  | What Valence is: readers, queries, realtime, session, sharing   |
| `packages/screens` | What Valence looks like: every screen, and the routes onto them |
| `apps/web`         | What a browser is: entry, platform, socket, service worker      |

- **Neither package may import `@ValenceWeb/*`.** ESLint says so. Neither reaches
  into a client. `packages/client` may not import `@ValenceUI/*` either — it does
  not draw — while `packages/screens` is what draws.
- **Anything either needs from a client is a port on `Platform`** — today a
  device store, what to call this client, which client this is, and opening a
  socket. A host installs them with `installPlatform` before anything else runs.
- **A host is eight source files.** If something you are adding to `apps/web`
  is not the entry point, a platform port or a browser API, it belongs in a
  package.

## Working expectations

- **Adding a ValenceUI component?** Add its alias line to `tsconfig.paths.json`.
  Component aliases are listed explicitly, one per component — TS path mapping
  cannot expand `@ValenceUI/*` to `components/*/*.tsx`.
- **Missing a ValenceUI component?** Add it to ValenceUI. Do not work around it locally
  with a raw element.
- **A rule appears to conflict with a library's expectations?** Raise it rather
  than silently deviating. Rules are amendable; silent exceptions are not.
- **Never lower a coverage threshold or disable a lint rule to make a build
  pass.** Both are their own PR with their own justification.
