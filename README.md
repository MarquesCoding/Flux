<div align="center">
<br/>
<br/>

<img src="assets/valence-icon.png" alt="Valence" width="112" />

# Valence

**A self hosted streaming platform for your own library.**

Your films and programmes, on every screen in the house, from a server you own.

[![CI](https://github.com/MarquesCoding/Valence/actions/workflows/ci.yml/badge.svg)](https://github.com/MarquesCoding/Valence/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/MarquesCoding/Valence?display_name=tag&sort=semver)](https://github.com/MarquesCoding/Valence/releases)
[![Image](https://img.shields.io/badge/ghcr.io-valence-blue?logo=docker&logoColor=white)](https://github.com/MarquesCoding/Valence/pkgs/container/valence)
[![Licence](https://img.shields.io/github/license/MarquesCoding/Valence)](LICENSE.md)
[![Stars](https://img.shields.io/github/stars/MarquesCoding/Valence?style=flat)](https://github.com/MarquesCoding/Valence/stargazers)

</div>

<div align="center">

<img src="assets/valence.jpg" alt="The Valence home screen, showing a hero and a continue watching row" width="900" />

</div>

## What it does

- **Plays what you already have.** Point it at a folder. It reads what is there,
  finds the artwork and the details, and leaves your files exactly as it found
  them. No sidecars, no renames, nothing written back.
- **Streams to anything.** Direct play where the device can take the file, and a
  transcode where it cannot, negotiated per device rather than per server.
- **Keeps HDR as HDR.** Tone mapping happens because a screen needs it, not
  because the transcoder gave up.
- **Household, not a single account.** Everybody gets a face, their own place in
  everything, and their own continue watching.
- **Watch together.** A party keeps everybody at the same moment in the same
  film, with the picture staying in step rather than drifting.
- **Take it with you.** Ask for a title at a chosen quality and keep it for a
  flight.
- **Share a link.** One title or one series, to somebody with no account, for as
  long as you decide.
- **An API you can build on.** Every endpoint has a contract, and the reference
  is generated from it and served by the server itself.

## Run it

The image carries the server, the web client and the media service.

```bash
curl -O https://raw.githubusercontent.com/MarquesCoding/Valence/main/compose.yaml
docker compose up -d
```

Then open `http://localhost:8420` and follow the setup.

Point it at your media by editing the mount in `compose.yaml`. It is mounted read
only, deliberately. [`DEPLOYMENT.md`](DEPLOYMENT.md) covers settings, a reverse
proxy, hardware transcoding and upgrades.

## Develop it

```bash
pnpm install
docker compose -f compose.dev.yaml up -d db
pnpm ffmpeg:sync
pnpm dev
```

| Surface          | Address                                |
| ---------------- | -------------------------------------- |
| Web client       | http://localhost:5173                  |
| API              | http://localhost:8420/api              |
| API reference    | http://localhost:8420/api/reference    |
| OpenAPI document | http://localhost:8420/api/openapi.json |

`pnpm ffmpeg:sync` fetches the FFmpeg build Valence ships with. Skipping it works
but quietly costs you hardware encoding and HDR handling, because the FFmpeg on
your machine is unlikely to be the one Valence was built against.

## Layout

```
apps/
  web/          Vite and React, the browser client
  desktop/      Electron, a window onto a server
  server/       Hono, the API contract, the plugin broker
  transcoder/   Rust, the media service
packages/
  contracts/    Zod schemas to OpenAPI. The source of truth.
  core/         Shared logic, playback negotiation
  client/       What Valence is: readers, queries, realtime, sessions
  screens/      What Valence looks like: every screen and its route
  ui/           ValenceUI: Base UI, Tailwind, Hugeicons, Motion
  plugin-sdk/   The public plugin API
```

## Commands

```bash
pnpm test         # every package
pnpm typecheck    # every package
pnpm lint         # oxlint, then eslint
pnpm build        # every package and app
pnpm rust:test    # cargo test
pnpm rust:check   # cargo clippy and cargo fmt
```

## Contributing

Read [`CODING_STANDARD.md`](CODING_STANDARD.md) first. The rules are
binding and several are unusual: no comments, no barrel files, no `any`,
`unknown` or `as`, and no raw HTML controls outside ValenceUI. Process,
branch naming and commit format are in [`CONTRIBUTING.md`](CONTRIBUTING.md).

Found a security problem? [`SECURITY.md`](SECURITY.md) says where to send it.
Please do not open a public issue.

## Stars

<a href="https://star-history.com/#MarquesCoding/Valence&Date">
  <img src="https://api.star-history.com/svg?repos=MarquesCoding/Valence&type=Date" alt="Star history" width="600" />
</a>

## Licence

MIT. See [`LICENSE.md`](LICENSE.md). Use it, change it, ship it, sell it; keep the
copyright notice with it and expect no warranty.
