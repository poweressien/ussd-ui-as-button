// Copyright (c) 2026 iWEKOBONGstudios. All rights reserved. See LICENSE.
/**
 * theme.ts
 * --------
 * A small, deliberate set of design tokens rather than default RN styling.
 * The palette leans into a "serious utility" feel — a dark, slightly warm
 * neutral base with one confident accent — instead of a generic light
 * Material/iOS default look. See docs/ARCHITECTURE.md for the UI rationale.
 */

export const colors = {
  bg: '#0F1115',
  surface: '#181B21',
  surfaceRaised: '#20242C',
  border: '#2A2F3A',
  textPrimary: '#F4F5F7',
  textSecondary: '#9AA1AE',
  textMuted: '#6B7280',
  accent: '#2FA36B', // confident green — reads as "telecom/finance utility", not playful
  accentMuted: '#1E7A4E',
  warning: '#E0A72E',
  danger: '#E0524A',
  success: '#2FA36B',
  overlay: 'rgba(15,17,21,0.72)',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 20,
  xl: 32,
};

export const radius = {
  sm: 8,
  md: 14,
  lg: 20,
  pill: 999,
};

export const typography = {
  title: { fontSize: 22, fontWeight: '700' as const, letterSpacing: -0.3 },
  subtitle: { fontSize: 15, fontWeight: '500' as const },
  body: { fontSize: 15, fontWeight: '400' as const },
  label: { fontSize: 12, fontWeight: '600' as const, letterSpacing: 0.6 },
  mono: { fontFamily: 'monospace', fontSize: 13 },
};
