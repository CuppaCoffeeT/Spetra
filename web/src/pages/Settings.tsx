import { useCallback, useEffect, useState } from 'react';
import {
  categorizerStatus,
  createIngestKey,
  deleteIngestKey,
  fetchIngestKeys,
  seedCategorizer,
} from '../lib/api';
import { supabase } from '../lib/supabase';
import { useTheme } from '../lib/useTheme';
import type { CategorizerStatus, IngestKey } from '../lib/types';
import { Badge, Button, Card, PageTitle, Spinner, TextInput } from '../components/ui';

const INGEST_URL = `${
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) ??
  'https://fpasfffeywotrclprcai.supabase.co'
}/functions/v1/ingest`;

function CopyButton({ text, className = '' }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="ghost"
      className={className}
      onClick={() => {
        navigator.clipboard
          .writeText(text)
          .then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          })
          .catch(() => {});
      }}
    >
      {copied ? 'Copied' : 'Copy'}
    </Button>
  );
}

function CategorizerCard() {
  const [status, setStatus] = useState<CategorizerStatus | null>(null);
  const [checked, setChecked] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    categorizerStatus().then((s) => {
      setStatus(s);
      setChecked(true);
    });
  }, []);

  const seed = async () => {
    setSeeding(true);
    setMsg(null);
    try {
      // Seeding is chunked server-side (embedding CPU limits) — loop until
      // done, but stop on stall (no progress) or after a sane number of
      // rounds; the server also 500s on a zero-progress batch.
      let remaining = Infinity;
      let total = 0;
      for (let round = 0; remaining > 0 && round < 12; round++) {
        const r = await seedCategorizer();
        if (r.seeded === 0 && r.remaining > 0) {
          throw new Error('Seeding stalled — embedding model unavailable?');
        }
        remaining = r.remaining;
        total = r.total;
        setMsg(`Seeding… ${total - remaining}/${total}`);
      }
      setMsg('Starter examples seeded.');
      setStatus(await categorizerStatus());
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Seeding failed.');
    } finally {
      setSeeding(false);
    }
  };

  return (
    <Card className="mb-6">
      <h2 className="mb-1 font-medium">Self-learning categorizer</h2>
      <p className="mb-3 text-sm text-textSecondary">
        Runs entirely inside your Supabase backend (built-in embedding model + your labeled
        history) — no external AI key needed. Every category correction you make becomes a labeled
        example, so it gets smarter with use.
      </p>
      {!checked ? (
        <Spinner />
      ) : status === null ? (
        <p className="text-sm text-warning">
          Categorizer function not reachable — deploy the edge functions first.
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <Badge>{status.examples} examples</Badge>
          <Badge tone="income">{status.corrections} from your corrections</Badge>
          <Badge>{status.seeds} starter seeds</Badge>
          <Button variant="ghost" onClick={seed} disabled={seeding}>
            {seeding ? 'Seeding…' : status.seeds > 0 ? 'Re-seed starters' : 'Seed starter examples'}
          </Button>
        </div>
      )}
      {msg && <p className="mt-2 text-sm text-textSecondary">{msg}</p>}
      <p className="mt-3 text-xs text-textMuted">
        Optional extras (function secrets): <code>CF_ACCOUNT_ID</code> + <code>CF_API_TOKEN</code>{' '}
        enable a free Cloudflare Workers AI fallback for brand-new merchants;{' '}
        <code>ANTHROPIC_API_KEY</code> enables Claude fallback + receipt line-item scanning. Without
        them, unknown merchants simply land in the review queue for a one-time correction.
      </p>
    </Card>
  );
}

const THEME_OPTIONS = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
] as const;

