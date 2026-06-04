import React from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { radii, shadow, spacing, useColors } from '@/src/theme';
import { Text } from './Text';

export interface FABProps {
  onPress: () => void;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function FAB({ onPress, icon, style }: FABProps) {
  const c = useColors();

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={[styles.fab, { backgroundColor: c.primary }, style]}
    >
      {icon ?? (
        <Text style={{ fontSize: 28, color: c.primaryText }}>+</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.fab,
  },
});

export default FAB;
