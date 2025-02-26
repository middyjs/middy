export default {
  '**/*.{json,yml}': ['prettier --write'],
  '**/*.{js,ts}': ['prettier --write', 'ts-standard --fix']
}
