import { AutoUssdTransport, AccessibilityChannel } from '../../src/transport/AutoUssdTransport';
import { UssdTransport } from '../../src/transport/UssdTransport';
import { UssdError, UssdTransportEvents } from '../../src/types/ussd';

/** A scriptable fake channel: tests decide what each call produces. */
class FakeChannel implements UssdTransport, AccessibilityChannel {
  readonly mode = 'REAL' as const;
  events!: UssdTransportEvents;
  enabled = true;
  stat: 'OFF' | 'STALE' | 'CONNECTED' = 'CONNECTED';
  async status() { return this.stat; }
  started: string[] = [];
  inputs: string[] = [];
  onStart: (code: string) => void = () => {};
  onInput: (input: string) => void = () => {};
  armed = 0;
  existing = false;
  presented: string[] = [];
  finished = 0;
  async armPassive() { this.armed += 1; }
  adoptCalls = 0;
  async adopt() { this.adoptCalls += 1; return true; }
  async adoptExistingDialog() { return this.existing; }
  presentScreen(screen: { title: string }) { this.presented.push(screen.title); }
  async finish() { this.finished += 1; }
  setListeners(e: UssdTransportEvents) { this.events = e; }
  async isEnabled() { return this.enabled; }
  async start(code: string) { this.started.push(code); this.onStart(code); }
  async sendInput(input: string) { this.inputs.push(input); this.onInput(input); }
  async cancel() { this.events.onSessionEnded(); }
}

function setup(preferred: 'DIRECT' | 'ACCESSIBILITY' | null = null, directFirst = true) {
  const direct = new FakeChannel();
  const a11y = new FakeChannel();
  const worked: string[] = [];
  const openDialer = jest.fn().mockResolvedValue(undefined);
  const auto = new AutoUssdTransport({
    direct, accessibility: a11y, preferred, directFirst, onChannelWorked: (c) => worked.push(c), openDialer,
  });
  const out = { responses: [] as string[], errors: [] as UssdError[] };
  auto.setListeners({
    onResponse: (r) => out.responses.push(r),
    onError: (e) => out.errors.push(e),
    onSessionEnded: () => {},
  });
  return { auto, direct, a11y, worked, openDialer, out };
}

const fail = (c: FakeChannel, code: UssdError['code'] = 'USSD_RETURN_FAILURE') =>
  c.events.onError({ code, message: 'x' });

