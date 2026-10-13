import { UssdSessionManager } from '../../src/engine/UssdSessionManager';
import { UssdTransport } from '../../src/transport/UssdTransport';

describe('replacing a transport', () => {
  it('disposes the old transport so it stops receiving native events', () => {
    const dispose = jest.fn();
    const fake: UssdTransport = {
      mode: 'REAL',
      setListeners: jest.fn(),
      start: jest.fn(async () => {}),
      sendInput: jest.fn(async () => {}),
      cancel: jest.fn(async () => {}),
      dispose,
    };
    const m = UssdSessionManager.createForTesting(fake);
    m.configureTransport('DEMO', false);
    expect(dispose).toHaveBeenCalledTimes(1);
  });
});
