# ADR-0013: FluxUI built on Base UI + Tailwind, not shadcn

- **Status:** Superseded by [ADR-0018](0018-fluxui-on-radix-and-shadcn-conventions.md)
- **Date:** 2026-08-09

## Context

Flux needs a component library used by the web client today and, per the project
goals, shared conceptually with native clients later. It must also be themeable
by third parties under the token-only constraint in ADR-0008, and extendable by
plugins through declarative UI contributions.

The default industry answer is shadcn/ui: copy component source into your
repository and own it. It is popular and productive. It is also the wrong shape
for this project.

shadcn is a **copy-paste starting point**, not a library. Components are vendored
into the consuming repository and diverge immediately. For a product whose
theming contract must be stable across versions (ADR-0008) and whose plugin
authors need a versioned component surface to build against, vendored-and-
diverged is precisely the property we cannot have. There is no meaningful
"FluxUI version 2.1" if the components are copies that every contributor edits
freely.

## Decision

**FluxUI is a real, versioned package at `packages/ui`, built on Base UI
primitives and styled with Tailwind. shadcn/ui is not used.**

- **Base UI** (`@base-ui-components/react`) provides unstyled, accessible
  behaviour: focus management, keyboard interaction, ARIA wiring, portalling,
  and collision-aware positioning. This is the part that is expensive to build
  and dangerous to get wrong.
- **Tailwind** provides styling, driven entirely by the design token layer so
  that ADR-0008 themes work by overriding tokens rather than by fighting utility
  classes.
- **`@tabler/icons-react`** is the icon set. No raw SVG anywhere (code standards
  §10).
- **Motion** (`motion`) handles animation, preferred over CSS keyframes (code
  standards §11).

### Binding rules

1. **Raw interactive HTML elements appear only inside `packages/ui`.** Everywhere
   else they are lint-banned. FluxUI is the wrapper layer; that is its entire
   purpose.
2. **Every component maps to design tokens, never to hard-coded colour, spacing,
   radius, or shadow values.** A component with a literal hex value in it is a
   component a theme cannot restyle, which breaks the ADR-0008 contract.
3. **Accessibility is a merge requirement, not a follow-up.** Base UI provides
   the behaviour; components must not undo it. Tests query by role and accessible
   name (code standards §12), which fails loudly when a component is inaccessible.
4. **FluxUI does not import from `apps/`.** It has no knowledge of media,
   playback, or any domain concept. Domain-aware components live in
   `apps/web`, composed from FluxUI primitives.
5. **A missing component is added to FluxUI, never worked around locally.**

## Consequences

### What this gets us

A single versioned component surface that plugin authors can target and that
themes can rely on. Accessibility largely by construction, from a primitives
library whose maintainers specialise in it. A token layer reusable by native
clients later. Upgrades that apply everywhere at once instead of requiring a
sweep through vendored copies.

### What this costs us

Slower than shadcn to get the first twenty components on screen — we write the
styling that shadcn would have handed us. Base UI's component coverage is
narrower than some alternatives, so a few primitives will need building on top of
it. We also take a dependency on a library that is still maturing; pin versions
and read release notes.

The strictness of rule 1 will occasionally be annoying, when someone needs a
trivial control and must add it to FluxUI first.

### What this forecloses

Dropping in a shadcn component when in a hurry. Deliberately.

## Alternatives considered

**shadcn/ui.** Rejected for the reasons above — vendored copies cannot provide a
versioned surface for plugins or a stable contract for themes. Its underlying
primitives are a reasonable choice; its distribution model is not, for us.

**Radix UI primitives.** The closest alternative and a defensible pick. Base UI
is the successor effort from overlapping maintainers, with a more consistent API
and better-considered styling hooks. If Base UI's maturity proves a problem,
Radix is the fallback and the migration is mostly mechanical.

**Mantine or MUI.** Batteries included, fast to start. Rejected: both impose
their own theming systems, which conflicts with the token-only theme contract in
ADR-0008, and both are far heavier than a media browsing UI needs.

**Fully bespoke primitives.** Rejected. Re-implementing focus traps, roving
tabindex, and collision-aware positioning correctly is months of work that
produces no differentiation and a great deal of accessibility risk.

## Revisit when

- Base UI's coverage or maturity becomes a recurring blocker.
- Native clients need the token layer in a form Tailwind cannot produce.
