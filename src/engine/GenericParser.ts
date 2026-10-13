// Copyright (c) 2026 iWEKOBONGstudios. All rights reserved. See LICENSE.
import { ScreenComponent, ScreenMessage, UssdInputKind } from '../types/ussd';

/**
 * GenericParser
 * -------------
 * Carrier-agnostic USSD text parser. This is the fallback every carrier
 * or service profile parser sits in front of (see ParserRegistry). It
 * makes no assumptions about which network or service produced the text —
 * only about the *shape* USSD menus tend to take.
 *
 * Detection order (first match wins):
 *   1. Numbered option lines ("1. Transfer", "2) Airtime", ...)      -> screen (buttons)
 *   2. A single confirm-style yes/no prompt with no numbered list    -> confirm
 *   3. A prompt that reads as "enter <something>"                   -> input
 *   4. Recognisable terminal / success language                     -> terminal
 *   5. Recognisable failure language                                -> error
 *   6. A bare balance/account display with no request language      -> terminal
 *   7. Anything else                                                -> input (free text fallback)
 *
 * Nothing here is a single universal regex — each rule is independent and
 * testable on its own (see tests/parser/genericParser.test.ts), and carrier
 * or service profiles can short-circuit any of these rules for text they
 * recognise more specifically.
 */

// Accepts "1. Transfer", "1) Transfer", "1: Transfer" and the punctuation-free
// "1 Transfer" style some carriers use. Requires the label to start with a
// letter so a bare number (an echoed account number, a balance figure) on
// its own line is never mistaken for a menu option.
const OPTION_LINE = /^\s*(\d{1,2})[.):]?\s+([A-Za-z].*?)\s*$/;
// Explicit delimiter, with or without a space: "1.Balance", "(2) Data", "3 - Voice",
// "0. Back", "#. Next". Label must start with a letter unless separated by a space.
const OPTION_DELIMITED = /^\s*[\[(]?(\d{1,2}|[*#])[\])]?\s*[.):\-–>]\s*(.+?)\s*$/;
// Several options squeezed onto one line: "1.Balance 2.Data 3.Voice".
const INLINE_OPTION = /(?:^|\s)(\d{1,2})[.)]\s*([A-Za-z][^\d]*?)(?=\s+\d{1,2}[.)]|\s*$)/g;

/** Menu-title lines some phone dialogs add around the carrier's own text. */
const DIALOG_TITLES = /^(carrier info|ussd message|ussd response|ussd code running\.*|network message|mobile network|service message)$/i;

// Navigation keys some menus list: "* Next", "# Home".
const OPTION_SYMBOL = /^\s*([*#])\s*[.):\-–>]?\s*([A-Za-z].*?)\s*$/;
// "4 10GB @N3000": a number then a label that starts with a digit. Only accepted when it sits
// next to other options (see adoptBareNumbered), so "5 000" or an echoed amount stays text.
const OPTION_BARE = /^\s*(\d{1,2})\s+(\d.*?)\s*$/;

function matchOption(line: string): { input: string; label: string } | null {
  const s = line.match(OPTION_SYMBOL);
  if (s) return { input: s[1], label: s[2] };
  const a = line.match(OPTION_LINE);
  if (a) return { input: a[1], label: a[2] };
  const b = line.match(OPTION_DELIMITED);
  if (b) {
    const label = b[2];
    // "12.50" or "2000" are amounts, not menu labels.
    if (/^[\d.,]+$/.test(label)) return null;
    // Digit straight after the delimiter ("12.50 NGN") reads as a number, not an option.
    if (/^\d/.test(label) && !/\s/.test(line.slice(line.indexOf(b[1]) + b[1].length).trimStart().slice(0, 2))) return null;
    if (!/\p{L}/u.test(label)) return null;
    return { input: b[1], label };
  }
  return null;
}

function expandInlineOptions(lines: string[]): string[] {
  const out: string[] = [];
  for (const line of lines) {
    if (matchOption(line)) {
      const inline = [...line.matchAll(INLINE_OPTION)];
      if (inline.length >= 2) {
        inline.forEach((m) => out.push(`${m[1]}. ${m[2].trim()}`));
        continue;
      }
    }
    out.push(line);
  }
  return out;
}

// "Press 1 for Balance, 2 for Data" / "For Balance press 1, for Data press 2".
const PROSE_VERB = /\b(?:press|reply|dial|enter|send|type)\s+\d{1,2}\s+(?:for|to)\b/i;
const PROSE_FOR = /(?:\b(?:press|reply|dial|enter|send|type)\s+)?\b(\d{1,2})\s+(?:for|to)\s+([^,;\n.]+)/gi;
const PROSE_PRESS = /for\s+([^,;\n]+?)[,\s]+(?:press|reply|dial|enter|send|type)\s+(\d{1,2})\b/gi;

function proseOptions(text: string): { input: string; label: string }[] {
  const a = PROSE_VERB.test(text)
    ? [...text.matchAll(PROSE_FOR)].map((m) => ({ input: m[1], label: m[2].trim() }))
    : [];
  if (a.length >= 2) return a;
  const b = [...text.matchAll(PROSE_PRESS)].map((m) => ({ input: m[2], label: m[1].trim() }));
  return b.length >= 2 ? b : [];
}

export function stripDialogTitle(raw: string): string {
  const lines = raw.replace(/\r\n/g, '\n').split('\n');
  while (lines.length > 1 && (lines[0].trim() === '' || DIALOG_TITLES.test(lines[0].trim()))) lines.shift();
  return lines.join('\n');
}

const ERROR_KEYWORDS = [
  'invalid',
  'incorrect',
  'error',
  'failed',
  'failure',
  'not available',
  'unable to process',
  'unable to complete',
  'try again later',
  'insufficient',
  'declined',
];

const TERMINAL_KEYWORDS = [
  'successful',
  'success',
  'thank you for using',
  'thanks for using',
  'completed successfully',
  'session ended',
  'has been credited',
  'has been debited',
];

// A bare balance/account figure with no request language is a display, not
// a prompt — see Rule 6 below. Deliberately specific phrases (not bare
// "account") so "Enter account number" is never mistaken for one of these.
const INFO_DISPLAY_KEYWORDS = [
  'balance',
  'main account',
  'account balance',
  'wallet balance',
  'available balance',
  'current balance',
];
const ASKS_FOR_REPLY = /\b(enter|input|type your|please provide|reply with)\b/i;

const CLOSING_PHRASES = [
  'sorry',
  'thank you',
  'thanks',
  'not eligible',
  'do not have access',
  "don't have access",
  'not authorized',
  'not authorised',
  'unauthorized',
  'check again later',
  'contact your',
  'please contact',
  'will be processed',
  'being processed',
  'request received',
];

const PIN_KEYWORDS = ['pin', 'password', 'otp', 'passcode'];
const NUMERIC_KEYWORDS = [
  'amount',
  'account number',
  'phone number',
  'account no',
  'number to',
  'enter otp',
  'meter number',
];

const CONFIRM_HINT = /confirm/i;
const CANCEL_WORD = /cancel|decline|reject|^no$/i;
const CONFIRM_WORD = /confirm|accept|proceed|^yes$/i;

function classifyInputKind(promptLower: string): UssdInputKind {
  if (PIN_KEYWORDS.some((k) => promptLower.includes(k))) return 'pin';
  if (NUMERIC_KEYWORDS.some((k) => promptLower.includes(k))) return 'numeric';
  // A lone trailing colon/prompt that only contains digits guidance also reads as numeric.
  if (/\bdigits?\b/.test(promptLower) || /\bnumber\b/.test(promptLower)) return 'numeric';
  return 'text';
}

function splitLines(raw: string): string[] {
  return raw
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

function containsAny(haystack: string, needles: string[]): boolean {
  return needles.some((n) => haystack.includes(n));
}

export class GenericParser {
  static readonly id = 'generic';

  static parse(raw: string): ScreenMessage {
    const text = stripDialogTitle((raw ?? '').toString());
    const lines = expandInlineOptions(splitLines(text));

    if (lines.length === 0) {
      return {
        type: 'error',
        title: 'Empty response',
        raw,
        components: [{ type: 'text', id: 'empty', text: 'The network returned an empty response.' }],
        isTerminal: false,
        isError: true,
        parsedBy: this.id,
      };
    }

    const lowerText = text.toLowerCase();
    const optionMatches: { input: string; label: string }[] = [];
    const nonOptionLines: string[] = [];

    const matched = lines.map((line) => matchOption(line));
    // Lines like "4 10GB @N3000" count as options when their number continues the list.
    let changed = true;
    while (changed) {
      changed = false;
      const nums = new Set(matched.filter((m): m is { input: string; label: string } => !!m).map((m) => Number(m.input)));
      lines.forEach((line, i) => {
        if (matched[i]) return;
        const b = line.match(OPTION_BARE);
        if (!b) return;
        const n = Number(b[1]);
        if (nums.has(n - 1) || nums.has(n + 1)) {
          matched[i] = { input: b[1], label: b[2] };
          changed = true;
        }
      });
    }
    lines.forEach((line, i) => {
      const match = matched[i];
      if (match) optionMatches.push(match);
      else nonOptionLines.push(line);
    });

    // A menu with no heading line gets a neutral title, never its first option.
    // Menus written as a sentence ("Press 1 for X, 2 for Y") when no numbered lines exist.
    let fromProse = false;
    if (optionMatches.length === 0) {
      const prose = proseOptions(text);
      if (prose.length >= 2) {
        optionMatches.push(...prose);
        fromProse = true;
      }
    }

    const title = nonOptionLines[0] ?? (optionMatches.length > 0 ? 'Select an option' : lines[0]);
    // Every non-option line other than the title is real content (balances,
    // instructions, footers). It is shown, never silently dropped.
    const bodyLines = fromProse ? nonOptionLines : nonOptionLines.slice(1);
    const bodyComponents: ScreenComponent[] = bodyLines.length
      ? [{ type: 'text', id: 'body', text: bodyLines.join('\n') }]
      : [];

    // ---- Rule 1: numbered options -> button screen (or confirm) ------------
    if (optionMatches.length > 0) {
      // A two-option list where one label reads as "confirm" and the other as
      // "cancel" is a confirm screen wearing a menu's clothing. Render it with
      // UssdConfirm instead of two plain UssdButtons, but the input values are
      // still whatever the network actually numbered them — never assumed.
      if (optionMatches.length === 2) {
        const confirmOpt = optionMatches.find((o) => CONFIRM_WORD.test(o.label));
        const cancelOpt = optionMatches.find((o) => CANCEL_WORD.test(o.label));
        if (confirmOpt && cancelOpt) {
          return {
            type: 'confirm',
            title,
            raw,
            components: [
              ...bodyComponents,
              {
                type: 'confirm',
                id: 'confirm_action',
                title,
                confirmLabel: confirmOpt.label,
                confirmInput: confirmOpt.input,
                cancelLabel: cancelOpt.label,
                cancelInput: cancelOpt.input,
              },
            ],
            isTerminal: false,
            isError: false,
            parsedBy: this.id,
          };
        }
      }

      const components: ScreenComponent[] = [
        ...bodyComponents,
        ...optionMatches.map((opt): ScreenComponent => ({
          type: 'button',
          id: `option_${opt.input}`,
          label: opt.label,
          input: opt.input,
        })),
      ];

      return {
        type: 'screen',
        title,
        raw,
        components,
        isTerminal: false,
        isError: containsAny(lowerText, ERROR_KEYWORDS),
        parsedBy: this.id,
      };
    }

    // ---- Rule 2: prose confirm prompt with no numbered list -----------------
    // e.g. "Confirm transfer of NGN5,000 to 0123456789? Reply 1 to confirm, 2 to cancel"
    // We already know there's no clean numbered list (rule 1 didn't match), so
    // any digits left in the text are just part of an amount/account number —
    // not a reason to skip this rule. We try to read the actual reply digits
    // out of the prose itself; only if that fails do we fall back to the 1/0
    // convention, which is a best-effort default, not a network-confirmed value.
    if (CONFIRM_HINT.test(lowerText)) {
      const confirmDigit = lowerText.match(/(\d+)\s*(?:to|[:=-])?\s*(?:confirm|accept|proceed)/);
      const cancelDigit = lowerText.match(/(\d+)\s*(?:to|[:=-])?\s*(?:cancel|decline|reject)/);

      return {
        type: 'confirm',
        title,
        raw,
        components: [
          ...bodyComponents,
          {
            type: 'confirm',
            id: 'confirm_action',
            title,
            confirmLabel: 'Confirm',
            confirmInput: confirmDigit?.[1] ?? '1',
            cancelLabel: 'Cancel',
            cancelInput: cancelDigit?.[1] ?? '0',
          },
        ],
        isTerminal: false,
        isError: false,
        parsedBy: this.id,
      };
    }

    // ---- Rule 4: terminal / success language, before treating as a prompt --
    if (containsAny(lowerText, TERMINAL_KEYWORDS)) {
      return {
        type: 'terminal',
        title,
        raw,
        components: [{ type: 'text', id: 'terminal_message', text }],
        isTerminal: true,
        isError: false,
        parsedBy: this.id,
      };
    }

    // ---- Rule 5: failure language -------------------------------------------
    if (containsAny(lowerText, ERROR_KEYWORDS)) {
      return {
        type: 'error',
        title,
        raw,
        components: [{ type: 'text', id: 'error_message', text }],
        isTerminal: true,
        isError: true,
        parsedBy: this.id,
      };
    }

    // ---- Rule 6: bare informational display (e.g. a balance figure) --------
    // A response like "Pulse main account: N14.53" isn't asking for
    // anything — it's just showing the user a number. It doesn't contain any
    // of the TERMINAL_KEYWORDS above (no "successful"/"completed"), so
    // without this rule it falls all the way through to the input fallback
    // and ends up asking the user to "reply" to their own balance, which is
    // exactly what a menu-free response with no request language should
    // never do. Gated on the absence of reply-asking language so a genuine
    // prompt like "Enter account number" is untouched.
    if (containsAny(lowerText, INFO_DISPLAY_KEYWORDS) && !ASKS_FOR_REPLY.test(lowerText)) {
      return {
        type: 'terminal',
        title,
        raw,
        components: [{ type: 'text', id: 'terminal_message', text }],
        isTerminal: true,
        isError: false,
        parsedBy: this.id,
      };
    }

    // ---- Rule 6b: a plain closing message is not a prompt ----------------------
    // "Sorry, you are not eligible...", "You do not have access...", "Thank you."
    // Nothing asks the person to type, so show it with Done, not an empty reply box.
    const lastLine = nonOptionLines[nonOptionLines.length - 1] ?? '';
    if (!ASKS_FOR_REPLY.test(lowerText) && !/[:?]\s*$/.test(lastLine) && containsAny(lowerText, CLOSING_PHRASES)) {
      return {
        type: 'terminal',
        title,
        raw,
        components: bodyComponents,
        isTerminal: true,
        isError: containsAny(lowerText, ['sorry', 'not eligible', 'do not have access', 'unauthorized', 'not authorized']),
        parsedBy: this.id,
      };
    }

    // ---- Rule 3 / fallback: treat as an input prompt ------------------------
    // Most single-line, option-free, non-terminal USSD screens are asking the
    // user to type something ("Enter amount", "Enter account number", or just
    // a bare prompt). We infer the input kind from keywords and default to
    // free text when nothing more specific matches.
    const inputKind = classifyInputKind(lowerText);
    return {
      type: 'input',
      title,
      raw,
      components: [
        // The last line becomes the field's label, so it is not repeated in the body.
        ...(nonOptionLines.length > 2
          ? [{ type: 'text' as const, id: 'body', text: nonOptionLines.slice(1, -1).join('\n') }]
          : []),
        {
          type: 'input',
          id: 'free_input',
          inputType: inputKind,
          // With a multi-line prompt the last line is the actual question.
          // The question is the last line; when it is already the screen title (single line) the
          // field needs no second label.
          title: nonOptionLines.length > 1 ? nonOptionLines[nonOptionLines.length - 1] : '',
          sensitive: inputKind === 'pin',
        },
      ],
      isTerminal: false,
      isError: false,
      parsedBy: this.id,
    };
  }
}
