// Manual Jest mock for the 'react-native' package. Jest auto-applies this to
// every `import ... from 'react-native'` in tests because it lives in a
// root-level __mocks__ folder next to node_modules — see
// https://jestjs.io/docs/manual-mocks#mocking-node-modules
//
// It deliberately mirrors what a *real* device without the native module
// linked looks like (NativeModules.UssdModule is undefined), so tests
// exercise the same "native module unavailable" fallback paths the app
// falls back on in that real situation.

class NativeEventEmitter {
  constructor(_nativeModule) {
    this._listeners = {};
  }
  addListener(eventType, handler) {
    (this._listeners[eventType] ??= []).push(handler);
    return { remove: () => {
      this._listeners[eventType] = (this._listeners[eventType] || []).filter((h) => h !== handler);
    } };
  }
  removeAllListeners(eventType) {
    delete this._listeners[eventType];
  }
  emit(eventType, payload) {
    (this._listeners[eventType] || []).forEach((h) => h(payload));
  }
}

module.exports = {
  NativeModules: {},
  NativeEventEmitter,
  Platform: { OS: 'android', select: (obj) => obj.android ?? obj.default },
};
