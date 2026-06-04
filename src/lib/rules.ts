import { supabase } from './supabase';
import { scoreCategory } from '../services/categorizer';
import type { Rule, RuleInput } from '../types';

type RuleRow = {
  id: string;
  user_id: string;
  pattern: string;
  category: string;
  priority: number;
  created_at: string;
  updated_at: string;
};

function mapRow(row: RuleRow): Rule {
  return {
    id: row.id,
    userId: row.user_id,
    pattern: row.pattern,
    category: row.category,
    priority: row.priority,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getRulesFromSupabase(userId: string): Promise<Rule[]> {
  const { data, error } = await supabase
    .from('rules')
    .select('*')
    .eq('user_id', userId)
    .order('priority', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Fetch rules failed:', error);
    return [];
  }

  return (data || []).map(mapRow);
}

export async function upsertRuleFromSupabase(
  userId: string,
  input: RuleInput
): Promise<Rule | null> {
  const { data, error } = await supabase
    .from('rules')
    .upsert(
      {
        user_id: userId,
        pattern: input.pattern,
        category: input.category,
        priority: input.priority ?? 100,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,pattern' }
    )
    .select()
    .single();

  if (error) {
    console.error('Upsert rule failed:', error);
    return null;
  }

  return mapRow(data);
}

export async function deleteRuleFromSupabase(id: string): Promise<boolean> {
  const { error } = await supabase.from('rules').delete().eq('id', id);

  if (error) {
    console.error('Delete rule failed:', error);
    return false;
  }
  return true;
}

// Derive a stable lowercase merchant key from a raw description. Non-alphanumeric
// runs become spaces; returns the first token of length >= 3, else ''.
// e.g. 'GRAB *RIDE SG' -> 'grab', 'NTUC FAIRPRICE' -> 'ntuc'.
export function extractMerchantKey(description: string): string {
  const tokens = description
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ');

  for (const token of tokens) {
    if (token.length >= 3) {
      return token;
    }
  }
  return '';
}

// Categorize text against learned rules first (highest-priority substring match
// wins, confidence 0.99). Rules are assumed pre-sorted by priority desc. Falls
// back to the built-in keyword scorer when no rule matches.
export function categorizeWithRules(
  text: string,
  rules: Rule[]
): { category: string; confidence: number } {
  const haystack = text.toLowerCase();

  for (const rule of rules) {
    if (rule.pattern && haystack.includes(rule.pattern)) {
      return { category: rule.category, confidence: 0.99 };
    }
  }

  return scoreCategory(text);
}
