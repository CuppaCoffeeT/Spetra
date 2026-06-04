import React from 'react';
import {
  ActivityIndicator,
  StyleProp,
  StyleSheet,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { radii, spacing, useColors } from '@/src/theme';
import { Text } from './Text';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';

export interface ButtonProps {
  title?: string;
  children?: React.ReactNode;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  left?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function Button({
  title,
  children,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  fullWidth = false,
  left,
  style,
}: ButtonProps) {
  const c = useColors();

  const variantStyle: ViewStyle =
    variant === 'primary'
      ? { backgroundColor: c.primary }
      : variant === 'secondary'
      ? { backgroundColor: c.surfaceAlt, borderWidth: 1, borderColor: c.border }
      : { backgroundColor: 'transparent' };

  const textColor =
    variant === 'primary'
      ? c.primaryText
      : variant === 'secondary'
      ? c.textPrimary
      : c.accent;

  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      disabled={isDisabled}
      style={[
        styles.base,
        variantStyle,
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <>
          {left}
          {children != null ? (
            children
          ) : (
            <Text variant="label" style={{ color: textColor }}>
              {title}
            </Text>
          )}
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
  disabled: {
    opacity: 0.5,
  },
});

export default Button;
