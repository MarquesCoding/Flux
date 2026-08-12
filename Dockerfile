# syntax=docker/dockerfile:1

# Flux ships its own FFmpeg rather than relying on the host's.
#
# A build without libzimg cannot tone map HDR to SDR, and one without libass
# cannot draw text subtitles. Both failures are silent: the picture appears,
# looking washed out or missing its subtitles. Pinning the build is why
# ADR-0009 chose to drive FFmpeg as a child process rather than link it.

FROM rust:1.90-bookworm AS transcoder-build
WORKDIR /build
COPY Cargo.toml Cargo.lock rustfmt.toml ./
COPY apps/transcoder ./apps/transcoder
RUN cargo build --release --bin flux-transcoder

FROM node:22-bookworm-slim AS web-build
WORKDIR /build
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY tsconfig.base.json tsconfig.json tsconfig.paths.json ./
COPY packages ./packages
COPY apps/web ./apps/web
COPY apps/server ./apps/server
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @flux/web build
RUN pnpm --filter @flux/server build

FROM node:22-bookworm-slim AS runtime

# Flux's own FFmpeg, at a version Flux chose, rather than whatever the base
# image happens to ship. Debian has no 8.x at all, and packages none of Intel's
# media stack — no libvpl, no vpl-gpu-rt, no iHD driver, in any release or
# component. It also drops QuickSync silently between bookworm and trixie, so a
# base image bump would have removed hardware encoding on Intel with nothing
# anywhere saying why. See FLUX-83 and ADR-0009.
#
# The package brings the drivers with it: iHD and i965 for Intel, radeonsi for
# AMD, all inside its own prefix. libva is patched at build time to look there
# first, so mesa-va-drivers is no longer installed — it only ever supplied
# radeonsi, and Debian's ffmpeg that needed it is gone.
#
# Downloaded with ADD rather than curl so the image needs no download tool of
# its own. Worth pinning `--checksum` here once the version settles.
ARG FLUX_FFMPEG_VERSION=8.1.2-2flux1
ARG TARGETARCH

ADD https://github.com/MarquesCoding/flux-ffmpeg/releases/download/v${FLUX_FFMPEG_VERSION}/flux-ffmpeg_${FLUX_FFMPEG_VERSION}-bookworm_${TARGETARCH}.deb /tmp/flux-ffmpeg.deb

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates /tmp/flux-ffmpeg.deb \
  && rm /tmp/flux-ffmpeg.deb \
  && rm -rf /var/lib/apt/lists/*

# Both, and not just the first: the transcoder reads them independently, so
# setting only FLUX_FFMPEG would transcode with Flux's build while still probing
# with whatever ffprobe the base image had — which here is none at all.
#
# No LD_LIBRARY_PATH: the binaries carry an rpath into their own lib directory.
ENV FLUX_FFMPEG=/usr/lib/flux-ffmpeg/ffmpeg
ENV FLUX_FFPROBE=/usr/lib/flux-ffmpeg/ffprobe

WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages
COPY apps/server ./apps/server
RUN pnpm install --frozen-lockfile --prod --ignore-scripts

COPY --from=transcoder-build /build/target/release/flux-transcoder /usr/local/bin/flux-transcoder
COPY --from=web-build /build/apps/web/dist ./apps/web/dist
COPY --from=web-build /build/apps/server/dist ./apps/server/dist

# /media is mounted read-only by compose. Flux never writes to a user's
# library: no sidecars, no renames, nothing. See ADR-0006.
RUN mkdir -p /config /cache /transcodes /media

ENV NODE_ENV=production \
    PORT=8420 \
    TRANSCODER_URL=unix:/run/flux-transcoder.sock \
    FLUX_VAAPI_DEVICE=/dev/dri/renderD128 \
    FLUX_TRANSCODE_DIR=/transcodes \
    FLUX_MEDIA_ROOTS=/media

EXPOSE 8420

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD node -e "fetch('http://127.0.0.1:8420/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["docker-entrypoint.sh"]
