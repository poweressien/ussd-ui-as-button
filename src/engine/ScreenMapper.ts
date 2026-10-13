// Copyright (c) 2026 iWEKOBONGstudios. All rights reserved. See LICENSE.
import { ScreenComponent, ScreenMessage } from '../types/ussd';

/**
 * ScreenMapper
 * ------------
 * Sits between the parser and the UI. The parser answers "what did the
 * network say" (a ScreenMessage); ScreenMapper answers "how should that be
 * laid out" (a RenderPlan). Keeping this separate means UssdScreen never
 * has to branch on ScreenKind itself — it just renders whatever plan comes
 * back, and the parser stays free of any React Native/layout concerns.
 */

export type RenderTone = 'neutral' | 'success' | 'error' | 'warning';

export interface RenderPlan {
  tone: RenderTone;
  heading: string;
  /** Components in the order they should render. */
  components: ScreenComponent[];
  /** Show the Back button (false on the first screen of a session, or a terminal screen). */
  showBack: boolean;
  /** Show the Cancel button (false once the session has already ended). */
  showCancel: boolean;
  /** True when nothing more can be tapped/typed — session is over. */
  isFinal: boolean;
}

export function mapScreenToRenderPlan(screen: ScreenMessage, stepIndex: number): RenderPlan {
  const tone: RenderTone = screen.isError
    ? 'error'
    : screen.type === 'terminal'
    ? 'success'
    : screen.type === 'unsupported'
    ? 'warning'
    : 'neutral';

  return {
    tone,
    heading: screen.title,
    components: screen.components,
    showBack: stepIndex > 0 && !screen.isTerminal,
    showCancel: !screen.isTerminal,
    isFinal: screen.isTerminal,
  };
}
