import { useCallback, useEffect, useState } from 'react';
import {
  createCategory,
  deleteCategory,
  deleteRule,
  fetchCategories,
  fetchRules,
  updateCategory,
} from '../lib/api';
import type { Category, Rule } from '../lib/types';
import { Badge, Button, Card, PageTitle, Spinner, TextInput } from '../components/ui';

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
      await createCategory(userId, name, '#64748B', cats.length);
      setNewName('');
      load();
    } catch (e: any) {
      setError(e.message ?? 'Add failed');
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

  const removeRule = async (rule: Rule) => {
    await deleteRule(rule.id);
    setRules((rs) => rs.filter((r) => r.id !== rule.id));
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
            className="flex-1"
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
              <input
                type="color"
                value={c.color ?? '#64748B'}
                onChange={(e) => recolor(c, e.target.value)}
                className="h-6 w-8 cursor-pointer rounded border-0 bg-transparent p-0"
                title="Colour"
              />
              <TextInput
                defaultValue={c.name}
                onBlur={(e) => rename(c, e.target.value)}
                className="flex-1 border-transparent bg-transparent"
              />
              <Button variant="danger" onClick={() => removeCat(c)}>
                Delete
              </Button>
            </div>
          ))}
          {cats.length === 0 && (
            <p className="py-4 text-sm text-textMuted">
              No categories yet — sign in on the app once to seed defaults, or add your own above.
            </p>
          )}
        </div>
      </Card>

      <PageTitle>Learned rules</PageTitle>
      <Card>
        <p className="mb-4 text-sm text-textMuted">
          What the categorizer has learned. Merchant keywords map to categories; your corrections
          outrank AI guesses. Delete a rule to make the categorizer re-decide next time.
        </p>
        {rules.length === 0 ? (
          <p className="py-4 text-sm text-textMuted">
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
                  <div className="flex min-w-0 items-center gap-2">
                    <code className="rounded bg-surfaceAlt px-2 py-0.5 text-xs">{r.pattern}</code>
                    <span className="text-textMuted">→</span>
                    <span>{r.category}</span>
                    <Badge tone={src.tone === 'muted' ? undefined : src.tone}>{src.label}</Badge>
                  </div>
                  <Button variant="danger" onClick={() => removeRule(r)}>
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
