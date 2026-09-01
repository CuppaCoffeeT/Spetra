# Private Ledger — UX/design spec (agent-synthesized, 2026-09-01)

## The five recommendations

### 1. Make the app usable on the phone it was built for — responsive shell with a bottom tab bar

Today a fixed 224px sidebar plus p-8 padding leaves ~100–150px of content at 390px — every page is broken on the device where Apple Pay taps happen. Ship the mobile foundation first: sidebar hidden below md, a frosted safe-area-aware 5-slot bottom tab bar (Dashboard / Transactions / Add / Budgets / More sheet), main p-4 pb-24, min-h-dvh body scroll, viewport-fit=cover + theme-color metas, 16px inputs with inputMode=decimal (kills iOS focus-zoom, shows the decimal pad), and ItemsEditor re-stacked as per-item cards so line-item editing fits a 390px modal.

### 2. Close the signature loop: tap → toast → confirmed in one touch

The live toast is currently a dead end (pointer-events-none, fixed 6s, no review flag). It becomes a tappable receipt slip — merchant in small caps, tabular amount, 'Needs review' dot plus words, top-anchored on mobile, 8s with pause on touch/hover/focus — deep-linking to /transactions?open=<id>, where the URL-as-source-of-truth rework opens the editor. Flagged rows also gain an inline bronze 'Confirm' button (one tap clears the flag) and three honest empty-state branches, so the daily review ritual drops from 3+ interactions to one.

### 3. Never lose or silently mangle user input — trust is the brand

Five silent-loss holes close: the edit modal gains an Escape handler and dirty-check gate (a stray backdrop tap no longer destroys a re-itemized receipt) and becomes a full-height bottom sheet on mobile with Save sticky above the keyboard; half-filled line items trigger a visible two-step warning instead of silent dropping; receipt scans show a thumbnail, ask Replace/Keep-mine before overwriting typed values, and surface upload failure as a warning toast instead of console.error; 'Use items total' reconciles mismatches in one tap.

### 4. Close the learning loop everywhere — and show it, quietly

Add.tsx currently drops the strongest training signal in the app: correcting a wrong suggestion before saving teaches nothing. Wire learnCorrection into Add's save (symmetric with TransactionEditor), then surface every learn through a shared toast utility as a dry 'LEARNED · pattern → Category' slip with Undo (deletes the created rule, falls back to /categories). Suggestion edge cases get guarded (deleted-category suggestions, 'Suggesting…' feedback, 'No match — your pick will teach it.').

### 5. Apply the Private Ledger re-grade and make every page answer its question at a glance

Swap the ~26 token values (paper/ink light, vault dark, bronze/champagne accent — token names unchanged), serif display voice, tabular ink-by-default money with grouped thousands (the one deliberate e2e string change), hairlines over shadows, ink-fill chips, zero chrome emoji, 44px touch targets via hit-slop, bronze focus-visible rings. Then the glance layer: month-labeled hero stats with a mobile Spent-hero card, first-run 'Begin your ledger.' concierge, Budgets '$X left' + elapsed-month pace tick + one-tap carry-over + live-animated bars, and Recent/Top-Category rows as deep links.

---

# Private Ledger — implementable design spec (Spend Tracker web)

Scope: `web/` (Vite + React + Tailwind, hand-rolled components, no new npm deps). Light + dark via CSS vars. All class names below are Tailwind against the existing token bridge in `tailwind.config.js` (token NAMES unchanged).

## 1. Tokens (src/index.css — value swap only)

Light "Paper" (`:root`):
```
--bg:#F6F4EF; --surface:#FBFAF7; --surface-alt:#EFEBE2; --border:#E2DDD1;
--text-primary:#201D18; --text-secondary:#5A544A; --text-muted:#6F6A5C;
--primary:#201D18; --accent:#82633C; --income:#3F6C50; --expense:#9C3F34; --warning:#8A6116;
```
Dark "Vault" (`.dark`):
```
--bg:#121110; --surface:#1A1816; --surface-alt:#242019; --border:#2B2721;
--text-primary:#EDE9E0; --text-secondary:#B5AEA1; --text-muted:#948D7F;
--primary:#EDE9E0; --accent:#C5A872; --income:#8FB79A; --expense:#D68C80; --warning:#D9A84E;
```
All values verified ≥4.5:1 for text on bg, surface AND surfaceAlt in both themes (muted was darkened until it passes — 4.54:1 light / 4.92:1 dark worst case). Discipline rule anyway: information-bearing small text (stat labels, dates, key strings, pace caption, toast merchant) uses `text-textSecondary`; `text-textMuted` is for genuinely tertiary text. Warning/expense colors are NEVER the only signal — always paired with words or a dot+words.

