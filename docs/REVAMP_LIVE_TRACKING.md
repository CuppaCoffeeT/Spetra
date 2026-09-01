# Spend Tracker Revamp — Live Auto-Tracking, Self-Learning Categorizer, Line Items

**Created**: 2026-09-01 · **Status**: 🟡 In build (branch `revamp-live-tracking`)
**Supersedes**: parts of `WALLET_BUDGETING_APP_PRD.md` (D1 "on-device/free only" is lifted — a small LLM is now in scope by user request).

> Goal: when you tap your card (Apple Pay) or scan a PayNow QR, a transaction appears in the web
> app within seconds, auto-categorized. Manual entries and receipt scans fill the gaps, and every
> transaction can carry itemized line items. The categorizer learns from your corrections.

---

## Part 1 — How to auto-track spending: 3 options compared

Context: banks are UOB + Revolut, currency SGD, payments via Apple Pay tap + PayNow QR (bank app).
Today: the Expo app polls Gmail via OAuth **from the client** — nothing ingests unless the app is
open and synced. That's the core problem: ingestion must move server-side and become push-based.

### Option A — iOS Shortcuts "Transaction" automation → webhook

iOS 17+ Shortcuts has a **Transaction** personal-automation trigger: it fires whenever a selected
card/pass in Apple Wallet is used, passes the **merchant, amount, and card** as input, and can be
set to **Run Immediately** (no confirmation prompt). The shortcut body is just *Get Contents of URL*
→ POST JSON `{merchant, amount, card}` + a per-user secret to a Supabase Edge Function.

| | |
|---|---|
| **Latency** | Seconds after the tap. Truly "live" — fires on the device at payment time. |
| **Coverage** | Everything that goes through Apple Wallet: in-store tap (iPhone/Watch), and Apple Pay in-app/web. **Not** PayNow QR, not physical-card swipes, not bank transfers. |
| **Data quality** | Merchant name as the network reports it (clean-ish), exact amount, card. No line items. |
| **Cost / infra** | Free. No server to run beyond the Supabase function. One-time Shortcut setup per device. |
| **Risks** | Apple could change the trigger; automation silently off after major iOS updates (rare); per-card setup. |

### Option B — Bank alert emails → push webhook (server-side email ingestion)

Keep the "any transaction ≥ $0.01 sends an email" bank setting, but stop polling Gmail from the
client. Instead the email is **pushed** to a parser the moment it arrives:

