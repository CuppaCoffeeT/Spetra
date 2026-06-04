import React from 'react';
import { StyleProp, TextStyle } from 'react-native';
import { useColors, type TypographyVariant } from '@/src/theme';
import { Text } from './Text';

export interface AmountTextProps {
  amount: number;
  direction?: 'in' | 'out';
  currency?: string;
  variant?: TypographyVariant;
  showSign?: boolean;
  style?: StyleProp<TextStyle>;
}

const SYMBOL_CURRENCIES = new Set(['SGD', 'USD', 'AUD']);

export function AmountText({
  amount,
  direction,
  currency = 'SGD',
  variant = 'body',
  showSign,
  style,
}: AmountTextProps) {
  const c = useColors();

  const color =
    direction === 'in'
      ? c.income
      : direction === 'out'
      ? c.expense
      : c.textPrimary;

  const symbol = SYMBOL_CURRENCIES.has(currency) ? '$' : `${currency} `;

  const shouldShowSign = showSign ?? !!direction;
  const sign = shouldShowSign
    ? direction === 'in'
      ? '+'
      : direction === 'out'
      ? '-'
      : ''
    : '';

  const text = `${sign}${symbol}${Math.abs(amount).toFixed(2)}`;

  return (
    <Text variant={variant} style={[{ color }, style]}>
      {text}
    </Text>
  );
}

export default AmountText;
