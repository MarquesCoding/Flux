# ADR-0004: Authentication via better-auth

- **Status:** Accepted
- **Date:** 2026-08-09

## Context

Authentication requirements for a self-hosted media server are broader than they
first appear:

- Username/password for the household, with an admin who manages users
- TOTP two-factor and passkeys, on request
- **Login on devices with no keyboard** — TVs, consoles, set-top boxes
- Long-lived credentials for native mobile and desktop clients
- API keys for third-party integrations and scripts
- Optional SSO for homelab users running Authentik, Authelia, or Keycloak
- User management: create, disable, ban, reset, impersonate for support

Jellyfin built most of this bespoke, including Quick Connect for keyboard-less
login. Building it ourselves is months of security-sensitive work.

## Decision

**better-auth** is the authentication layer, using its Drizzle adapter against
the Postgres instance from ADR-0005.

Plugins enabled at launch:

| Capability                                          | Plugin                |
| --------------------------------------------------- | --------------------- |
| TOTP 2FA with backup codes                          | `twoFactor`           |
| WebAuthn / passkeys                                 | `passkey`             |
| TV, console, set-top login                          | `deviceAuthorization` |
| Native client tokens                                | `bearer`              |
| Token verification for the Rust service and plugins | `jwt` (JWKS)          |
| Third-party integrations                            | `apiKey`              |
| Admin user management and impersonation             | `admin`               |
| Homelab SSO                                         | `genericOAuth`        |

Four binding rules:

1. **Cookies are not the only authentication path.** `bearer` and `jwt` are
   enabled from the first release. Every endpoint that accepts a session cookie
   must equally accept a bearer token. A capability reachable only by cookie is a
   capability native clients do not have — the same mistake ADR-0002 avoids.
2. **`trustedOrigins`, cookie `secure`, and `sameSite` are runtime configuration,
   read from environment or the settings store — never baked at build time.**
   See consequences; this is the single highest-risk operational detail.
3. **better-auth owns its own tables.** Application-specific user data —
   library permissions, playback preferences, watch state, request quotas —
   lives in a separate `user_profile` table keyed by better-auth's user id. We do
   not extend better-auth's schema with `additionalFields` beyond what its own
   features require.
4. **Auth-provider plugins are load-at-boot, not hot-reloadable.** better-auth's
   configuration is assembled at server initialisation. A community LDAP or Plex
   auth plugin therefore requires a restart, unlike every other plugin type in
   ADR-0007. This asymmetry must be stated explicitly in the plugin
   documentation rather than discovered.

## Consequences

### What this gets us

`deviceAuthorization` alone justifies the choice: keyboard-less TV login is a
solved problem instead of a bespoke protocol we design, document, and get wrong.
2FA, passkeys, API keys, and an admin surface arrive as configuration rather
than as quarters of work. The Drizzle adapter means one migration toolchain.

### What this costs us

**Cookie configuration will be our largest single source of support load.** Users
run self-hosted software at `http://192.168.1.40:8096` with no TLS, behind Nginx
Proxy Manager, on a Tailscale MagicDNS name, and on a real domain — frequently
several of these pointing at the same instance. `Secure` cookies do not set over
plain HTTP. If `trustedOrigins` is not runtime-configurable and well documented,
every one of those users files a bug. Budget real effort for a first-run wizard
that detects the access URL and configures this correctly.

We also take a dependency on a fast-moving library for a security-critical
component. We pin exact versions, read changelogs before upgrading, and treat
auth upgrades as their own PR with their own testing, never as part of a batch
dependency bump.

### What this forecloses

Hot-swappable authentication backends, per rule 4. Also any authentication model
better-auth does not express; a genuinely unusual requirement would mean
patching around it rather than configuring it.

## Alternatives considered

**Lucia.** Was the natural comparison, but it moved to being a learning resource
rather than a maintained library, which removes it from consideration for a
security-critical dependency.

**Auth.js / NextAuth.** Framework-coupled in practice, weaker on the non-web
flows (device authorization, API keys) that matter most here.

**Keycloak or Authentik as a required dependency.** Rejected outright. Requiring
a self-hoster to run an identity provider to watch a film is a non-starter. We
_integrate_ with these via `genericOAuth`; we do not depend on them.

**Build it ourselves.** Rejected. Password hashing, session fixation, TOTP drift
windows, WebAuthn ceremony handling, and the device authorization flow are all
places where a subtle mistake is a real vulnerability, and none of them are
where this project differentiates.

## Revisit when

- better-auth ships a breaking major that is expensive to absorb.
- We need an authentication model its plugin surface cannot express.
