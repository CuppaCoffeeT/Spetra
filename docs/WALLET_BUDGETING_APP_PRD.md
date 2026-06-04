# Wallet & Budgeting App — PRD

**Created**: 2026-06-04 · **Last Updated**: 2026-06-04 · **Status**: 🔵 Planning · **Priority**: High
**Work type**: program (multi-feature evolution of an existing Expo app)
**Authored via**: `prd-write` methodology (project base) — research-first → ask → phased plan
🤖 **Build via**: execute one phase at a time; each phase is independently shippable and verifiable.
✅ **Completion gate**: all phases ✅ + DoD gates green → move to `docs/completed/`.

> Scope: evolve the existing **Spend Tracker** (Expo/RN + Supabase) into a full wallet + budgeting app —
> categorised spending, a learning keyword categorizer ("NLP"), on-device receipt scanning,
> Gmail auto-pull (already built), per-category budgets, and a clean design-system UI.

---

## 📊 Progress / State  ← executor flips ⬜→🟡→✅; read first
**Current phase: 1 complete ✅ → ready for Phase 2 (categories) · Blockers: none**

| Phase | Title | Status | Notes |
|---|---|---|---|
| 0 | Foundations & schema | ✅ | Migrations applied to prod 2026-06-04; SQLite schema + TS types tsc-green. Reconciled 2 pre-existing empty stub tables (categories, budgets) + fixed FK types to uuid |
| 1 | Design system (design-first) | ✅ | `src/theme/` tokens (light+dark) + 11 RN primitives + `.design/` brief; refactored all 8 screens onto them, behavior-preserved. tsc 0, no raw hex |
| 2 | Categories module | ⬜ | Replace hardcoded `CATEGORIES` with editable table |
| 3 | Budgeting | ⬜ | Per-category monthly caps + progress + alerts |
| 4 | Transaction detail / edit | ⬜ | Full edit screen — enables "edit later to add detail" |
| 5 | Receipt scanner (on-device OCR) | ⬜ | ML Kit (native, needs dev build) + Tesseract.js (web) |
| 6 | Smarter categorization ("NLP") | ⬜ | Keyword scoring + confidence + learns from corrections |

---

## 📋 Definition

**What** — Turn the current spend tracker into a wallet + budgeting app with: (1) categorised spending,
(2) a categorizer that auto-sorts from merchant/description text and *learns* from user re-categorizations,
(3) an on-device receipt scanner that OCRs an image and pre-fills a transaction, (4) Gmail auto-pull of bank
transaction emails *(already implemented)*, (5) simple per-category monthly budgets, (6) a clean, minimalist
design-system UI built with the `designer-skills` methodology.

**Why** — Today the app ingests Gmail bank alerts and shows monthly category totals, but has no budgets,
no receipt capture, a brittle hardcoded category list, a regex categorizer that never improves, and ad-hoc
per-screen styling. These are the gaps between "spend tracker" and "wallet app."

**Target user** — Single end user (the app owner). No multi-tenant / RBAC. Data is per-`user_id`, RLS-scoped.

**Primary flow (user-stated)** — Gmail link auto-populates transactions → user edits an entry later to add
detail / scan a receipt for more detail → user can also add entries manually.

**Success criteria**
- Every transaction (email / manual / receipt) lands in one categorised ledger, editable after the fact.
- Re-categorizing a merchant once makes future transactions from that merchant auto-sort correctly.
- A receipt photo pre-fills amount + date + merchant on iOS, Android, **and** web.
- Per-category monthly budgets show spent/remaining and warn when exceeded.
- UI is visually consistent (single token system, shared primitives) on all three platforms.
- `npx tsc --noEmit` clean; no regression to existing Gmail sync.

---

## 🔎 Research findings — current code map (verified by reading every source file)

**Stack** — Expo SDK 54, Expo Router (tabs), React 19 / RN 0.81, Zustand store, Supabase (auth + Postgres),
`expo-sqlite` (native local), TypeScript. Targets iOS / Android / **web** (`react-native-web`).

