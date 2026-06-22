/** @type {import('lint-staged').Configuration} */
export default {
  '*.{ts,tsx}': ['eslint --fix', 'prettier --write'],
  '*.{json,css,yml,yaml}': ['prettier --write'],
};
