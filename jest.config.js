/**
 * This config runs the engine-level test suite (tests/parser, tests/session,
 * tests/flow) under plain ts-jest + node — no RN runtime needed, since
 * UssdParser/FlowEngine/MockUssdTransport are pure TypeScript with no native
 * dependencies. React Native itself is still a real dependency of the app
 * (see package.json) and is resolved through the manual mock in __mocks__/
 * for the couple of modules (UssdSessionManager, NativeUssdTransport) that
 * import it, so those can be exercised too without a full Metro/device
 * environment. Component-level UI tests, if you add them later, should use
 * @testing-library/react-native with the `react-native` jest preset instead
 * of this config.
 */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'json'],
  clearMocks: true,
  verbose: true,
};
