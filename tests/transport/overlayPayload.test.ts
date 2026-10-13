import { screenToOverlayPayload } from '../../src/transport/overlayPayload';
import { UssdParser } from '../../src/engine/UssdParser';

describe('screenToOverlayPayload', () => {
  it('turns a parsed menu into tappable button entries carrying the numbers to send', () => {
    const screen = UssdParser.parse('1. Account info\n2. Tariff Plans\n3. Data Services', {
      serviceCode: '*123#',
      stepIndex: 0,
    });
    const p = screenToOverlayPayload(screen);
    const buttons = p.components.filter((c) => c.type === 'button');
    expect(buttons.length).toBe(3);
    expect(buttons[0]).toMatchObject({ type: 'button', input: '1' });
    expect(p.terminal).toBe(false);
  });

  it('marks final screens as terminal so the overlay shows Done instead of Cancel', () => {
    const screen = UssdParser.parse('MTN X main account: N-1389.76', { serviceCode: '*310#', stepIndex: 0 });
    expect(screenToOverlayPayload(screen).terminal).toBe(true);
  });
});
