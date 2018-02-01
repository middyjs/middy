module.exports = () => {
  process.env.NODE_ENV = 'test'

  return {
    testFramework: 'jest',
    files: ['package.json', 'src/**/*.js', '!src/**/__tests__/*.js'],
    tests: ['src/**/__tests__/*.js'],
    env: {
      type: 'node',
      runner: 'node'
    },
    setup (wallaby) {
      wallaby.testFramework.configure(require('./package.json').jest)
    }
  }
}
