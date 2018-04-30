module.exports = () => {
  process.env.NODE_ENV = 'test'

  return {
    testFramework: 'jest',
    files: ['package.json', 'packages/**/*.js', '!packages/**/__tests__/*.js'],
    tests: ['packages/**/__tests__/*.js'],
    env: {
      type: 'node',
      runner: 'node'
    },
    setup (wallaby) {
      wallaby.testFramework.configure(require('./package.json').jest)
    }
  }
}
