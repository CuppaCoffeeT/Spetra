# Wallet — Design Brief (Phase 1)

Applies the `designer-skills` methodology (design-brief → tokens → IA → frontend aesthetic),
adapted to React Native (tokens translate; web/Tailwind markup does not — primitives are hand-authored).

## Direction — "Quiet ledger"
Clean, calm, minimal. Influences: **Dieter Rams** functional minimalism + **Swiss** typographic clarity.
Money apps feel trustworthy when they're quiet: lots of neutral space, one restrained accent, semantic
colour used sparingly and only where it carries meaning (income vs expense, over-budget).

## Principles
- **Neutral-forward**: warm off-white surfaces, near-black ink text, hairline borders over heavy shadows.
- **One accent** (indigo) for selection / active / links / progress fills — never decoration.
- **Semantic colour only for meaning**: income = green, expense = red, warning (near/over budget) = amber.
- **Ink primary actions** (near-black buttons) — timeless, high-contrast, un-flashy.
- **Light + dark** parity via `useColors()` + `useColorScheme()`.
- **Mobile-first, 44px touch targets, generous spacing.**

## Tokens — `src/theme/tokens.ts`
- `palette.light` / `palette.dark` — bg, surface, surfaceAlt, border, text{Primary,Secondary,Muted},
  primary(+Text), accent(+Text), income, expense, warning, overlay.
- `spacing` 4-based (xs 4 … xxxl 48) · `radii` (sm 8 … xl 24, pill) · `typography`
  (display/title/heading/body/label/caption) · `shadow` (card, fab).
- Consume colours via `useColors()`; spacing/radii/typography/shadow imported directly.
- **Swapping the vibe = editing token values only** — every primitive + screen reads from here.

## Primitives — `src/components/ui/`
`Screen`, `Text`, `Card`, `Button`, `Input`, `Chip`, `ProgressBar`, `ListRow`, `AmountText`,
`SectionHeader`, `FAB`. Barrel: `src/components/ui/index.ts`.

## Scope (Phase 1)
Token system + primitives + refactor existing screens (`index`, `transactions`, `accounts`, `settings`,
`add`, `login`, both `_layout`s) onto them. **Zero behavior change** — presentation only.
