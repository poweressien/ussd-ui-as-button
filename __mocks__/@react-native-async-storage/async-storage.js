// Manual Jest mock — in-memory stand-in for AsyncStorage so profile/settings
// persistence code can run under plain Jest without a device.
let store = {};

module.exports = {
  getItem: async (key) => (Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null),
  setItem: async (key, value) => {
    store[key] = value;
  },
  removeItem: async (key) => {
    delete store[key];
  },
  clear: async () => {
    store = {};
  },
  getAllKeys: async () => Object.keys(store),
};
