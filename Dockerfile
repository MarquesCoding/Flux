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

# ffmpeg from Debian is built with libzimg and libass, so tone mapping and
# subtitle burn-in both work. The transcoder verifies this at startup and
# reports what it found rather than assuming.
#
# mesa-va-drivers is what makes VAAPI work at all. It is not a dependency of
# ffmpeg, so `--no-install-recommends ffmpeg` installed no VA driver whatsoever
# and every VAAPI encoder failed inside the container for want of one — on top
# of the missing device that FLUX-80 fixed, and invisibly, because a rejected
# encoder said nothing until FLUX-80 made it speak.
#
# It carries radeonsi, which is the driver an AMD card reports, plus the generic
# Gallium ones. Intel's iHD is not packaged by Debian at all; an Intel host gets
# QSV, which needs no VA driver, and its VAAPI stays unavailable until the
# Flux FFmpeg build lands and brings iHD with it. See FLUX-83.
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg ca-certificates mesa-va-drivers \
  && rm -rf /var/lib/apt/lists/*

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
