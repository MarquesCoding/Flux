# Architecture Decision Records

This directory records the significant architectural decisions for the project,
why they were made, and what they cost us.

## What an ADR is

An ADR captures a decision that is **expensive to reverse**. If a choice can be
changed in an afternoon, it does not need an ADR. If changing it would break
plugins, clients, stored data, or deployed instances, it does.

ADRs are **immutable once accepted**. We do not edit the reasoning of an accepted
ADR to match what we later did. If a decision changes, write a new ADR and mark
the old one `Superseded by ADR-XXXX`. The record of a decision we got wrong is
more valuable than a tidy directory.

## Status values

| Status       | Meaning                                       |
| ------------ | --------------------------------------------- |
| `Proposed`   | Written, under discussion, not yet binding    |
| `Accepted`   | Binding. Code and review should enforce it    |
| `Superseded` | Replaced. Header links to the replacement     |
| `Deprecated` | No longer applies, with no direct replacement |

## Index

| ADR                                                    | Title                                                     | Status   |
| ------------------------------------------------------ | --------------------------------------------------------- | -------- |
| [0001](0001-monorepo-and-module-boundaries.md)         | Monorepo layout and module boundaries                     | Accepted |
| [0002](0002-api-contract-openapi-first.md)             | OpenAPI-first API contract, not tRPC-primary              | Accepted |
| [0003](0003-documentation-scalar-and-starlight.md)     | Documentation: Scalar for reference, Starlight for guides | Accepted |
| [0004](0004-authentication-better-auth.md)             | Authentication via better-auth                            | Accepted |
| [0005](0005-data-layer-postgres-drizzle-pgboss.md)     | Postgres + Drizzle + pg-boss as the only datastore        | Accepted |
| [0006](0006-deployment-topology-single-box.md)         | Single-box Docker deployment topology                     | Accepted |
| [0007](0007-plugin-runtime-brokered.md)                | Brokered plugin runtime, process-per-plugin               | Accepted |
| [0008](0008-plugin-ui-and-themes.md)                   | Plugin UI contributions and theming model                 | Accepted |
| [0009](0009-media-pipeline-rust-ffmpeg.md)             | Rust media service supervising FFmpeg as a child process  | Accepted |
| [0010](0010-codec-container-hdr-support.md)            | Codec, container, subtitle and HDR support targets        | Accepted |
| [0011](0011-streaming-delivery-and-device-profiles.md) | Streaming delivery and device profile negotiation         | Accepted |
| [0012](0012-media-test-corpus-external-fixtures.md)    | Media test corpus as external fixture download            | Accepted |
| [0013](0013-fluxui-component-stack.md)                 | FluxUI built on Base UI + Tailwind, not shadcn            | Accepted |
| [0014](0014-lint-and-commit-enforcement.md)            | Lint and commit enforcement with oxlint, ESLint and husky | Accepted |
| [0015](0015-casting-to-devices.md)                     | Cast by handing devices an address, with Google's sender  | Accepted |
| [0016](0016-realtime-one-socket-two-feeds.md)          | One realtime socket, with a viewer feed and an admin feed | Accepted |

## Format

Copy [`TEMPLATE.md`](TEMPLATE.md). Keep ADRs short — one decision each, and
prose over bullet soup where the reasoning matters.
