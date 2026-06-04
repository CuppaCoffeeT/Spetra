import { useEffect, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Alert, Platform } from 'react-native';
import { useStore } from '../../src/store/useStore';
import type { Category } from '../../src/types';
import { Screen, Text, Input, Button, ListRow } from '@/src/components/ui';
import { spacing, radii, useColors } from '@/src/theme';

// Preset swatches used when creating/editing a category. These are DATA
// (selectable colour values stored on the category), so raw hex is allowed.
const CATEGORY_COLORS: string[] = [
  '#0EA5E9',
  '#16A34A',
  '#EC4899',
  '#F59E0B',
  '#6366F1',
  '#10B981',
  '#64748B',
  '#EF4444',
  '#8B5CF6',
  '#94A3B8',
];

function notify(title: string, message: string) {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
}

function confirm(title: string, message: string, onConfirm: () => void) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) {
      onConfirm();
    }
  } else {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: onConfirm },
    ]);
  }
}

export default function CategoriesScreen() {
  const { categories, loadCategories, addCategory, updateCategory, deleteCategory } = useStore();
  const c = useColors();

  const [name, setName] = useState('');
  const [selectedColor, setSelectedColor] = useState<string>(CATEGORY_COLORS[0]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadCategories();
  }, []);

  const resetForm = () => {
    setName('');
    setSelectedColor(CATEGORY_COLORS[0]);
    setEditingId(null);
  };

  const startEditing = (cat: Category) => {
    setEditingId(cat.id);
    setName(cat.name);
    setSelectedColor(cat.color ?? CATEGORY_COLORS[0]);
  };

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      notify('Error', 'Please enter a category name.');
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        const ok = await updateCategory(editingId, { name: trimmed, color: selectedColor });
        if (!ok) {
          notify('Error', 'Failed to save category.');
          return;
        }
      } else {
        const created = await addCategory({ name: trimmed, color: selectedColor });
        if (!created) {
          notify('Error', 'Failed to add category. The name may already exist.');
          return;
        }
      }
      resetForm();
    } catch (error) {
      notify('Error', (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (cat: Category) => {
    confirm('Delete Category', `Delete "${cat.name}"? Existing transactions keep their category.`, async () => {
      const ok = await deleteCategory(cat.id);
      if (!ok) {
        notify('Error', 'Failed to delete category.');
        return;
      }
      if (editingId === cat.id) {
        resetForm();
      }
    });
  };

  return (
    <Screen scroll padded>
      <Text variant="title" style={styles.title}>
        Categories
      </Text>

      {/* Existing categories */}
      <View style={styles.list}>
        {categories.map((cat) => (
          <ListRow
            key={cat.id}
            title={cat.name}
            left={
              <View
                style={[
                  styles.swatch,
                  { backgroundColor: cat.color ?? c.accent },
                ]}
              />
            }
            right={
              <Text color="expense" onPress={() => handleDelete(cat)}>
                Delete
              </Text>
            }
            onPress={() => startEditing(cat)}
          />
        ))}
      </View>

      {/* Add / edit form */}
      <Text variant="heading" style={styles.formTitle}>
        {editingId ? 'Edit Category' : 'New Category'}
      </Text>

      <Input
        label="Name"
        placeholder="Category name"
        value={name}
        onChangeText={setName}
        containerStyle={styles.field}
      />

      <Text variant="label" color="muted" style={styles.swatchLabel}>
        Color
      </Text>
      <View style={styles.swatchRow}>
        {CATEGORY_COLORS.map((color) => {
          const selected = selectedColor === color;
          return (
            <TouchableOpacity
              key={color}
              onPress={() => setSelectedColor(color)}
              style={[
                styles.swatchOption,
                { backgroundColor: color },
                selected && { borderColor: c.textPrimary, borderWidth: 3 },
              ]}
            />
          );
        })}
      </View>

      <Button
        title={editingId ? 'Save' : 'Add Category'}
        onPress={handleSubmit}
        disabled={saving}
        loading={saving}
        fullWidth
        style={styles.submitButton}
      />

      {editingId ? (
        <Button
          title="Cancel"
          variant="ghost"
          onPress={resetForm}
          fullWidth
          style={styles.cancelButton}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    marginBottom: spacing.xl,
  },
  list: {
    marginBottom: spacing.xl,
  },
  swatch: {
    width: 14,
    height: 14,
    borderRadius: radii.sm,
  },
  formTitle: {
    marginBottom: spacing.md,
  },
  field: {
    marginBottom: spacing.lg,
  },
  swatchLabel: {
    marginBottom: spacing.sm,
  },
  swatchRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  swatchOption: {
    width: 32,
    height: 32,
    borderRadius: radii.pill,
  },
  submitButton: {
    marginTop: spacing.sm,
  },
  cancelButton: {
    marginTop: spacing.sm,
  },
});
