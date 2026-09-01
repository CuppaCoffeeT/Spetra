// Cloudflare Email Worker: bank alert email -> Spend Tracker ingest webhook.
// Bind this worker to an Email Routing address (e.g. txn@yourdomain.com), then
// either auto-forward Gmail bank alerts to that address or point the bank's
// alert email at it directly.
//
// Secrets/vars (wrangler.toml [vars] or `wrangler secret put`):
//   INGEST_URL  - https://<project-ref>.supabase.co/functions/v1/ingest
//   INGEST_KEY  - your key from the web app: Settings -> Auto-tracking
//   FORWARD_TO  - optional: also forward the raw email to a real inbox
//                 (must be a verified destination address in Email Routing;
//                  REQUIRED once to receive Gmail's forwarding-confirmation code)

import PostalMime from 'postal-mime';

export default {
  async email(message, env, ctx) {
    // Keep a copy in a real inbox if configured (also catches Gmail's
    // "confirm forwarding" verification email during setup).
    if (env.FORWARD_TO) {
      ctx.waitUntil(message.forward(env.FORWARD_TO).catch(() => {}));
    }

    const parsed = await PostalMime.parse(message.raw);
    const text = parsed.text || (parsed.html ? parsed.html.replace(/<[^>]+>/g, ' ') : '');

    const res = await fetch(env.INGEST_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-ingest-key': env.INGEST_KEY,
      },
      body: JSON.stringify({
        type: 'email',
        subject: parsed.subject || message.headers.get('subject') || '',
        text,
        from: parsed.from?.address || message.from,
        receivedAt: parsed.date || new Date().toISOString(),
      }),
    });

    // Surface ingest failures in `wrangler tail` / dashboard logs.
    if (!res.ok) {
      console.error('ingest failed', res.status, await res.text());
    } else {
      console.log('ingest', res.status, await res.text());
    }
  },
};
