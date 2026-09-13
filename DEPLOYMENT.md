# Deploying Valence

For a server that pulls the image rather than building it, with TLS terminated
by a reverse proxy somewhere else. Written against Dockge, and true of anything
that takes a compose file.

## What you need

- A machine running Docker, with the library on a path it can read
- A reverse proxy in front of it holding the certificate — nginx, Caddy, a
  tunnel, whatever you already run
- A domain pointed at that proxy

Nothing needs writing to disk on the Docker host. There is no certificate, no
Caddyfile, no configuration file of any kind: everything is settings.

## Settings

`compose.yaml` reads these. Set them in Dockge's environment editor, or replace
each `${...}` in the file itself.

| Setting              | Required | What it is                                                                                                                                         |
| -------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POSTGRES_PASSWORD`  | yes      | Any long random string. Only Valence ever uses it.                                                                                                 |
| `BETTER_AUTH_SECRET` | yes      | At least 32 characters. Sign-in cookies are sealed with it, so changing it later signs everybody out.                                              |
| `PUBLIC_URL`         | yes      | Where a browser reaches Valence — the proxy's address, not the NAS's. `https://valence.example.com`                                                |
| `MEDIA_PATH`         | yes      | The library on the host. `/mnt/tank/media`                                                                                                         |
| `VALENCE_PORT`       | no       | The port on the host, 8420 by default. This is what the proxy points at.                                                                           |
| `TZ`                 | no       | UTC by default. Scheduled jobs keep this clock, so "daily at 03:00" means 3am here rather than 3am UTC.                                            |
| `MEDIA_JOBS`         | no       | Files probed at once during a scan, 4 by default.                                                                                                  |
| `CATALOGUE_API_KEY`  | no       | A TMDB key. Without one, titles come from filenames and nothing fetches posters, descriptions or cast.                                             |
| `COOKIE_SECURE`      | no       | True by default, which is right behind HTTPS. Set it false only when testing over plain HTTP, or sign-in will appear to succeed and then not hold. |
| `RENDER_GROUP_ID`    | no       | The group owning `/dev/dri/renderD128`, 44 by default. `ls -n /dev/dri` says which.                                                                |

Two good ways to make a secret:

```sh
openssl rand -base64 48
head -c 48 /dev/urandom | base64
```

## Generating the secrets without a shell

If you cannot reach a terminal on the host, any long random string will do for
both — they are never typed by a person and never shown anywhere. A password
manager's generator set to 48 characters is fine.

## Hardware transcoding

`devices` and `group_add` at the bottom of `compose.yaml` pass the GPU through.
**Delete both if the machine has no GPU**, because a device that is not there
stops the container from starting at all, and the failure does not say why.

Without a GPU everything still works; anything that cannot be direct played is
converted on the processor instead, which is slower and costs more of it.

## The proxy

Valence speaks plain HTTP on `VALENCE_PORT` and expects something in front of
it to hold the certificate. Three things matter, and the first two are the ones
people miss:

**The WebSocket has to be allowed through.** Valence keeps one, at
`/api/realtime`. Without the upgrade headers everything loads and nothing
updates by itself — no scan progress, no notifications, nobody appearing in a
watch party.

**Buffering has to be off.** Video is delivered as a playlist and a stream of
segments. A proxy that buffers responses holds each segment until it is whole,
which turns steady playback into stalling.

**`X-Forwarded-For` has to be set.** It is what the sign-in rate limiter counts
against. Without it every household member looks like one address — the proxy's.

### nginx

```nginx
map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
}

server {
    listen 443 ssl;
    http2 on;
    server_name valence.example.com;

    ssl_certificate     /etc/letsencrypt/live/valence.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/valence.example.com/privkey.pem;

    # Photos and avatars are uploaded whole. The default of 1m rejects most of them.
    client_max_body_size 0;

    location / {
        proxy_pass http://192.168.1.40:8420;

        proxy_http_version 1.1;
        proxy_set_header Upgrade    $http_upgrade;
        proxy_set_header Connection $connection_upgrade;

        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Segments are served as they are made.
        proxy_buffering off;
        proxy_request_buffering off;

        # A film is longer than a minute, and so is the socket.
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }
}

server {
    listen 80;
    server_name valence.example.com;
    return 301 https://$host$request_uri;
}
```

Replace `192.168.1.40:8420` with the Docker host and `VALENCE_PORT`, and the
server name and certificate paths with yours.

## First run

1. Create the stack and start it. The server migrates its own database on the
   way up, so the first start takes a little longer than the rest.
2. Open `PUBLIC_URL`. The first account created is the administrator — make it
   before anyone else can.
3. Add a library pointing at `/media`, which is where `MEDIA_PATH` appears
   inside the container. Not the host path: the container cannot see that.
4. Scan. The API answers as soon as the scan is queued rather than when it
   finishes, so a large library reports progress rather than appearing to hang.

## Upgrading

The tag is `latest`, so pull and recreate. In Dockge that is the update button.
Pin a version tag instead if you would rather choose when that happens.

Migrations run on start and are not reversed automatically. Take a copy of the
`db-data` volume before a major upgrade.

### Moving to Postgres 18

`compose.yaml` now asks for `postgres:18-alpine`, where it used to ask for
`postgres:17-alpine`. A major Postgres version cannot read the data directory the
previous one wrote, so pulling the new image over an existing `db-data` volume
upgrades nothing: the container starts, finds a directory it does not recognise,
and stops again. The data has to be carried across by hand.

Dump it while the old version is still the one running, then bring it back:

```bash
docker compose exec db pg_dumpall -U valence > valence-backup.sql
docker compose stop db
docker volume ls | grep db-data
docker volume rm <the volume that names>
docker compose up -d db
docker compose exec -T db psql -U valence -d postgres < valence-backup.sql
docker compose up -d
```

Remove the database volume alone. `config`, `cache` and `transcodes` carry
settings and generated files that the upgrade leaves perfectly good, and
`docker compose down -v` would take all four rather than the one.

A fresh install needs none of this.

## When something is wrong

**The container starts and stops again.** Usually `devices` on a machine with
no GPU. Delete `devices` and `group_add` and try again.

**Sign-in succeeds and immediately forgets you.** `PUBLIC_URL` does not match
what the browser is actually using, or `COOKIE_SECURE` is true over plain HTTP.

**The library scans to nothing.** `MEDIA_PATH` points somewhere the container
cannot read, or the library was added with the host path rather than `/media`.

**Everything loads but nothing updates on its own.** The WebSocket is not
getting through the proxy.