- **B1 (chosen flavor): Cloudflare Email Routing + Email Worker.** A free address on a domain you
  control (e.g. `txn@yourdomain.com`). A Gmail filter auto-forwards bank alerts to it (or set the
  bank's alert email to it directly). The Worker parses the email (PostalMime) and POSTs the raw
  text to the same Supabase ingest function. Free tier is more than enough.
- **B2: Gmail API watch → Google Pub/Sub → webhook.** No forwarding, but needs a GCP project,
  Pub/Sub topic, and a watch renewal cron every 7 days. More moving parts, same result.
- **B3 (fallback, exists today): client-side Gmail polling** — kept as a manual "Sync" button.

| | |
|---|---|
| **Latency** | ~5–60s after the bank sends the alert (banks usually send within seconds of the transaction). |
| **Coverage** | **Everything the bank alerts on**: PayNow QR, card (incl. the same Apple Pay tap), NETS, transfers, GIRO — the widest net. |
| **Data quality** | Depends on the bank's email template — the existing `parser.ts` regexes already handle UOB + Revolut. No line items. |
| **Cost / infra** | Free (Cloudflare free tier + Supabase). Needs a domain on Cloudflare (~US$10/yr if you don't have one). |
| **Risks** | Bank changes its email template (parser tweak); forwarding chain adds a failure point. |

### Option C — Open banking / bank APIs (SGFinDex, Plaid, Finverse…)

The "proper" way: pull transactions from the bank ledger itself.

| | |
|---|---|
| **Latency** | Hours-to-a-day. These APIs sync on schedule; they are **not** live. |
| **Coverage** | Perfect — the actual ledger, every settled transaction, no parsing. |
| **Access reality (SG, 2026)** | **SGFinDex** is SingPass-based but only exposed to MAS-regulated participants' apps (DBS NAV Planner, OCBC OneView…) — no personal developer access. **Plaid/TrueLayer/Tink** have thin-to-no SG retail coverage. **Finverse** covers SG banks but is a B2B product with commercial pricing and review. |
| **Cost / infra** | Not attainable for a personal project at reasonable cost/effort. |
| **Risks** | Blocked on access, ongoing fees, and still not live. |

### ⚖️ Verdict

| Criterion | A: Shortcuts webhook | B: Email → webhook | C: Open banking |
|---|---|---|---|
| Live (< 1 min) | ✅ seconds | ✅ ~seconds–1 min | ❌ hours+ |
| Covers Apple Pay tap | ✅ | ✅ (via bank alert) | ✅ |
| Covers PayNow QR | ❌ | ✅ | ✅ |
| Personal-project feasible | ✅ free | ✅ free (+domain) | ❌ |
| Setup effort | 10 min once | ~30 min once | weeks + $$ |
| Fragility | low | low–medium | n/a |

**Decision: A + B together, deduped server-side.** They're complementary: A is instant and
high-fidelity for card taps; B catches PayNow and everything else. Both POST to **one** Supabase
Edge Function (`ingest`), which normalizes, categorizes, and **dedupes** (same amount ± same card
within a time window ⇒ the email enriches the Shortcut row instead of creating a duplicate).
C is rejected on access grounds alone. B3 (existing Gmail polling in the Expo app) stays untouched
as a manual backfill path.

---

## Part 2 — Self-learning categorizer ("mini language model", no external API required)

One shared categorization service (Edge Function `categorize`, also called inline by `ingest`),
four tiers — cheapest first (*revised 2026-09-01: local-first, Anthropic no longer required*):

1. **Learned rules** (existing `rules` table): merchant-key → category mappings.
   Confidence 0.99. *Written by every user correction (200) and cached verdicts (50).*
2. **Keyword scorer** (existing `scoreCategory` keyword sets, ported to the server): confidence 0.85.
3. **Embedding kNN (the local "mini language model")** — Supabase's **built-in `gte-small`**
   model runs *inside* the edge function (`Supabase.ai.Session`, free, no key, ~100–200ms) and
   embeds the merchant string; a pgvector RPC (`match_category_examples`) finds the nearest
   labeled examples (`category_examples`: seed phrases + every past correction + cached
   verdicts). Accepted at cosine ≥ 0.82; similarity = confidence. **This is the self-learning
   core: each correction adds a labeled vector, so coverage grows with use, and no data leaves
   your Supabase project.**
4. **Generative fallback (optional)** — only for brand-new merchants tiers 1–3 miss:
   Cloudflare **Workers AI** free tier (`llama-3.2-3b`, ~5–8k calls/day free, secrets
   `CF_ACCOUNT_ID`+`CF_API_TOKEN`), else Claude **Haiku** (`ANTHROPIC_API_KEY`). The verdict is
   cached as a priority-50 rule *and* an embedded example, so the same merchant never needs the
   fallback twice. With neither secret set, tiers 1–3 still work and unknowns go to review.

**The learning loop:** any manual re-categorization calls `categorize {action:'learn'}` →
priority-200 rule + embedded example — user corrections permanently outrank everything else.
Low-confidence results (< 0.6) are flagged `needs_review` and surfaced in a review queue rather
than silently mis-sorted. Starter examples are seeded (chunked) from Settings.

*Why embeddings + kNN rather than only a cached LLM?* It removes the external-API dependency
entirely for the live path, it's free at any volume, and it generalizes: one "SUSHI EXPRESS →
Food" correction also pulls in other sushi merchants by meaning, which exact merchant-key rules
can't do. Cold start is covered by seed phrases + the review queue.

---

## Part 3 — Manual entry, receipt OCR, and line items

- **Line items**: new `transaction_items` table (`transaction_id`, `name`, `qty`, `unit_price`,
  `amount`, optional per-item `category`). The transaction's `amount` stays canonical; items are
  detail. Any transaction — auto-ingested, manual, or scanned — can be itemized after the fact.
- **Manual entry**: the web app gets a first-class Add form (amount, direction, description,
  category w/ auto-suggest from the categorizer, date, notes, **+ add line items** rows).
- **Receipt OCR**: upload/photograph a receipt in the web app → Edge Function `parse-receipt`
  sends the image to Claude vision → structured JSON `{merchant, date, total, currency, items[]}`
  (the TaxHacker approach from the linked repo, minus the Next.js app around it) → prefills a
  transaction **with its line items** for review before save. Without an `ANTHROPIC_API_KEY` the
  web app degrades to manual entry (the Expo app's on-device tesseract path still exists for
  text-only OCR). The receipt image is stored and linked to the saved transaction.

---

## Architecture (target)

```
Apple Pay tap ──Shortcut──POST──┐
PayNow QR / any bank alert ─email→ Cloudflare Worker ─POST─┤
                                                           ▼
                                            Supabase Edge Fn: ingest
                                            (secret auth → parse → dedupe
                                             → categorize tiers 1-3 → insert)
                                                           ▼
Manual form / Receipt scan (web) ────────────────► transactions + transaction_items
                                                           ▼
                                              Web app (Vite+React, revamped):
                                              Dashboard · Transactions(+items, edit,
                                              review queue) · Add · Budgets ·
                                              Categories & Rules · Settings(setup)
```

**Schema changes** (additive migrations):
- `transaction_items` (new, RLS-scoped)
- `transactions` += `merchant`, `card_label`, `needs_review`, `source` gains `'shortcut'`
- `ingest_keys` (new): per-user webhook secrets for the Shortcut/Worker to authenticate
- `rules` += `source ('user'|'llm')` via priority convention (200 user / 50 llm)

**The Expo app is untouched** — same tables, so it keeps working; the web app becomes the primary.

## Rollout / user setup (once code is deployed)
1. Apply migrations (`supabase db push` or dashboard paste).
2. Deploy edge functions; set `ANTHROPIC_API_KEY` secret (optional but recommended).
3. Create your ingest key in the web app Settings → follow the in-app Shortcut setup guide.
4. (Email path) Add domain to Cloudflare → Email Routing → deploy the provided Worker with your
   ingest URL+key → Gmail filter: forward bank alerts to `txn@yourdomain`.
