// Copyright (c) 2026 iWEKOBONGstudios. All rights reserved. See LICENSE.
/**
 * Built-in quick codes. These are the widely published short codes of Nigerian
 * banks and networks. Carriers change them now and then, so every one is just a
 * shortcut: it dials exactly what it says, nothing more. People can add their own.
 */
export interface QuickCode {
  label: string;
  code: string;
}

export type CategoryId = 'banks' | 'mtn' | 'airtel' | 'glo' | 't2' | 'mine';

export interface QuickCategory {
  id: Exclude<CategoryId, 'mine'>;
  title: string;
  codes: QuickCode[];
}

/**
 * Since 2023 Nigeria's regulator (NCC) has run the same short codes on every
 * network: *310# balance, *323# data balance, *312# data plans, *303# borrow,
 * *321# share, *305# services. Each network keeps one menu code of its own.
 */
const unified = (net: string): QuickCode[] => [
  { label: `${net} airtime balance`, code: '*310#' },
  { label: `${net} data balance`, code: '*323#' },
  { label: `${net} buy data`, code: '*312#' },
  { label: `${net} borrow`, code: '*303#' },
  { label: `${net} share airtime/data`, code: '*321#' },
];

export const BUILTIN_CATEGORIES: QuickCategory[] = [
  {
    id: 'banks',
    title: 'Banks',
    codes: [
      { label: 'GTBank', code: '*737#' },
      { label: 'First Bank', code: '*894#' },
      { label: 'Access Bank', code: '*901#' },
      { label: 'UBA', code: '*919#' },
      { label: 'Zenith', code: '*966#' },
      { label: 'Fidelity', code: '*770#' },
      { label: 'Sterling', code: '*822#' },
      { label: 'Wema', code: '*945#' },
      { label: 'Stanbic IBTC', code: '*909#' },
      { label: 'Polaris', code: '*833#' },
    ],
  },
  {
    id: 'mtn',
    title: 'MTN',
    codes: [...unified('MTN'), { label: 'MTN services', code: '*305#' }],
  },
  {
    id: 'airtel',
    title: 'Airtel',
    codes: [...unified('Airtel'), { label: 'Airtel menu', code: '*123#' }],
  },
  {
    id: 'glo',
    title: 'Glo',
    codes: [...unified('Glo'), { label: 'Glo menu', code: '*777#' }],
  },
  {
    id: 't2',
    title: '9mobile (T2)',
    codes: [...unified('9mobile'), { label: '9mobile menu', code: '*200#' }],
  },
];

/** What a USSD string may contain. Anything else is rejected, so a typo can't dial something odd. */
export function isDialable(code: string): boolean {
  return /^[0-9*#]+$/.test(code) && code.length >= 2 && code.length <= 40;
}

export function appendKey(buffer: string, key: string): string {
  if (!/^[0-9*#]$/.test(key)) return buffer;
  return buffer.length >= 40 ? buffer : buffer + key;
}

export function backspace(buffer: string): string {
  return buffer.slice(0, -1);
}

export function addCustomCode(list: QuickCode[], code: string, label?: string): QuickCode[] {
  if (!isDialable(code) || list.some((c) => c.code === code)) return list;
  return [...list, { code, label: (label ?? '').trim() || code }];
}

export function removeCustomCode(list: QuickCode[], code: string): QuickCode[] {
  return list.filter((c) => c.code !== code);
}
