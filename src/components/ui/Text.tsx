import React from 'react';
import {
  Text as RNText,
  type StyleProp,
  type TextProps as RNTextProps,
  type TextStyle,
} from 'react-native';
import { textStyle, useColors, type TypographyVariant } from '@/src/theme';

type TextColor =
  | 'primary'
  | 'secondary'
  | 'muted'
  | 'accent'
  | 'income'
  | 'expense'
  | 'warning';

export interface TextProps extends RNTextProps {
  variant?: TypographyVariant;
  color?: TextColor;
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  onPress?: RNTextProps['onPress'];
}

export function Text({
  variant = 'body',
  color = 'primary',
  children,
  style,
  numberOfLines,
  onPress,
  ...rest
}: TextProps) {
  const c = useColors();

  const colorMap: Record<TextColor, string> = {
    primary: c.textPrimary,
    secondary: c.textSecondary,
    muted: c.textMuted,
    accent: c.accent,
    income: c.income,
    expense: c.expense,
    warning: c.warning,
  };

  return (
    <RNText
      numberOfLines={numberOfLines}
      onPress={onPress}
      style={[textStyle(variant), { color: colorMap[color] }, style]}
      {...rest}
    >
      {children}
    </RNText>
  );
}

export default Text;