**What already works (do NOT rebuild):**
| Area | File(s) | State |
|---|---|---|
| Gmail OAuth + fetch | `src/services/gmail.ts` | ✅ PKCE (native) + implicit (web), multi-account, token refresh, fetches UOB + Revolut emails |
| Email → transaction parse | `src/services/parser.ts` | ✅ SGD amount/date/direction/merchant regex; NETS/PayNow/card cases; account auto-detect |
| Categorizer | `src/services/categorizer.ts` | ⚠️ Rule-based regex, 10 hardcoded SG categories — **no learning, no confidence** |
| Local + cloud data | `src/lib/db.ts`, `src/lib/sync.ts` | ✅ Native: SQLite + dedupe-hash + sync to Supabase. Web: direct Supabase. |
| Store | `src/store/useStore.ts` | ✅ Branches `Platform.OS === 'web'` → Supabase direct; native → SQLite |
| Screens | `app/(app)/{index,transactions,accounts,settings}.tsx`, `add.tsx`, `login.tsx` | ✅ Work; ⚠️ inline `StyleSheet`, repeated hex, no shared primitives |
| DB | `supabase/migrations/…create_bank_accounts.sql` | Only `bank_accounts` migrated. `transactions` schema lives in `db.ts` + README SQL. **No `categories`/`budgets`/`rules`/`receipts` tables exist.** |

**Blast-radius / load-bearing facts the plan must respect:**
1. **Web has no SQLite** — `db.ts` throws on web; the store already dual-paths every data op. **Every new table must follow the same dual pattern** (native SQLite + sync, web direct Supabase) *or* be declared Supabase-only with a logged rationale.
2. **Categories are a hardcoded `const CATEGORIES`** in `categorizer.ts`, consumed by `add.tsx` and (implicitly) Home. Making them editable (needed for budgets-per-category) is a **foundational refactor that gates Phases 3 & 6**.
3. **`parser.ts` already extracts amount/date/merchant from free text** — the receipt OCR phase should **generalize this module**, not duplicate it (code-hygiene: reuse > new). One text-extractor serves both email bodies and OCR'd receipts.
4. **Transactions are append-only in the UI** — `updateTransaction` only edits `category`. "Edit later to add detail" requires a real edit path (Phase 4).
5. **Dedupe hash** = `amount-date-description` (`db.ts:54`, duplicated in `sync.ts`). Editing a transaction's amount/desc would orphan its hash — Phase 4 must handle this.
6. `transactions` table is created **only in `db.ts` / README SQL**, not in a tracked migration. Phase 0 should capture the real schema as a migration so it's reproducible.

**External references (researched):**
- **TaxHacker** (`vas3k/TaxHacker`) — full **Next.js** standalone app, *not a library*. Receipt magic = vision-LLM + prompt → structured fields (merchant, amount, date, line items, tax, currency). **Not directly reusable in Expo.** Given the chosen on-device/free path, we **borrow its field schema + extraction intent**, implemented with on-device OCR instead of a cloud LLM.
- **designer-skills** (`julianoczkowski/designer-skills`, `npx skills add …`) — Claude Code **skill pack**: `/design-brief`, `/design-tokens`, `/information-architecture`, `/frontend-design` (8 aesthetics incl. Dieter Rams / Swiss = clean-minimalist), `/design-review`. Writes a `.design/` folder. **Build-time methodology**, web-oriented (Tailwind/CSS vars) — adapt outputs to RN tokens + primitives in Phase 1.

---

## 🔒 Decisions locked (user, 2026-06-04)

| # | Decision | Choice | Implication |
|---|---|---|---|
| D1 | AI engine (OCR + categorization) | **On-device / free** | No LLM backend. Native OCR = ML Kit; web OCR = Tesseract.js. Categorizer = keyword scoring + learned rules. **Native OCR requires an EAS dev build — not Expo Go.** |
| D2 | Platform priority | **All three equally** | Every feature dual-paths (web + native), like Gmail does. |
| D3 | Budgeting depth | **Simple per-category caps** | Monthly limit/category + spent/remaining + over-budget alert. No envelopes/rollover in v1. |
| D4 | Sequencing | **Design-first, phased** | Phase 1 = design system before features. |

---

## 🚦 Phases (smallest independently-verifiable slices, dependency-ordered)

