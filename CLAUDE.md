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
3. **No `../` imports.** Use `@FluxUI/*`, `@FluxContracts/*`, `@FluxCore/*`,
   `@FluxSDK/*`.
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
| UI           | Base UI + Tailwind + CVA + Motion   | [0021](docs/adr/0021-fluxui-rebuilt-from-the-shadcn-registry-on-base-ui.md)          |
| Lint         | oxlint + ESLint + husky             | [0014](docs/adr/0014-lint-and-commit-enforcement.md)                                 |
| Realtime     | One WebSocket, viewer + admin feeds | [0017](docs/adr/0017-realtime-one-socket-two-feeds.md)                               |
| Web state    | TanStack Query + TanStack Router    | [0019](docs/adr/0019-server-state-in-tanstack-query-addresses-in-tanstack-router.md) |

**Not used:** Redis, SQLite, tRPC as a primary API, barrel files, `lucide-react`
(icons come from Hugeicons through `@FluxUI/Icon` — see
[0020](docs/adr/0020-icons-from-hugeicons-through-one-component.md)).

## FluxUI is mid-rebuild

FluxUI is being rebuilt from the shadcn registry on Base UI
([0021](docs/adr/0021-fluxui-rebuilt-from-the-shadcn-registry-on-base-ui.md)).
Three directories, and which one you are in decides which rules apply:

| Directory                    | What it is                                             | Rules                               |
| ---------------------------- | ------------------------------------------------------ | ----------------------------------- |
| `packages/ui/src/old`        | The 53 hand-written components every screen still uses | Full house rules                    |
| `packages/ui/src/base`       | All 63 generated from the registry, untouched          | Quarantined — lint and coverage off |
| `packages/ui/src/components` | Restyled, out of quarantine                            | Full house rules                    |

- **Do not hand-edit `src/base`.** It is regenerable; the only edits it carries
  are its import lines. Restyle a component by rewriting it into
  `src/components` to house standard — one member per file, a `.types.ts`,
  TSDoc, a co-located test — and repointing its alias.
- **Do not add to `src/old`.** It only shrinks.
- **Do not import `lucide-react`**, in the base layer or anywhere. `base/icons.tsx`
  is where the registry's icon imports land.
- **`accent` is the brand colour**, not shadcn's hover surface. That role is
  `subtle`.

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
