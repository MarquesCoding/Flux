# Flux

A self-hosted streaming platform with first-class plugin, theme, API and
documentation support, plus integrated media requesting.

> Early scaffold. Nothing here plays media yet.

## Why

Jellyfin's weaknesses are structural: plugins reach into server internals so any
refactor breaks them, the HTTP API has no first-class contract, and HDR content
cannot be transcoded without being tone-mapped down to SDR. Flux takes different
positions on each — see [`docs/adr/`](docs/adr/README.md) for the reasoning, and
the costs each decision carries.

## Quick start

```bash
pnpm install
docker compose up -d db
pnpm dev
```

| Surface          | URL                                    |
| ---------------- | -------------------------------------- |
| Web client       | http://localhost:5173                  |
| API              | http://localhost:8420/api              |
| API reference    | http://localhost:8420/api/reference    |
| OpenAPI document | http://localhost:8420/api/openapi.json |

## Layout

```
apps/
  web/          Vite + React client
  server/       Hono API, OpenAPI contract, plugin broker
  transcoder/   Rust media service (cargo)
packages/
  contracts/    Zod schemas -> OpenAPI 3.1. Source of truth.
  core/         Shared server logic, playback negotiation
  ui/           FluxUI: Base UI + Tailwind + Tabler + Motion
  plugin-sdk/   Public plugin API and manifest schema
docs/
  adr/          Architecture decisions
  code-standards.md
```

## Commands

```bash
pnpm test         # vitest across the workspace
pnpm typecheck    # tsc --noEmit across the workspace
pnpm lint         # oxlint then eslint
pnpm build        # build every package and app
pnpm rust:test    # cargo test
pnpm rust:check   # cargo clippy -D warnings, cargo fmt --check
```

## Contributing

Read [`docs/code-standards.md`](docs/code-standards.md) first — the rules are
binding and several are unusual (no comments, no barrel files, no `any`,
`unknown` or `as`, no raw HTML controls outside FluxUI). Process is in
[`CONTRIBUTING.md`](CONTRIBUTING.md).

## Licence

TBD.
