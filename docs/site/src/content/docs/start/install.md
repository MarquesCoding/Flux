---
title: Install Valence
description: Get Valence running with Docker Compose.
---

Valence ships as two containers: the application and Postgres.

```bash
curl -O https://raw.githubusercontent.com/valence/valence/main/docker-compose.yml
curl -O https://raw.githubusercontent.com/valence/valence/main/.env.example
mv .env.example .env
```

Edit `.env` before starting. Two settings cause most first-run problems:

- **`BETTER_AUTH_SECRET`** must be a random value of at least 32 characters.
  Generate one with `openssl rand -base64 48`.
- **`TRUSTED_ORIGINS`** must list every address you reach Valence on. A missing
  entry is the most common cause of a login that appears to do nothing.

Then:

```bash
docker compose up -d
```

Open the address you configured and the first-run wizard will create your
administrator account. It pre-fills the origins from the address you reached it
on, because that address has just proved it works.

## Why Valence ships its own FFmpeg

The image includes a known-good FFmpeg build. A build without `libzimg` cannot
tone map HDR to SDR, and one without `libass` cannot draw text subtitles.
Both failures are silent: the picture appears, looking washed out or missing
its subtitles.

Valence verifies what its FFmpeg can do at startup and reports it, rather than
assuming.

## Publishing the documentation

The site builds with a sitemap, which needs to know its own public address.
Set `VALENCE_DOCS_SITE` when you build:

```sh
VALENCE_DOCS_SITE=https://docs.example.org pnpm --filter @valence/docs build
```

Without it the build falls back to `http://localhost:4321`, which is right for
reading the docs locally and wrong for anything a search engine will crawl.
