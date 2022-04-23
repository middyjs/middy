export default {
  '**/*.{json,yml}': ['prettier --write'],
  '**/*.js': ['prettier --write', 'ts-standard --fix']
}
