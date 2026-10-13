// Copyright (c) 2026 iWEKOBONGstudios. All rights reserved. See LICENSE.
import { ScreenMessage } from '../types/ussd';

/**
 * The generic, parser-independent description of a screen that the native
 * overlay (UssdOverlay.kt) knows how to draw. The parser, carrier profiles
 * and flow engine stay in TypeScript; native only renders this.
 */
export interface OverlayPayload {
  title: string;
  text: string;
  terminal: boolean;
  error: boolean;
  components: Array<
    | { type: 'button'; label: string; input: string }
    | { type: 'confirm'; confirmLabel: string; confirmInput: string; cancelLabel: string; cancelInput: string }
    | { type: 'input'; title: string; sensitive: boolean; numeric: boolean }
  >;
}

export function screenToOverlayPayload(screen: ScreenMessage): OverlayPayload {
  const textParts: string[] = [];
  const components: OverlayPayload['components'] = [];

  for (const c of screen.components) {
    switch (c.type) {
      case 'text':
        textParts.push(c.text);
        break;
      case 'button':
        components.push({ type: 'button', label: c.label, input: c.input });
        break;
      case 'confirm':
        components.push({
          type: 'confirm',
          confirmLabel: c.confirmLabel,
          confirmInput: c.confirmInput,
          cancelLabel: c.cancelLabel,
          cancelInput: c.cancelInput,
        });
        break;
      case 'input':
        components.push({
          type: 'input',
          title: c.title,
          sensitive: c.sensitive,
          numeric: c.inputType === 'numeric' || c.inputType === 'pin',
        });
        break;
    }
  }

  return {
    title: screen.title,
    text: textParts.join('\n'),
    terminal: screen.isTerminal,
    error: screen.isError,
    components,
  };
}
