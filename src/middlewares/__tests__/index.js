const { readdirSync } = require('fs')
const { join } = require('path')
const middlewares = require('..')

test('Middlewares is an object containing all the available middlewares', () => {
  expect(middlewares).toBeTruthy()
  const expectedMiddlewares = readdirSync(join(__dirname, '..'))
    .filter(name => name !== '__tests__' && name !== 'index.js')
    .map(name => name.replace(/.js$/, ''))

  console.log('Expected middlewares:', expectedMiddlewares)
  console.log('Middlewares:', middlewares)
  expect(Object.keys(middlewares)).toEqual(expectedMiddlewares)
})
