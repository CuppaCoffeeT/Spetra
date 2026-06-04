import { supabase } from './supabase';
import { DEFAULT_CATEGORIES } from '../services/categorizer';
import type { Category, CategoryInput } from '../types';

// Re-export so consumers can pull DEFAULT_CATEGORIES from the categories lib too.
// Source of truth lives in categorizer.ts; this is a passthrough (no duplication).
export { DEFAULT_CATEGORIES };

type CategoryRow = {
  id: string;
  user_id: string;
  name: string;
  color: string | null;
  icon: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

function mapRow(row: CategoryRow): Category {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    color: row.color,
    icon: row.icon,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getCategoriesFromSupabase(userId: string): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('user_id', userId)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (error) {
    console.error('Fetch categories failed:', error);
    return [];
  }

  return (data || []).map(mapRow);
}

export async function saveCategoryToSupabase(
  userId: string,
  input: CategoryInput
): Promise<Category | null> {
  const { data, error } = await supabase
    .from('categories')
    .insert({
      user_id: userId,
      name: input.name,
      color: input.color ?? null,
      icon: input.icon ?? null,
      sort_order: input.sortOrder ?? 0,
    })
    .select()
    .single();

  if (error) {
    console.error('Save category failed:', error);
    return null;
  }

  return mapRow(data);
}

export async function updateCategoryInSupabase(
  id: string,
  updates: Partial<CategoryInput>
): Promise<boolean> {
  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.color !== undefined) updateData.color = updates.color;
  if (updates.icon !== undefined) updateData.icon = updates.icon;
  if (updates.sortOrder !== undefined) updateData.sort_order = updates.sortOrder;

  const { error } = await supabase
    .from('categories')
    .update(updateData)
    .eq('id', id);

  if (error) {
    console.error('Update category failed:', error);
    return false;
  }
  return true;
}

export async function deleteCategoryFromSupabase(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('categories')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Delete category failed:', error);
    return false;
  }
  return true;
}

export async function seedDefaultCategories(userId: string): Promise<Category[]> {
  const rows = DEFAULT_CATEGORIES.map((c, index) => ({
    user_id: userId,
    name: c.name,
    color: c.color,
    icon: null,
    sort_order: index,
  }));

  const { error } = await supabase
    .from('categories')
    .upsert(rows, { onConflict: 'user_id,name', ignoreDuplicates: true });

  if (error) {
    console.error('Seed default categories failed:', error);
  }

  return getCategoriesFromSupabase(userId);
}