## 2. Typography

- Body: existing system stack, unchanged. Base sizes: 14px (`text-sm`) desktop; ALL form inputs are `text-base md:text-sm` (16px below md — kills iOS focus zoom).
- `tailwind.config.js` gains `fontFamily: { display: ['ui-serif','Georgia','Cambria','Times New Roman','serif'] }` (New York on Apple devices, zero network weight; no Google Fonts).
- Display serif, weight 500 ONLY: sidebar wordmark 18px; PageTitle 24px `tracking-[-0.01em]`; Login h1 22px; Budgets month label 16px; first-run headline 24px.
- Caps labels: 11px / weight 500 / `uppercase tracking-[0.08em]` in text-textSecondary (stat labels, ItemsEditor header, chip-rail context, 'LEARNED', toast merchant, mini-labels 10px in item cards).
- Weight ceiling 600. Every `font-bold`/`font-semibold` becomes `font-medium` (500) or 600 where specified. No emoji anywhere in chrome (nav, headings, buttons, toasts, notes).

## 3. Money

- `formatMoney` (src/lib/api.ts) groups thousands: `Math.abs(amount).toLocaleString('en-SG',{minimumFractionDigits:2,maximumFractionDigits:2})` → `$2,500.00`. Same commit flips the e2e assertion (the ONE intentional string change).
- `font-variant-numeric: tabular-nums` on every figure (AmountText, item amounts, budget figures, toast amounts, hero stats).
- AmountText: direction→color mapping DELETED. Default `text-textPrimary`; direction 'in' → `+` prefix and `text-income`; direction 'out' → no sign, ink. `text-expense` is reserved for alarm states only: over-budget, negative Net, destructive/danger buttons, errors.
- Ledger rows: 14px/500 ink. Standalone hero figures: 36px/600 `tracking-[-0.02em]` desktop, 40px mobile Spent hero; currency symbol and cents at ~60% size in text-textSecondary via nested spans with ZERO whitespace between them (`<span>$</span><span>101</span><span>.90</span>` style) so textContent stays contiguous ('$101.90') for e2e. Split-span treatment applies ONLY to standalone heroes — composite strings ('$12.90 / $300.00') are always one contiguous text run.

## 4. Surfaces & elevation

- Flat. Every card: `rounded-card` (16px) + `border border-border` + `bg-surface` + `p-5`. No card shadows.
- Controls `rounded-lg` (8px); chips `rounded-full`; sheets/More-menu `rounded-t-[20px]`.
- Exactly TWO shadows in the whole app: toast slip `0 12px 32px -16px rgba(20,16,10,.25)` (dark: `rgba(0,0,0,.5)`) and modal/sheet `0 24px 60px -20px rgba(20,16,10,.30)` (dark: `rgba(0,0,0,.55)`). Delete `shadow-lg`/`shadow-xl` everywhere else.
- Progress track: `h-2 bg-surfaceAlt rounded-full`; fill colored by tone; width transitions 400ms.
- Pace tick (Budgets summary): 1px wide × 14px tall, vertically centered over the 8px track, `background: var(--text-primary)`, `box-shadow: 0 0 0 1px var(--bg)` keyline (mandatory — plain ivory on champagne fill measured 1.88:1; the keyline guarantees separation on track and fill in both themes).

## 5. Shell & navigation

Below md (<768px):
- Sidebar hidden. Fixed bottom bar: `fixed inset-x-0 bottom-0 z-40 md:hidden`, `h-14` content row + `pb-[env(safe-area-inset-bottom)]`, `bg-surface/95 backdrop-blur-md` with solid `bg-surface` fallback via `@supports not (backdrop-filter: blur(1px))`, `border-t border-border`, no shadow.
- 5 slots, each `flex-1 min-h-[48px]` flex-col centered: Dashboard `/`, Transactions `/transactions`, Add `/add`, Budgets `/budgets`, More (button). Icons 22px, 1.5px stroke, currentColor, round caps, from local `src/components/Icons.tsx` (no emoji). Labels 11px `tracking-[0.02em]`. Inactive: `text-textSecondary`. Active: `text-textPrimary` + a 3px round `bg-accent` dot centered under the icon. Color transition 160ms house curve.
- More opens a bottom sheet: `bg-surface rounded-t-[20px] border-t border-border`, 280ms rise, rows 48px with the same icons — Categories, Settings, and the theme row (System · Light · Dark). Backdrop `bg-black/40` tap closes.
- Main: `p-4 pb-24 md:p-8 md:pb-8`. Page scroll = body scroll (`min-h-dvh`; `overflow-y-auto` only at md+).