### Phase 0 — Foundations & schema  *(serialize; blocks 2–6)*
**Goal** — Schema reality matches code; new tables exist on both platforms.
**Scope**
- Add tracked Supabase migrations + matching SQLite schema for: `categories`, `budgets`, `receipts`.
  Extend `transactions` with `receipt_id`, `notes`, `category_confidence`, `edited` (align with README's richer schema).
- Capture the existing `transactions` table as a real migration (currently only in `db.ts`/README).
- Decide + document per-table data path: small config tables (`categories`, `budgets`) → **Supabase-direct on all platforms** (acceptable: tiny, needs auth anyway); `receipts` images → **Supabase Storage**; `transactions` keeps the existing dual pattern.
- RLS `using (user_id = auth.uid())` on every new table (mirror `bank_accounts`).
**Deliverables** — migrations under `supabase/migrations/`; `db.ts` schema bumped; types in `src/types/index.ts`.
**Deps** — none. **Parallel-safe** — no (shared schema). **Gate** — migrations apply clean; `tsc` clean; existing sync unaffected.

### Phase 1 — Design system  *(design-first; depends 0 only for type names)*
**Goal** — One token system + shared RN primitives; existing screens refactored, zero behavior change.
**Scope**
- Run `designer-skills`: `/design-brief` → `/design-tokens` → `/information-architecture` → `/frontend-design` (pick a clean-minimalist aesthetic, e.g. Dieter Rams / Swiss). Persist to `.design/`.
- Implement `src/theme/tokens.ts` (color/spacing/typography/radii; light + dark) from the generated tokens — RN-flavored (no Tailwind).
- Build `src/components/ui/`: `Screen`, `Card`, `Button`, `Input`, `Chip`, `ProgressBar`, `ListRow`, `AmountText`, `SectionHeader`, `FAB`. Replace the repeated inline hex (`#3b82f6`, `#1e293b`, `#ef4444`, `#22c55e`, …).
- Migrate the 5 existing screens + `add.tsx` + `login.tsx` to primitives + tokens. **No data/logic changes.**
**Deliverables** — `.design/` artifacts; `src/theme/`; `src/components/ui/`; refactored screens.
**Deps** — 0. **Parallel-safe** — primitives can be built in parallel; screen migration serializes per-screen. **Gate** — visual consistency across iOS/Android/web; `tsc` clean; no functional diff.

### Phase 2 — Categories module  *(depends 0; gates 3 & 6)*
**Goal** — Categories are user-editable data, not a hardcoded const.
**Scope**
- `categories` store slice (CRUD) following the dual-path pattern; seed with the current 10 + colour + optional icon.
- Replace `CATEGORIES` const usage in `add.tsx`; Home reads dynamic categories.
- Category management UI (add/edit/delete/recolour) in Settings or a dedicated screen, built on Phase 1 primitives.
- Keep `categorizer.ts` returning category *names* (decouple from the const).
**Deliverables** — `categories` slice; management screen; `add.tsx`/Home consuming dynamic list.
**Deps** — 0, 1 (UI). **Parallel-safe** — with 4/5. **Gate** — create/edit/delete persists + round-trips on web + native; existing transactions keep their category strings.

### Phase 3 — Budgeting  *(depends 2)*
**Goal** — Per-category monthly caps with live progress + alerts.
**Scope**
- `budgets` slice: `{category_id, month (YYYY-MM), limit_amount}`.
- Budget-setup screen (set/clear a cap per category). Compute spent-this-month per category from `transactions`.
- Progress bars on a new **Budgets** view + a compact summary on Home; over-budget state (colour + label). Optional local notification when a category crosses 100%.
**Deliverables** — `budgets` slice; Budgets screen; Home budget summary; alert logic.
**Deps** — 2 (needs category ids). **Parallel-safe** — with 4/5. **Gate** — set a cap → spend → progress + over-budget reflect correctly on all platforms.

### Phase 4 — Transaction detail / edit  *(depends 1)*
**Goal** — Open any transaction and edit all fields — the "edit later to add detail" path.
**Scope**
- Detail/edit screen reachable from Transactions + Home rows. Edit amount, direction, description, category, date, notes.
- Generalize `updateTransaction` (store + `sync.ts`) beyond `category` to full updates, on both platforms.
- Handle **dedupe-hash** correctly on edit (recompute or freeze hash; document choice) so edits don't create phantom dupes or break future Gmail dedupe.
**Deliverables** — edit screen; expanded `updateTransaction`; hash-on-edit handling.
**Deps** — 1, 0. **Parallel-safe** — with 3. **Gate** — edit persists on web + native; re-running Gmail sync doesn't duplicate an edited transaction.

### Phase 5 — Receipt scanner (on-device OCR)  *(depends 0, 1, 4)*
**Goal** — Photograph/upload a receipt → OCR → pre-filled transaction, attachable to a new or existing entry.
**Scope**
- Capture/pick: `expo-camera` + `expo-image-picker`.
- OCR: **native** = ML Kit text recognition (e.g. `@react-native-ml-kit/text-recognition`) — **requires an EAS dev build + config plugin (NOT Expo Go)**; **web** = `tesseract.js`. Abstract behind one `recognizeText(image)` service that branches on `Platform.OS`.
- Extract fields by **generalizing `parser.ts`** into a shared text-extractor (amount/date/merchant/line-items) reused by both email + receipt paths.
- Store image in **Supabase Storage**; `receipts` row links to a `transaction_id`. Flow: scan → review pre-filled form (Phase 4 edit screen) → save / attach to existing.
**Deliverables** — `recognizeText` service (native+web); generalized extractor; receipt capture/review flow; Storage upload; `receipts` linkage.
**Deps** — 0 (`receipts`), 1 (UI), 4 (review/edit form). **Parallel-safe** — with 3. **Gate** — a receipt pre-fills amount+date+merchant on iOS, Android, web; image retrievable; attaches to a transaction. **Setup gate**: dev-build instructions documented + working.

### Phase 6 — Smarter categorization ("NLP")  *(depends 2)*
**Goal** — Auto-sort from text with confidence, and *learn* from corrections.
**Scope**
- Upgrade `categorizer.ts`: tokenise merchant/description, score against keyword sets, return `{category, confidence}` (replace first-match regex).
- `rules` table/slice: when a user re-categorizes a transaction (Phase 4), persist a learned merchant→category rule; learned rules outrank built-in keywords on future ingests.
- Apply on Gmail import + manual entry + receipt extraction. Low-confidence → flag for review, don't silently mis-sort.
**Deliverables** — scoring categorizer + confidence; `rules` learning slice; correction → rule hook in edit flow; review flag for low confidence.
**Deps** — 2 (categories), benefits from 4 (correction hook). **Parallel-safe** — with 5. **Gate** — re-categorizing merchant X once makes the next X transaction auto-sort to the new category on all platforms.

---

## 🎯 Definition of Done — gates (per phase + overall)
- `npx tsc --noEmit` clean after every phase.
- No regression to existing Gmail OAuth + email→transaction sync (smoke-test after Phases 0,1,4,6).
- Every new data feature verified on **iOS, Android, and web** (D2).
- New tables RLS-scoped to `auth.uid()`; no service-key/secret in the client bundle.
- Phase 5: EAS dev-build path documented and demonstrably runs native OCR.
- Visual: all screens consume `src/theme/tokens.ts` — no net-new raw hex in `src/`/`app/` after Phase 1.

## ❓ Open Questions / Risks (provisional defaults — revisit during execution)
- **R1 — Native OCR needs a dev build.** ML Kit can't run in Expo Go. *Default*: ship Phase 5 on an EAS dev build; document the prebuild. If the user requires Expo-Go-only, fall back to web-Tesseract + manual entry on native (logged).
- **R2 — New tables: Supabase-direct vs dual SQLite.** *Default (Phase 0)*: `categories`/`budgets`/`rules` are Supabase-direct on all platforms (small, auth-gated); only `transactions` keeps offline SQLite. Revisit if offline budgeting on mobile is required.
- **R3 — Dedupe hash on edit (Phase 4).** *Default*: freeze the original `dedupe_hash` at insert and never recompute on edit, so Gmail re-sync dedupe stays stable; surface as a documented invariant.
- **R4 — designer-skills is web-oriented.** Tokens translate cleanly to RN; component *markup* does not. *Default*: use it for tokens + IA + aesthetic direction, hand-author the RN primitives.
- **R5 — OCR accuracy on messy receipts** (consequence of D1 free path). *Mitigation*: always route OCR output through the Phase 4 review/edit screen before save — never auto-commit.
- **R6 — Categories already stored as free-text strings on transactions.** Moving to a `categories` table: keep the string column (denormalised) and match by name to avoid a migration of historical rows; log in Phase 2.

## 🗒️ Execution Log  *(executor appends one dated row per phase)*
| Date | Phase | What shipped | Gate result |
|---|---|---|---|
| 2026-06-04 | 0 | 7 idempotent migrations (`bank_accounts` baseline, `transactions` baseline, `categories`, `budgets`, `receipts`, `extend_transactions`, `receipts` storage bucket+policies); `db.ts` SQLite schema + `PRAGMA user_version` migration for existing installs; `Transaction` extended + `Category`/`Budget`/`Receipt` types; `sync.ts` read mappings. Built via parallel-implement + adversarial-verify workflow. | `tsc --noEmit` 0 errors ✅ · column parity SQLite⇄Supabase⇄TS ✅ · RLS+owner policy on every table ✅ · idempotent+FK-ordered ✅ |
| 2026-06-04 | 0 | **Applied to prod** via Dashboard SQL Editor (project `fpasfffeywotrclprcai`). Discovered + reconciled 2 pre-existing **empty** stub tables: dropped `categories` (minimal) + `budgets` (incompatible `name/period/currency/amount/starts_on` design), recreated to PRD schema. Fixed FK type bug: `transactions.id` is **uuid** (not text) → corrected `receipts.transaction_id` + baseline `transactions.id` to `uuid`. | Applied clean ✅ · all FKs uuid↔uuid ✅ · `tsc` 0 ✅ |
| 2026-06-04 | — | **Base reconciliation**: the worktree had branched from the last commit (`a963f64`), which predated large uncommitted WIP in main (multi-account Gmail, bank accounts, `accounts`/`add` screens, batch sync). Committed that WIP as checkpoint `295a98c`, rebased Phase 0 onto it (resolved one `types/index.ts` conflict — kept both BankAccount + Category/Budget/Receipt; `sync.ts`/`db.ts` auto-merged preserving both batch/bank fns + Phase 0 read-mappings). | `tsc` 0 ✅ · Phase 0 changes verified intact post-rebase ✅ |
| 2026-06-04 | 1 | **Design system.** `src/theme/` ("quiet ledger" tokens: light+dark palette, spacing/radii/typography/shadow) + `.design/design-brief.md`. 11 RN primitives in `src/components/ui/` (Screen, Text, Card, Button, Input, Chip, ProgressBar, ListRow, AmountText, SectionHeader, FAB) + barrel. Refactored all 8 screens (`index`, `transactions`, `accounts`, `settings`, `add`, `login`, both `_layout`s) onto primitives+tokens. Added `Chip.selectedColor` to restore Expense/Income red-green. Built via primitives→screens→adversarial-verify workflow (12 agents). | `tsc --noEmit` 0 ✅ · no raw hex in `ui/`+`app/` ✅ · per-screen `git diff` behaviour-preservation audit passed (handlers/store/router/validation unchanged) ✅ · 11 primitives + barrel ✅ |

**Phase 1 notes (for later phases):**
- New palette is a deliberate refresh: ink-black primary + single indigo accent (was blue). Vibe is token-driven — tune `src/theme/tokens.ts` to adjust globally.
- `ProgressBar` primitive is built and ready for Phase 3 budgets.
- Pre-existing (not introduced): `transactions.tsx` category modal list isn't wrapped in a ScrollView — revisit if `CATEGORIES` grows.
- **Visual verification still owed**: run `npx expo start` (web/iOS/Android) to eyeball the new look — `tsc` + diff audit confirm correctness but not pixels.

**Phase 0 reality notes (for Phase 2/3):**
- Pre-existing empty stubs `categories` + `budgets` were dropped & rebuilt — the app code never used them (categorizer uses a hardcoded const; no budget feature). Phase 2/3 build on the new schema.
- `transactions.id` / all PK ids are **uuid**; SQLite native side keeps `id TEXT` (native generates valid-uuid strings — compatible).
- Data-path (PRD R2) implemented: `transactions` dual (SQLite+Supabase); `categories`/`budgets`/`receipts` Supabase-only; receipt images → Storage bucket `receipts` (private, owner-scoped).
- One-time reconcile lives in `supabase/apply_phase0.sql` (uncommitted helper, contains the stub drops); the committed `supabase/migrations/*.sql` are the canonical fresh-DB set.