// Auto-tracking setup: ingest keys + the two live capture paths
// (iOS Shortcut for Apple Pay taps, email worker for bank alerts).
export default function Settings({ userId }: { userId: string }) {
  const [keys, setKeys] = useState<IngestKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [label, setLabel] = useState('');
  const { mode, setMode } = useTheme();

  const load = useCallback(
    () => fetchIngestKeys(userId).then(setKeys).finally(() => setLoading(false)),
    [userId]
  );
  useEffect(() => {
    load();
  }, [load]);

  const add = async () => {
    await createIngestKey(userId, label.trim() || 'default');
    setLabel('');
    load();
  };

  const revoke = async (k: IngestKey) => {
    if (!confirm(`Revoke key "${k.label ?? k.key.slice(0, 12)}"? Devices using it stop ingesting.`))
      return;
    await deleteIngestKey(k.id);
    load();
  };

  if (loading) return <Spinner />;

  const firstKey = keys[0]?.key ?? '<create a key above>';

  return (
    <div className="max-w-3xl">
      <PageTitle>Settings</PageTitle>

      <Card className="mb-6">
        <h2 className="mb-1 font-medium">Auto-tracking keys</h2>
        <p className="mb-4 text-sm text-textSecondary">
          Secrets that let your iPhone Shortcut and the email worker post transactions into your
          account. Treat them like passwords — revoke any that leak.
        </p>
        <div className="mb-4 flex gap-2">
          <TextInput
            value={label}
            placeholder='Label, e.g. "iPhone shortcut"'
            onChange={(e) => setLabel(e.target.value)}
            className="flex-1"
          />
          <Button onClick={add}>Create key</Button>
        </div>
        <div className="flex flex-col">
          {keys.map((k) => (
            <div
              key={k.id}
              className="border-b border-border py-3 text-sm last:border-0 sm:flex sm:items-center sm:justify-between sm:gap-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{k.label ?? 'unnamed'}</span>
                  {k.lastUsedAt ? (
                    <Badge tone="income">
                      last used {new Date(k.lastUsedAt).toLocaleDateString()}
                    </Badge>
                  ) : (
                    <Badge>never used</Badge>
                  )}
                </div>
                <code className="mt-1 inline-block max-w-full truncate rounded-lg bg-surfaceAlt px-2 py-1 align-bottom font-mono text-xs text-textSecondary">
                  {k.key}
                </code>
              </div>
              <div className="mt-2 flex shrink-0 gap-2 sm:mt-0">
                <CopyButton text={k.key} className="border border-border" />
                <Button variant="danger" className="ml-auto sm:ml-0" onClick={() => revoke(k)}>
                  Revoke
                </Button>
              </div>
            </div>
          ))}
          {keys.length === 0 && (
            <p className="py-2 text-sm text-textMuted">No keys yet — create one to start.</p>
          )}
        </div>
        <div className="mt-4 flex flex-col gap-2 rounded-lg bg-surfaceAlt p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <span className="text-textSecondary">Webhook URL: </span>
            <code className="break-all text-xs">{INGEST_URL}</code>
          </div>
          <div className="flex sm:shrink-0">
            <CopyButton text={INGEST_URL} className="border border-border" />
          </div>
        </div>
      </Card>

      <CategorizerCard />

      <Card className="mb-6">
        <h2 className="mb-1 font-medium">Live Apple Pay tracking (iOS Shortcut)</h2>
        <p className="mb-3 text-sm text-textSecondary">
          Every card tap creates a transaction here within seconds. One-time setup on your iPhone
          (iOS 17+):
        </p>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-textSecondary">
          <li>
            Open <b className="font-medium">Shortcuts</b> → <b className="font-medium">Automation</b>{' '}
            → <b className="font-medium">+</b> → <b className="font-medium">Transaction</b>.
          </li>
          <li>
            Select your card(s), keep <b className="font-medium">Anything</b> for merchant/category,
            choose <b className="font-medium">Run Immediately</b> (and turn off "Notify When Run" if
            offered).
          </li>
          <li>
            For the action, add <b className="font-medium">Get Contents of URL</b> and configure:
            <div className="mt-2 overflow-x-auto rounded-lg bg-surfaceAlt p-3 font-mono text-xs leading-relaxed">
              URL: <span className="break-all">{INGEST_URL}</span>
              <br />
              Method: POST
              <br />
              Headers: x-ingest-key = <span className="break-all">{firstKey}</span>
              <br />
              Request Body (JSON):
              <br />
              &nbsp;&nbsp;type: shortcut
              <br />
              &nbsp;&nbsp;merchant: [Shortcut Input → Merchant] <i>(magic variable)</i>
              <br />
              &nbsp;&nbsp;amount: [Shortcut Input → Amount]
              <br />
              &nbsp;&nbsp;card: [Shortcut Input → Card or Pass Name]
            </div>
          </li>
          <li>
            Tap to pay for something small — it should appear in Transactions in a few seconds.
          </li>
        </ol>
      </Card>

      <Card className="mb-6">
        <h2 className="mb-1 font-medium">Live PayNow &amp; bank-alert tracking (email)</h2>
        <p className="mb-3 text-sm text-textSecondary">
          Bank alert emails (PayNow QR, NETS, card, transfers) are parsed the moment they arrive and
          merged with Shortcut-tracked taps automatically. Setup lives in{' '}
          <code className="rounded bg-surfaceAlt px-1 text-xs">
            integrations/cloudflare-email-worker/README.md
          </code>{' '}
          in the repo — deploy the worker with a key from above, then forward bank alerts to your
          worker address.
        </p>
        <p className="text-sm text-textMuted">
          Keep your bank's alert threshold at the minimum (e.g. $0.01) so every transaction emails.
        </p>
      </Card>

      <Card>
        <h2 className="mb-3 font-medium">Account</h2>
        <div className="mb-4">
          <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.08em] text-textSecondary">
            Theme
          </p>
          <div className="flex items-center text-sm">
            {THEME_OPTIONS.map((opt, i) => (
              <span key={opt.value} className="flex items-center">
                {i > 0 && (
                  <span aria-hidden="true" className="px-1 text-textMuted">
                    ·
                  </span>
                )}
                <button
                  type="button"
                  aria-pressed={mode === opt.value}
                  onClick={() => setMode(opt.value)}
                  className={`-my-2 min-h-[44px] rounded-lg px-2 transition-colors duration-[160ms] ease-house focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-accent ${
                    mode === opt.value ? 'text-textPrimary' : 'text-textSecondary'
                  }`}
                >
                  {opt.label}
                </button>
              </span>
            ))}
          </div>
        </div>
        <Button variant="danger" onClick={() => supabase.auth.signOut()}>
          Sign out
        </Button>
      </Card>
    </div>
  );
}
