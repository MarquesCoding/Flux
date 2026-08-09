# ADR-0008: Plugin UI contributions and theming model

- **Status:** Accepted
- **Date:** 2026-08-09

## Context

ADR-0007 brokers plugin _backend_ code. If plugin _frontend_ code can inject
arbitrary JavaScript into the application shell, the backend broker is
decorative: injected script runs in the same origin as the session, reads tokens
from storage, and can call any API the user can.

Separately, themes are a stated requirement. The naive implementation — themes
as JavaScript bundles — has the same problem, plus a maintenance one: any theme
that reaches into component internals breaks on every UI refactor.

## Decision

**Two tiers for plugin UI, and themes are not code.**

### Tier 1 — Declarative contributions (manifest only)

Navigation entries, settings forms (from the JSON Schema in the plugin
manifest), context-menu actions, detail-page badges and metadata rows, and
dashboard cards backed by a typed data shape. No plugin code runs in the app
shell. This covers the large majority of real plugin UI needs and is the path we
document first and most prominently.

### Tier 2 — Sandboxed iframe

For genuinely custom interfaces, a plugin may ship a page rendered in an iframe
with a restrictive `sandbox` attribute and a strict CSP, communicating with the
host via `postMessage`.

**The `postMessage` bridge is subject to the same grant table as the backend
broker.** It is not a second, weaker permission system; it is the same broker
reached through a different transport. A plugin UI that requests data its
manifest does not permit is denied identically to its backend counterpart.

The iframe is served from a **distinct origin** (or a `blob:`/opaque origin), not
from the app's origin, so that same-origin policy does the enforcement rather
than our own code. Session cookies and tokens are never reachable from it.

### Themes

Themes are **not JavaScript**. A theme is:

- a manifest (name, author, supported app version range)
- CSS custom-property overrides against the token layer in `packages/ui`
- optional static assets (fonts, background images, icons)

Themes may not include script, and may not select on internal class names —
only on the documented token set and a small set of stable, documented semantic
selectors. The token layer is a published, versioned contract exactly like the
plugin extension points.

## Consequences

### What this gets us

The backend security model is not undermined by the frontend. Themes survive UI
refactors, because they depend on tokens rather than on DOM structure —
meaning a theme written today still works after a redesign, which is not true of
any CSS-injection theming system. The token layer is reusable by native clients
later.

Declarative contributions render natively, so plugin UI looks like the
application rather than like an embedded website, and it inherits accessibility
and theming for free.

### What this costs us

The declarative vocabulary must be designed and will inevitably be too small at
first. Expect a steady stream of "I need a contribution type you don't have"
requests in the first year; these must be treated as first-class issues or
authors will push everything into iframes.

Iframe UI is heavier and feels less integrated. Cross-origin iframes cannot
share the token layer's computed styles directly, so we must ship a theme
bridge that forwards resolved tokens over `postMessage` to keep plugin UI
visually coherent.

Themes cannot do anything structural — no moving elements, no new layouts. Some
theme authors will find this limiting and will ask for script.

### What this forecloses

Themes that restructure the interface, and plugins that deeply integrate into the
app shell's own rendering. Both are deliberate. The former is what makes themes
maintainable; the latter is what makes plugins safe.

## Alternatives considered

**Module federation / dynamic remote components.** Excellent integration and DX,
zero isolation. Rejected: plugin code would run with full page privileges,
nullifying ADR-0007.

**Web Components in the main document.** Custom elements are not a security
boundary — they share the document, the origin, and storage. Rejected.

**Themes as JS bundles.** Rejected on both security and maintainability grounds;
this is the model that produces "update broke every theme" release notes.

**Shadow-DOM-scoped plugin components.** Style isolation without security
isolation. Rejected for the same reason as Web Components.

## Revisit when

- A credible in-browser JS sandbox with an origin-level guarantee becomes
  practical.
- Declarative contribution requests cluster around a pattern we can generalise.
