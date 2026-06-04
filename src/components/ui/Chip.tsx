import React from 'react';
import {
  StyleProp,
  StyleSheet,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { radii, spacing, useColors } from '@/src/theme';
import { Text } from './Text';

export interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  /** Background when selected; defaults to the accent colour. Use for semantic chips (e.g. income/expense). */
  selectedColor?: string;
  style?: StyleProp<ViewStyle>;
}

export function Chip({ label, selected = false, onPress, selectedColor, style }: ChipProps) {
  const c = useColors();

  const containerStyle: ViewStyle = selected
    ? { backgroundColor: selectedColor ?? c.accent }
    : { backgroundColor: c.surfaceAlt };

  const labelColor = selected ? c.accentText : c.textSecondary;

  const content = (
    <Text variant="label" style={{ color: labelColor }}>
      {label}
    </Text>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={onPress}
        style={[styles.base, containerStyle, style]}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return <View style={[styles.base, containerStyle, style]}>{content}</View>;
}

const styles = StyleSheet.create({
  base: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default Chip;
