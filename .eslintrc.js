module.exports = {
  root: true,
  extends: '@react-native',
  rules: {
    // This codebase uses `void somePromise()` throughout to explicitly mark
    // an intentionally-unawaited async call (session/settings actions fired
    // from onPress handlers, etc.) — the same pattern typescript-eslint's
    // own no-floating-promises rule suggests as the fix. The base config's
    // no-void rule flags every one of those as a false positive.
    'no-void': 'off',
  },
};
