# Email → webhook bridge (Cloudflare Email Worker)

Turns any bank alert email into a live transaction in Spend Tracker.
Free tier is plenty. You need a domain on Cloudflare (nameservers pointed there).

## Setup (~15 min, once)

1. **Deploy the worker**
   ```bash
   cd integrations/cloudflare-email-worker
   npm install
   npx wrangler login
   npx wrangler secret put INGEST_KEY   # paste the key from web app Settings → Auto-tracking
   npm run deploy
   ```
2. **Create the email address** — Cloudflare dashboard → your domain →
   *Email* → *Email Routing*:
   - Enable Email Routing (it adds the MX records for you).
   - *Routing rules* → *Create address* → e.g. `txn@yourdomain.com` →
     action **Send to a Worker** → `spend-tracker-email-ingest`.
   - Under *Destination addresses*, verify your real inbox and set `FORWARD_TO`
     in `wrangler.toml` to it (needed for step 3's confirmation code), then
     `npm run deploy` again.
3. **Forward bank alerts from Gmail** — Gmail → Settings → *Forwarding* →
   *Add a forwarding address* → `txn@yourdomain.com`. The confirmation email
   lands in your `FORWARD_TO` inbox (the worker forwards it) — click the link.
   Then create a Gmail **filter**: `from:(uobgroup.com OR revolut.com)` →
   *Forward to* `txn@yourdomain.com`. Keep "never send to spam" checked.

   *Alternative:* set the bank's alert email address directly to
   `txn@yourdomain.com` (skips Gmail entirely; you lose the Gmail archive).
4. **Test** — send yourself any past UOB alert email to `txn@yourdomain.com`
   and watch it appear in the web app (`npm run tail` shows the worker logs).

## Notes

- The worker POSTs `{type:'email', subject, text, from, receivedAt}` to the
  Supabase `ingest` function with your `x-ingest-key`.
- Non-transaction emails are skipped by the parser server-side; duplicates
  (e.g. the Expo app's Gmail poll importing the same alert) are deduped by hash,
  and alerts for an Apple-Pay tap merge into the Shortcut-created transaction.
