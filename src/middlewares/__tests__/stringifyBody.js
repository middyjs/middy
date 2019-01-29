const middy = require('../../middy')
const stringifyBody = require('../stringifyBody')

describe('📦 Middleware stringifyBody', () => {
  test('It should stringify response body', () => {
    const handler = middy((event, context, cb) => {
      cb(null, { body: { foo: 'bar' } })
    })

    handler.use(stringifyBody())

    const event = {
      response: {}
    }

    handler(event, {}, (_, response) => {
      expect(response).toEqual({
        body: '{"foo":"bar"}'
      })
    })
  })

  test('It should not stringify response body if its string already', () => {
    const handler = middy((event, context, cb) => {
      cb(null, { body: 'hello world' })
    })

    handler.use(stringifyBody())

    const event = {
      response: {}
    }

    handler(event, {}, (_, response) => {
      expect(response).toEqual({
        body: 'hello world'
      })
    })
  })

  test('It should not stringify response body if no body was defined', () => {
    const handler = middy((event, context, cb) => {
      cb(null, {})
    })

    handler.use(stringifyBody())

    const event = {
      response: {}
    }

    handler(event, {}, (_, response) => {
      expect(response).toEqual({})
    })
  })
})