md+ (desktop):
- `w-56` sidebar, `hidden md:flex`. Wordmark 'Spend Tracker' in `font-display text-lg font-medium`. Links 13px/500; inactive `text-textSecondary`; active `text-textPrimary` with a 2px `bg-accent` left rule flush to the aside edge (absolute-positioned span; the `bg-surfaceAlt` active blob is deleted); hover = color shift to text-textPrimary only, never a background. Theme toggle at the bottom in plain words (glyphs deleted).

Foundation (index.html): viewport meta gains `viewport-fit=cover`; two `<meta name="theme-color">` tags (`#F6F4EF` light / `#121110` dark, media-attributed) kept in sync by the theme hook. `html/body/#root { height:100% }` becomes `min-height:100dvh`.

## 6. Components

**Buttons** (ui.tsx Button): primary `bg-primary text-bg` 500; ghost `text-textSecondary hover:bg-surfaceAlt`; danger `text-expense hover:bg-surfaceAlt`; all `rounded-lg px-4 py-2 text-sm min-h-[40px]`. Hit-slop technique app-wide for small controls: padding + negative margin so visual weight stays slender while the touch area reaches 44px (e.g. `p-2 -m-2`, close buttons `h-11 w-11 grid place-items-center -m-2`).

**Chips**: unselected = `border border-border bg-transparent text-textSecondary`; selected = `bg-primary text-bg` (ink fill — 15.3:1/15.6:1; fill-vs-outline is a shape cue, not color-only). Exception: the review chip selected = outline + 5px `bg-warning` leading dot + its words. All chips `rounded-full px-3 py-2 text-sm min-h-[40px] shrink-0 whitespace-nowrap`. Chip rows become single-line rails: `flex gap-2 overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0` with scrollbar hidden (`scrollbar-width:none` + `::-webkit-scrollbar{display:none}` via a `.scrollbar-none` utility in index.css).

**Inputs**: `inputCls = 'rounded-lg border border-border bg-surface px-3 py-2 text-base md:text-sm text-textPrimary focus:border-accent focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-accent'` — `outline-none` deleted. Amount fields keep `type="number"` (e2e) and ADD `inputMode="decimal"`.

**Badge**: `border border-border rounded-full px-2 py-0.5 text-[11px] font-medium bg-transparent`, tone = text color only (warning/accent/income/muted). No filled pills.

**Modal → bottom sheet**: below md the overlay is `fixed inset-0 z-50 bg-black/40 flex flex-col justify-end p-0`; panel `min-h-dvh w-full rounded-t-[20px] bg-surface` rising 280ms; md+ keeps the centered card (`max-w-lg`/`max-w-2xl`, `rounded-card`, `md:p-10` overlay, overlay scrolls). Sticky header (title in `font-display text-lg`, 44px close button with drawn 1.5px-stroke X SVG, hairline bottom border) and sticky footer (`bg-surface/95 backdrop-blur border-t border-border px-6 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]`) via a `footer` prop. Escape closes; backdrop click closes only at md+ (`window.innerWidth >= 768`); both routed through optional `onBeforeClose?: () => boolean` gate. Shadow: the single elevated value above replaces `shadow-xl`.

**Toasts**: container `fixed z-50 flex flex-col gap-2` — mobile `inset-x-4 top-0 pt-[calc(env(safe-area-inset-top)+0.5rem)]`, desktop `md:inset-x-auto md:top-auto md:bottom-6 md:right-6`; `aria-live="polite"`; container `pointer-events-none`, each slip `pointer-events-auto`. Slip = one `<button>` (or div for non-navigating notes): `min-h-[44px] px-4 py-3 bg-surface border border-border rounded-xl text-left w-full md:w-80` + the toast shadow. Live-txn slip line 1: merchant 11px caps text-textSecondary left, amount right `tabular-nums font-semibold text-textPrimary`; line 2 when flagged: 5px `bg-warning` dot + 'Needs review' 12px. Tap navigates `/transactions?open=<id>` and dismisses. Timers: 8s for flagged/actionable, 6s otherwise; paused on `pointerover`, `pointerdown`, `focus`. LEARNED slip: 'LEARNED' 11px caps text-textSecondary, then `<pattern> → <Category>` (true U+2192) 13px, 'Undo' as a `text-accent` text action.

