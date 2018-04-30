const isPromise = require('../isPromise')

test('It is a promise if has `then` and `catch` and they are functions', () => {
  const promiseLike = {
    then: () => {},
    catch: () => {}
  }

  expect(isPromise(promiseLike)).toBeTruthy()
})

test('It is not a promise otherwise', () => {
  const notPromises = [
    {
      then: 'not a function',
      catch: () => {}
    },
    {
      then: () => {},
      catch: 'not a function'
    },
    {
      then: () => {}
    },
    {
      catch: () => {}
    },
    {
      catch: () => {}
    }
  ]

  notPromises.forEach((obj) => {
    expect(isPromise(obj)).toBe(false)
  })
})
