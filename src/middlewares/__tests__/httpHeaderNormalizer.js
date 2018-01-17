const middy = require('../../middy')
const httpHeaderNormalizer = require('../httpHeaderNormalizer')

describe('👺 Middleware Http Header Normalizer', () => {
  test('It should normalize all the headers and create a copy in rawHeaders', (endTest) => {
    const handler = middy((event, context, cb) => cb(null, event))

    handler
      .use(httpHeaderNormalizer())

    const event = {
      headers: {
        'x-api-key': '123456',
        'tcn': 'abc',
        'te': 'cde',
        'DNS': 'd',
        'FOO': 'bar'
      }
    }

    const expectedHeaders = {
      'X-Api-Key': '123456',
      'TCN': 'abc',
      'TE': 'cde',
      'Dns': 'd',
      'Foo': 'bar'
    }

    const originalHeaders = Object.assign({}, event.headers)

    // run the handler
    handler(event, {}, (_, resultingEvent) => {
      expect(resultingEvent.headers).toEqual(expectedHeaders)
      expect(resultingEvent.rawHeaders).toEqual(originalHeaders)
      endTest()
    })
  })
})
