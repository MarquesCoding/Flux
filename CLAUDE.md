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
9. **No raw SVG anywhere.** Icons come from `@tabler/icons-react`.
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

| Layer        | Choice                               | ADR                                                         |
| ------------ | ------------------------------------ | ----------------------------------------------------------- |
| API contract | Hono + `@hono/zod-openapi`           | [0002](docs/adr/0002-api-contract-openapi-first.md)         |
| Docs         | Scalar + Starlight                   | [0003](docs/adr/0003-documentation-scalar-and-starlight.md) |
| Auth         | better-auth                          | [0004](docs/adr/0004-authentication-better-auth.md)         |
| Data         | Postgres + Drizzle + pg-boss         | [0005](docs/adr/0005-data-layer-postgres-drizzle-pgboss.md) |
| Plugins      | Process-per-plugin, brokered         | [0007](docs/adr/0007-plugin-runtime-brokered.md)            |
| Media        | Rust + FFmpeg child process          | [0009](docs/adr/0009-media-pipeline-rust-ffmpeg.md)         |
| UI           | Base UI + Tailwind + Tabler + Motion | [0013](docs/adr/0013-fluxui-component-stack.md)             |
| Lint         | oxlint + ESLint + husky              | [0014](docs/adr/0014-lint-and-commit-enforcement.md)        |
| Realtime     | One WebSocket, viewer + admin feeds  | [0016](docs/adr/0016-realtime-one-socket-two-feeds.md)      |

**Not used:** shadcn/ui, Redis, SQLite, tRPC as a primary API, barrel files.

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
