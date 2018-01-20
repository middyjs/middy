module.exports = wallaby => {
  process.env.NODE_ENV = 'test'

  return {
    testFramework: 'jest',
    files: ['package.json', 'src/**/*.js', '!src/**/__tests__/*.js'],
    tests: ['src/**/__tests__/*.js'],
    env: {
      type: 'node',
      runner: 'node'
    },
    compilers: {
      'src/**/*.js': wallaby.compilers.babel()
    },
    setup (wallaby) {
      wallaby.testFramework.configure(require('./package.json').jest)
    }
  }
}
