import { useCallback, useEffect, useState } from 'react';
import {
  createCategory,
  deleteCategory,
  deleteRule,
  fetchCategories,
  fetchRules,
  updateCategory,
} from '../lib/api';
import { supabase } from '../lib/supabase';
import { showToast } from '../lib/toastBus';
import type { Category, Rule } from '../lib/types';
import { Badge, Button, Card, PageTitle, Spinner, TextInput } from '../components/ui';

// Curated Private Ledger swatch cycle — muted, paper-friendly hues.
const SWATCHES = [
  '#8A6A43',
  '#3F6C50',
  '#5B6B8C',
  '#9C3F34',
  '#8A6116',
  '#6E5A78',
  '#4E7A72',
  '#7A5B4A',
];

const STARTERS = [
  'Food',
  'Transport',
  'Shopping',
  'Groceries',
  'Bills',
  'Entertainment',
  'Health',
  'Travel',
];

// First swatch no existing category uses; fall back to cycling.
function nextSwatch(cats: Category[]): string {
  const used = new Set(cats.map((c) => (c.color ?? '').toUpperCase()));
  return SWATCHES.find((s) => !used.has(s.toUpperCase())) ?? SWATCHES[cats.length % SWATCHES.length];
}

function ruleSource(priority: number): { label: string; tone: 'accent' | 'income' | 'muted' } {
  if (priority >= 200) return { label: 'your correction', tone: 'income' };
  if (priority <= 50) return { label: 'AI-learned', tone: 'accent' };
  return { label: 'rule', tone: 'muted' };
}

// Manage categories (colors, rename, add, delete) and the learned
// categorization rules — the memory of the self-learning categorizer.
export default function Categories({ userId }: { userId: string }) {
  const [cats, setCats] = useState<Category[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [seeding, setSeeding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    return Promise.all([fetchCategories(userId), fetchRules(userId)])
      .then(([c, r]) => {
        setCats(c);
        setRules(r);
      })
      .finally(() => setLoading(false));
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const add = async () => {
    const name = newName.trim();
    if (!name) return;
    setError(null);
    try {
      await createCategory(userId, name, nextSwatch(cats), cats.length);
      setNewName('');
      load();
    } catch (e: any) {
      setError(e.message ?? 'Add failed');
    }
  };

  const addStarters = async () => {
    setError(null);
    setSeeding(true);
    try {
      for (let i = 0; i < STARTERS.length; i++) {
        await createCategory(userId, STARTERS[i], SWATCHES[i % SWATCHES.length], i);
      }
      await load();
    } catch (e: any) {
      setError(e.message ?? 'Could not add starter categories');
    } finally {
      setSeeding(false);
    }
  };

  const rename = async (cat: Category, name: string) => {
    if (!name.trim() || name === cat.name) return;
    await updateCategory(cat.id, { name: name.trim() });
    load();
  };

  const recolor = async (cat: Category, color: string) => {
    await updateCategory(cat.id, { color });
    load();
  };

  const removeCat = async (cat: Category) => {
    if (!confirm(`Delete category "${cat.name}"? Existing transactions keep the name as text.`)) return;
    await deleteCategory(cat.id);
    load();
  };

  // Undo for the FORGOTTEN slip: re-insert the rule exactly as it was
  // (same pattern/category/priority), then refresh ids from the server.
  const restoreRule = async (rule: Rule) => {
    const { error } = await supabase.from('rules').upsert(
      {
        user_id: userId,
        pattern: rule.pattern,
        category: rule.category,
        priority: rule.priority,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,pattern' }
    );
    if (error) {
      showToast({ kind: 'note', tone: 'warning', message: 'Could not restore the rule.' });
      return;
    }
    setRules(await fetchRules(userId));
  };

  const removeRule = async (rule: Rule) => {
    const prev = rules;
    setRules((rs) => rs.filter((r) => r.id !== rule.id));
    try {
      await deleteRule(rule.id);
    } catch {
      setRules(prev);
      showToast({ kind: 'note', tone: 'warning', message: 'Could not forget — try again.' });
      return;
    }
    showToast({
      kind: 'note',
      label: 'FORGOTTEN',
      message: `${rule.pattern} → ${rule.category}`,
      action: { label: 'Undo', run: () => void restoreRule(rule) },
    });
  };

  if (loading) return <Spinner />;

  return (
    <div className="max-w-3xl">
      <PageTitle>Categories</PageTitle>

      <Card className="mb-6">
        <div className="mb-4 flex gap-2">
          <TextInput
            value={newName}
            placeholder="New category name"
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            className="min-w-0 flex-1"
          />
          <Button onClick={add}>Add</Button>
        </div>
        {error && <p className="mb-3 text-sm text-expense">{error}</p>}
        <div className="flex flex-col">
          {cats.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-3 border-b border-border py-2 last:border-0"
            >
              <label
                title="Colour"
                className="-m-2 grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-lg transition-colors duration-[160ms] ease-house hover:bg-surfaceAlt focus-within:ring-1 focus-within:ring-inset focus-within:ring-accent"
              >
                <span
                  aria-hidden="true"
                  className="h-6 w-6 rounded-full border border-border"
                  style={{ backgroundColor: c.color ?? SWATCHES[0] }}
                />
                <input
                  type="color"
                  value={c.color ?? SWATCHES[0]}
                  onChange={(e) => recolor(c, e.target.value)}
                  aria-label={`Colour for ${c.name}`}
                  className="sr-only"
                />
              </label>
              <TextInput
                defaultValue={c.name}
                onBlur={(e) => rename(c, e.target.value)}
                className="min-w-0 flex-1 border-transparent bg-transparent transition-colors duration-[160ms] ease-house hover:border-border"
              />
              <Button variant="danger" className="-my-0.5 min-h-[44px]" onClick={() => removeCat(c)}>
                Delete
              </Button>
            </div>
          ))}
          {cats.length === 0 && (
            <div className="flex flex-col items-start gap-3 py-4">
              <p className="text-sm text-textSecondary">
                No categories yet — add starter categories below, or create your own.
              </p>
              <Button
                variant="ghost"
                className="border border-border"
                onClick={addStarters}
                disabled={seeding}
              >
                {seeding ? 'Adding…' : 'Add starter categories'}
              </Button>
            </div>
          )}
        </div>
      </Card>

      <Card>
        <h2 className="mb-1 font-medium">Learned rules</h2>
        <p className="mb-4 text-sm text-textSecondary">
          What the categorizer has learned. Merchant keywords map to categories; your corrections
          outrank AI guesses. Delete a rule to make the categorizer re-decide next time.
        </p>
        {rules.length === 0 ? (
          <p className="py-4 text-sm text-textSecondary">
            Nothing learned yet — it fills up as transactions flow in and as you re-categorize.
          </p>
        ) : (
          <div className="flex flex-col">
            {rules.map((r) => {
              const src = ruleSource(r.priority);
              return (
                <div
                  key={r.id}
                  className="flex items-center justify-between gap-3 border-b border-border py-2 text-sm last:border-0"
                >
                  <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                    <code className="rounded bg-surfaceAlt px-2 py-0.5 text-xs">{r.pattern}</code>
                    <span className="text-textMuted">→</span>
                    <span className="truncate">{r.category}</span>
                    <Badge tone={src.tone === 'muted' ? undefined : src.tone}>{src.label}</Badge>
                  </div>
                  <Button
                    variant="danger"
                    className="-my-0.5 min-h-[44px]"
                    onClick={() => removeRule(r)}
                  >
                    Forget
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
