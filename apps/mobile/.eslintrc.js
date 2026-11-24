module.exports = {
  root: true,
  extends: ['universe/native'],
  rules: {
    // Removed in typescript-eslint v8 but still referenced by eslint-config-universe.
    '@typescript-eslint/ban-types': 'off',
  },
};
