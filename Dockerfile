# syntax=docker/dockerfile:1

# Flux ships its own FFmpeg rather than relying on the host's.
#
# A build without libzimg cannot tone map HDR to SDR, and one without libass
# cannot draw text subtitles. Both failures are silent: the picture appears,
# looking washed out or missing its subtitles. Pinning the build is why
# FFmpeg is driven as a child process rather than linked.

FROM rust:1.98-bookworm AS transcoder-build
WORKDIR /build
COPY Cargo.toml Cargo.lock rustfmt.toml ./
COPY apps/transcoder ./apps/transcoder
RUN cargo build --release --bin valence-transcoder

FROM node:24-bookworm-slim AS web-build
WORKDIR /build
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY tsconfig.base.json tsconfig.json tsconfig.paths.json ./
COPY packages ./packages
COPY apps/web ./apps/web
COPY apps/server ./apps/server
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @valence/web build

# Bundled rather than compiled. `tsc` emits the import specifiers it was given,
# and this repository's are TypeScript path aliases pointing at other packages'
# sources — `@ValenceServer/...`, `@ValenceContracts/...` — which Node cannot
# resolve and which nothing rewrites. The emitted relative imports carry no file
# extension either, which ESM requires. Bundling settles both at build time and
# leaves node_modules external, so native dependencies are still loaded the
# ordinary way.
RUN pnpm --filter @valence/server bundle

FROM node:24-bookworm-slim AS runtime

# Flux's own FFmpeg, at a version Flux chose, rather than whatever the base
# image happens to ship. Debian has no 8.x at all, and packages none of Intel's
# media stack — no libvpl, no vpl-gpu-rt, no iHD driver, in any release or
# component. It also drops QuickSync silently between bookworm and trixie, so a
# base image bump would have removed hardware encoding on Intel with nothing
# anywhere saying why.
#
# The package brings the drivers with it: iHD and i965 for Intel, radeonsi for
# AMD, all inside its own prefix. libva is patched at build time to look there
# first, so mesa-va-drivers is no longer installed — it only ever supplied
# radeonsi, and Debian's ffmpeg that needed it is gone.
#
# `pci.ids` is the table that turns 8086:4680 into "UHD Graphics 770". Only
# amdgpu writes its own name into sysfs, so without this an Intel card can be
# measured and not named, and the admin page would report a figure against a
# pair of hex numbers. About a megabyte, and it is the same table lspci reads.
#
# Downloaded with ADD rather than curl so the image needs no download tool of
# its own. Worth pinning `--checksum` here once the version settles.
# The build itself is published from a repository of its own and is still named for what it was
# called when it was set up. The name in these URLs and paths is that artefact's, not ours, and
# renaming it here would ask this image to fetch something that does not exist.
ARG VALENCE_FFMPEG_VERSION=8.1.2-5.1
ARG TARGETARCH

ADD https://github.com/ValenceOSS/valence-ffmpeg/releases/download/v${VALENCE_FFMPEG_VERSION}/valence-ffmpeg_${VALENCE_FFMPEG_VERSION}-bookworm_${TARGETARCH}.deb /tmp/valence-ffmpeg.deb

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates pci.ids /tmp/valence-ffmpeg.deb \
  && rm /tmp/valence-ffmpeg.deb \
  && rm -rf /var/lib/apt/lists/*

# Both, and not just the first: the transcoder reads them independently, so
# setting only VALENCE_FFMPEG would transcode with our own build while still probing
# with whatever ffprobe the base image had — which here is none at all.
#
# No LD_LIBRARY_PATH: the binaries carry an rpath into their own lib directory.
ENV VALENCE_FFMPEG=/usr/lib/valence-ffmpeg/ffmpeg
ENV VALENCE_FFPROBE=/usr/lib/valence-ffmpeg/ffprobe

WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages
COPY apps/server ./apps/server
RUN pnpm install --frozen-lockfile --prod --ignore-scripts

COPY --from=transcoder-build /build/target/release/valence-transcoder /usr/local/bin/valence-transcoder
COPY --from=web-build /build/apps/web/dist ./apps/web/dist
COPY --from=web-build /build/apps/server/dist ./apps/server/dist

# /media is mounted read-only by compose. Flux never writes to a user's
# library: no sidecars, no renames, nothing.
RUN mkdir -p /config /cache/artefacts /transcodes /media

ENV NODE_ENV=production \
    PORT=8420 \
    TRANSCODER_URL=unix:/run/valence-transcoder.sock \
    VALENCE_VAAPI_DEVICE=/dev/dri/renderD128 \
    VALENCE_TRANSCODE_DIR=/transcodes \
    VALENCE_ARTEFACT_DIR=/cache/artefacts \
    VALENCE_MEDIA_ROOTS=/media

EXPOSE 8420

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD node -e "fetch('http://127.0.0.1:8420/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["docker-entrypoint.sh"]