describe('AutoUssdTransport', () => {
  it('adopts a pop-up dialled from the Phone app through accessibility and carries replies', async () => {
    const t = setup(null, false);
    await t.auto.adopt();
    expect(t.a11y.adoptCalls).toBe(1);
    expect(t.direct.started).toHaveLength(0);
    t.a11y.events.onResponse('1. Balance\n2. Data');
    expect(t.out.responses).toEqual(['1. Balance\n2. Data']);
    await t.auto.sendInput('2');
    expect(t.a11y.inputs).toEqual(['2']);
  });

  it('still dials when the service is switched on but not running (never refuses)', async () => {
    const t = setup(null, false);
    t.a11y.stat = 'STALE';
    t.a11y.enabled = false;
    t.direct.onStart = () => fail(t.direct);
    await t.auto.start('*966#', 1);
    expect(t.direct.started).toEqual(['*966#']);
    expect(t.openDialer).toHaveBeenCalledWith('*966#', 1);
    expect(t.out.errors[0].code).toBe('ASSISTED_DIALER');
  });

  it('goes straight to accessibility when it is on (the direct API cannot return menus)', async () => {
    const t = setup(null, false);
    t.a11y.onStart = () => t.a11y.events.onResponse('1. Balance');
    await t.auto.start('*123#', 0);
    expect(t.direct.started).toHaveLength(0);
    expect(t.out.responses).toEqual(['1. Balance']);
  });

  it('falls back to the direct API if accessibility cannot read a dialog', async () => {
    const t = setup(null, false);
    t.a11y.onStart = () => fail(t.a11y, 'UNKNOWN');
    t.direct.onStart = () => t.direct.events.onResponse('One-shot answer');
    await t.auto.start('*556#', 0);
    expect(t.out.responses).toEqual(['One-shot answer']);
  });

  it('uses the direct channel when it works and remembers it', async () => {
    const t = setup();
    t.direct.onStart = () => t.direct.events.onResponse('1. Balance');
    await t.auto.start('*894#', 0);
    expect(t.out.responses).toEqual(['1. Balance']);
    expect(t.worked).toEqual(['DIRECT']);
    expect(t.a11y.started).toHaveLength(0);
  });

  it('fails over to accessibility when the direct API is rejected', async () => {
    const t = setup();
    t.direct.onStart = () => fail(t.direct);
    t.a11y.onStart = () => t.a11y.events.onResponse('Menu via a11y');
    await t.auto.start('*894#', 1);
    expect(t.a11y.started).toEqual(['*894#']);
    expect(t.out.errors).toHaveLength(0);
    expect(t.out.responses).toEqual(['Menu via a11y']);
    expect(t.worked).toEqual(['ACCESSIBILITY']);
  });

  it('skips the direct channel when accessibility is the remembered preference', async () => {
    const t = setup('ACCESSIBILITY');
    t.a11y.onStart = () => t.a11y.events.onResponse('ok');
    await t.auto.start('*123#');
    expect(t.direct.started).toHaveLength(0);
    expect(t.out.responses).toEqual(['ok']);
  });

  it('hands off to the dialer when direct fails and accessibility is off', async () => {
    const t = setup();
    t.a11y.enabled = false;
    t.direct.onStart = () => fail(t.direct, 'USSD_ERROR_SERVICE_UNAVAIL');
    await t.auto.start('*894#');
    expect(t.openDialer).toHaveBeenCalledWith('*894#', 0);
    expect(t.out.errors[0].code).toBe('ASSISTED_DIALER');
  });

  it('surfaces the real error when every channel fails and accessibility was tried', async () => {
    const t = setup();
    t.direct.onStart = () => fail(t.direct);
    t.a11y.onStart = () => fail(t.a11y, 'UNKNOWN');
    await t.auto.start('*894#');
    expect(t.openDialer).not.toHaveBeenCalled();
    expect(t.out.errors).toHaveLength(1);
  });

  it('does not fail over on session-level errors like SESSION_ALREADY_ACTIVE', async () => {
    const t = setup();
    t.direct.onStart = () => fail(t.direct, 'SESSION_ALREADY_ACTIVE');
    await t.auto.start('*894#');
    expect(t.a11y.started).toHaveLength(0);
    expect(t.out.errors[0].code).toBe('SESSION_ALREADY_ACTIVE');
  });

  it('replays earlier inputs through accessibility when a direct reply is rejected, showing only the final screen', async () => {
    const t = setup();
    t.direct.onStart = () => t.direct.events.onResponse('Menu');
    await t.auto.start('*894#');
    expect(t.out.responses).toEqual(['Menu']);

    // reply 1 works on direct (single digit)
    t.direct.onInput = () => t.direct.events.onResponse('Enter number');
    await t.auto.sendInput('1');
    expect(t.out.responses).toEqual(['Menu', 'Enter number']);

    // the free-text reply is rejected by the direct API
    t.direct.onInput = () => fail(t.direct, 'UNSUPPORTED_CONTINUATION');
    // accessibility session: Menu -> (1) -> Enter number -> (0803) -> Enter amount
    const screens = ['Menu', 'Enter number', 'Enter amount'];
    let i = 0;
    t.a11y.onStart = () => t.a11y.events.onResponse(screens[i++]);
    t.a11y.onInput = () => t.a11y.events.onResponse(screens[i++]);
    await t.auto.sendInput('08030000000');
    await new Promise<void>((r) => setImmediate(() => r()));
    await new Promise<void>((r) => setImmediate(() => r()));

    expect(t.a11y.started).toEqual(['*894#']);
    expect(t.a11y.inputs).toEqual(['1', '08030000000']);
    // intermediate replayed screens were NOT surfaced
    expect(t.out.responses).toEqual(['Menu', 'Enter number', 'Enter amount']);
    expect(t.out.errors).toHaveLength(0);

    // later replies now go through accessibility
    t.a11y.onInput = () => t.a11y.events.onResponse('Confirm?');
    await t.auto.sendInput('5000');
    expect(t.a11y.inputs.slice(-1)).toEqual(['5000']);
    expect(t.out.responses.slice(-1)).toEqual(['Confirm?']);
  });

  it('reports an actionable error when a direct reply fails and accessibility is off', async () => {
    const t = setup();
    t.a11y.enabled = false;
    t.direct.onStart = () => t.direct.events.onResponse('Menu');
    await t.auto.start('*894#');
    t.direct.onInput = () => fail(t.direct, 'UNSUPPORTED_CONTINUATION');
    await t.auto.sendInput('08030000000');
    expect(t.out.errors[0].code).toBe('UNSUPPORTED_CONTINUATION');
    expect(t.out.errors[0].message).toMatch(/Accessibility Mode/);
  });

  it('ignores late events from a channel it already left', async () => {
    const t = setup();
    t.direct.onStart = () => fail(t.direct);
    t.a11y.onStart = () => t.a11y.events.onResponse('A11y menu');
    await t.auto.start('*894#');
    t.direct.events.onResponse('stale direct response');
    expect(t.out.responses).toEqual(['A11y menu']);
  });

  it('listens for the phone dialog before a direct attempt (passive arm)', async () => {
    const t = setup();
    t.direct.onStart = () => t.direct.events.onResponse('x');
    await t.auto.start('*123#');
    expect(t.a11y.armed).toBe(1);
  });

  it('adopts an accessibility response even while the direct channel is still active (direct hung)', async () => {
    const t = setup();
    // direct never answers; the phone shows its own dialog and the reader sees it
    t.direct.onStart = () => {};
    await t.auto.start('*123#');
    t.a11y.events.onResponse('1. Account info\n2. Tariff Plans');
    expect(t.out.responses).toEqual(['1. Account info\n2. Tariff Plans']);
    expect(t.worked).toEqual(['ACCESSIBILITY']);
    expect(t.auto.activeChannel).toBe('ACCESSIBILITY');
  });

  it('takes over a dialog already on screen instead of dialling twice when failing over', async () => {
    const t = setup();
    t.a11y.existing = true;
    t.direct.onStart = () => fail(t.direct);
    await t.auto.start('*123#');
    expect(t.a11y.started).toHaveLength(0);
  });

  it('forwards overlay taps and only presents/finishes through the accessibility channel', async () => {
    const t = setup();
    const actions: unknown[] = [];
    t.auto.setListeners({
      onResponse: () => {}, onError: () => {}, onSessionEnded: () => {},
      onOverlayAction: (a) => actions.push(a),
    });
    t.direct.onStart = () => t.direct.events.onResponse('direct menu');
    await t.auto.start('*123#');
    t.auto.presentScreen({ title: 'T' } as never);
    await t.auto.finish();
    expect(t.a11y.presented).toHaveLength(0); // direct channel active -> no overlay
    expect(t.a11y.finished).toBe(0);

    t.a11y.events.onOverlayAction?.({ kind: 'input', value: '2' });
    expect(actions).toEqual([{ kind: 'input', value: '2' }]);
  });
});
