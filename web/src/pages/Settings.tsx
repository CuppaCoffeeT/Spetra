import { useCallback, useEffect, useState } from 'react';
import { createIngestKey, deleteIngestKey, fetchIngestKeys } from '../lib/api';
import { supabase } from '../lib/supabase';
import type { IngestKey } from '../lib/types';
import { Badge, Button, Card, PageTitle, Spinner, TextInput } from '../components/ui';

const INGEST_URL = `${
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) ??
  'https://fpasfffeywotrclprcai.supabase.co'
}/functions/v1/ingest`;

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="ghost"
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? 'Copied ✓' : 'Copy'}
    </Button>
  );
}

// Auto-tracking setup: ingest keys + the two live capture paths
// (iOS Shortcut for Apple Pay taps, email worker for bank alerts).
export default function Settings({ userId }: { userId: string }) {
  const [keys, setKeys] = useState<IngestKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [label, setLabel] = useState('');

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
        <h2 className="mb-1 font-semibold">Auto-tracking keys</h2>
        <p className="mb-4 text-sm text-textMuted">
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
              className="flex items-center justify-between gap-3 border-b border-border py-2 text-sm last:border-0"
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
                <code className="block truncate text-xs text-textMuted">{k.key}</code>
              </div>
              <div className="flex shrink-0 gap-1">
                <CopyButton text={k.key} />
                <Button variant="danger" onClick={() => revoke(k)}>
                  Revoke
                </Button>
              </div>
            </div>
          ))}
          {keys.length === 0 && (
            <p className="py-2 text-sm text-textMuted">No keys yet — create one to start.</p>
          )}
        </div>
        <div className="mt-4 flex items-center justify-between gap-2 rounded-lg bg-surfaceAlt p-3 text-sm">
          <div className="min-w-0">
            <span className="text-textMuted">Webhook URL: </span>
            <code className="break-all text-xs">{INGEST_URL}</code>
          </div>
          <CopyButton text={INGEST_URL} />
        </div>
      </Card>

      <Card className="mb-6">
        <h2 className="mb-1 font-semibold">📱 Live Apple Pay tracking (iOS Shortcut)</h2>
        <p className="mb-3 text-sm text-textMuted">
          Every card tap creates a transaction here within seconds. One-time setup on your iPhone
          (iOS 17+):
        </p>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-textSecondary">
          <li>
            Open <b>Shortcuts</b> → <b>Automation</b> → <b>+</b> → <b>Transaction</b>.
          </li>
          <li>
            Select your card(s), keep <b>Anything</b> for merchant/category, choose{' '}
            <b>Run Immediately</b> (and turn off "Notify When Run" if offered).
          </li>
          <li>
            For the action, add <b>Get Contents of URL</b> and configure:
            <div className="mt-2 overflow-x-auto rounded-lg bg-surfaceAlt p-3 font-mono text-xs leading-relaxed">
              URL: {INGEST_URL}
              <br />
              Method: POST
              <br />
              Headers: x-ingest-key = {firstKey}
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
        <h2 className="mb-1 font-semibold">📧 Live PayNow &amp; bank-alert tracking (email)</h2>
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
        <h2 className="mb-3 font-semibold">Account</h2>
        <Button variant="danger" onClick={() => supabase.auth.signOut()}>
          Sign out
        </Button>
      </Card>
    </div>
  );
}
