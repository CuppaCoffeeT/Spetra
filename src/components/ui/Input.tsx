import React, { useState } from 'react';
import {
  BlurEvent,
  FocusEvent,
  StyleProp,
  StyleSheet,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { radii, spacing, useColors } from '@/src/theme';
import { Text } from './Text';

export interface InputProps extends TextInputProps {
  label?: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  error?: string;
  containerStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<TextStyle>;
}

export const Input = React.forwardRef<TextInput, InputProps>(function Input(
  { label, value, onChangeText, placeholder, error, containerStyle, style, onFocus, onBlur, ...rest },
  ref
) {
  const c = useColors();
  const [focused, setFocused] = useState(false);

  const borderColor = error ? c.expense : focused ? c.accent : c.border;

  const handleFocus = (e: FocusEvent) => {
    setFocused(true);
    onFocus?.(e);
  };

  const handleBlur = (e: BlurEvent) => {
    setFocused(false);
    onBlur?.(e);
  };

  return (
    <View style={containerStyle}>
      {label != null && (
        <Text variant="label" color="muted" style={styles.label}>
          {label}
        </Text>
      )}
      <TextInput
        ref={ref}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={c.textMuted}
        onFocus={handleFocus}
        onBlur={handleBlur}
        style={[
          styles.input,
          { backgroundColor: c.surface, borderColor, color: c.textPrimary },
          style,
        ]}
        {...rest}
      />
      {error != null && (
        <Text variant="caption" color="expense" style={styles.error}>
          {error}
        </Text>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  label: {
    marginBottom: spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    fontSize: 16,
  },
  error: {
    marginTop: spacing.xs,
  },
});

export default Input;
