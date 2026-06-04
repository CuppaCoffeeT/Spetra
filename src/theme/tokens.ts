// Wallet design system — "quiet ledger": clean, minimal, calm.
// Influences: Dieter Rams functional minimalism + Swiss typographic clarity.
// Colors are scheme-aware (consume via useColors()). spacing / radii / typography /
// shadow are static. NO raw hex anywhere outside this file.

import type { TextStyle } from 'react-native';

export const palette = {
  light: {
    bg: '#FAFAF9',
    surface: '#FFFFFF',
    surfaceAlt: '#F4F4F2',
    border: '#E7E5E4',
    textPrimary: '#1C1917',
    textSecondary: '#57534E',
    textMuted: '#A8A29E',
    primary: '#1C1917',
    primaryText: '#FFFFFF',
    accent: '#4F46E5',
    accentText: '#FFFFFF',
    income: '#15803D',
    expense: '#DC2626',
    warning: '#D97706',
    overlay: 'rgba(0,0,0,0.4)',
  },
  dark: {
    bg: '#0C0A09',
    surface: '#1C1917',
    surfaceAlt: '#292524',
    border: '#292524',
    textPrimary: '#FAFAF9',
    textSecondary: '#A8A29E',
    textMuted: '#78716C',
    primary: '#FAFAF9',
    primaryText: '#1C1917',
    accent: '#818CF8',
    accentText: '#1C1917',
    income: '#4ADE80',
    expense: '#F87171',
    warning: '#FBBF24',
    overlay: 'rgba(0,0,0,0.6)',
  },
} as const;

export type ColorScheme = keyof typeof palette;
export type ColorToken = keyof typeof palette.light;
export type Colors = { readonly [K in ColorToken]: string };

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 9999,
} as const;

export const typography = {
  display: { fontSize: 32, fontWeight: '700', lineHeight: 38 },
  title: { fontSize: 24, fontWeight: '700', lineHeight: 30 },
  heading: { fontSize: 18, fontWeight: '600', lineHeight: 24 },
  body: { fontSize: 16, fontWeight: '400', lineHeight: 22 },
  label: { fontSize: 14, fontWeight: '600', lineHeight: 18 },
  caption: { fontSize: 12, fontWeight: '400', lineHeight: 16 },
} as const;

export type TypographyVariant = keyof typeof typography;

// Cast helper: spread a typography token into a RN TextStyle without fighting the
// literal fontWeight union. Usage: textStyle('body')
export function textStyle(variant: TypographyVariant): TextStyle {
  return typography[variant] as TextStyle;
}

export const shadow = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  fab: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 6,
  },
} as const;
