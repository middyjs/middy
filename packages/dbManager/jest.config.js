module.exports = {
  globals: {
    'ts-jest': {
      diagnostics: false,
      tsConfig: 'tsconfig.json'
    }
  },
  moduleFileExtensions: ['ts', 'js'],
  transform: {
    '^.+\\.(ts)$': 'ts-jest'
  },
  testEnvironment: 'node',
  clearMocks: false,
  preset: 'ts-jest'
}