**ItemsEditor**: md+ keeps the 6-col grid `[1fr_3.5rem_4.5rem_5rem_minmax(6rem,8rem)_2rem]`, amount column right-aligned tabular-nums, header row 11px/500 caps `tracking-[0.08em] text-textSecondary` over a hairline rule. Below md each item is a card: `bg-surfaceAlt rounded-lg p-3 border border-border` — row 1: full-width name + 44px hit-slopped remove (drawn X); row 2: qty / unit / amount 3-col grid with 10px caps mini-labels; row 3: full-width category Select. DOM order inside every item stays name → qty → unitPrice → amount → category → remove (e2e `input[step="0.01"]` last() must be the item amount).

## 7. Motion

One curve: `cubic-bezier(0.22,1,0.36,1)` (register as Tailwind `transitionTimingFunction.house` and CSS var `--ease`). Durations: 140ms exits; 160ms micro (hover, nav color); 200ms badge cross-fade; 240ms toast enter (fade + 6px rise); 280ms sheet rise; 400ms progress-bar width (this IS the live-update notification); 1.2s linear settle tint (`color-mix(in srgb, var(--accent) 9%, transparent)` → transparent, plain transparent where color-mix unsupported); 40ms row stagger on budget carry-over. ALL keyframes/transitions wrapped in `@media (prefers-reduced-motion: no-preference)`. Nothing scales, nothing bounces.

## 8. Focus & a11y

`outline-none` deleted everywhere; every interactive element gets `focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-accent`. Expandable rows: the left cluster + amount are one `<button class="flex-1 text-left">` with `aria-expanded` and `aria-controls` on an id'd panel; Edit/Confirm are siblings (no nested interactive elements, no stopPropagation). 44px minimum touch targets app-wide via hit-slop. Warning/expense color always paired with words or dot+words.

## 9. Theme system

Three-state: 'system' (default; `matchMedia('(prefers-color-scheme: dark)')` with a `change` listener) / 'light' / 'dark'; persisted to `localStorage('theme')` in try/catch. Hook toggles `.dark` on `<html>` and syncs both theme-color metas (explicit choice sets both to that theme's bg). Surfaces: Settings Account card renders 'System · Light · Dark' as three text options (active `text-textPrimary`, inactive `text-textSecondary`); sidebar keeps a plain-words toggle; the More sheet carries the same three-option row.

## 10. Voice

Dry, unexclaimed, no emoji, no celebration. 'All clear. Nothing awaiting review.' Full stop. The app behaves like a private banker: present instantly, never loud.

## 11. e2e guardrails (web/e2e/smoke.spec.ts)

These strings/roles/selectors must survive verbatim: headings 'Dashboard', 'Transactions', 'Add transaction', 'Budgets', 'Categories', 'Settings', 'Edit transaction'; buttons 'Edit', 'Save' (exact), 'Save transaction', 'Set budget', '+ Add line item'; texts '1 transaction to review', '$101.90' (contiguous), 'Needs review (1)', 'Whopper meal', '2 × Nuggets', '$12.90 / $300.00' (contiguous), 'similarity · 90%' (DOM text exact; small-caps via CSS only), 'your correction', 'AI-learned', 'pokemon', 'stk_e2e_test_key_abc123', 'never used', '/functions/v1/ingest', '27 examples', 'Live Apple Pay tracking (iOS Shortcut)', "This Month's Budgets", placeholders '0.00', 'e.g. Burger King Jem', 'e.g. Double cheeseburger'; selectors `input[type="number"]` (first in the edit modal = amount, value '12.9'), `input[step="0.01"]` (last on Add = item amount), `input[value="Food"]` (uncontrolled defaultValue), first `combobox` in the edit modal = Category select. ONE deliberate change: '$2500.00' → '$2,500.00', flipped in the same commit as the formatMoney change.
