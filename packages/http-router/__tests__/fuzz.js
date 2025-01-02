import { test } from 'node:test'
import fc from 'fast-check'
import middy from '../../core/index.js'
import router from '../index.js'

const handler = middy(router())
const context = {
  getRemainingTimeInMillis: () => 1000
}

test('fuzz `event` w/ `object`', async () => {
  fc.assert(
    fc.asyncProperty(fc.object(), async (event) => {
      try {
        await handler(event, context)
      } catch (e) {
        if (e.cause?.package !== '@middy/http-router') {
          throw e
        }
      }
    }),
    {
      numRuns: 100_000,
      verbose: 2,

      examples: []
    }
  )
})

test("fuzz `event` w/ `record` ({version: '1.0'})", async () => {
  fc.assert(
    fc.asyncProperty(
      fc.record({
        httpMethod: fc.constantFrom(
          'HEAD',
          'OPTIONS',
          'GET',
          'POST',
          'PATCH',
          'DELETE',
          'TRACE',
          'CONNECT'
        ),
        path: fc.webPath()
      }),
      async (event) => {
        try {
          await handler(event, context)
        } catch (e) {
          if (e.cause?.package !== '@middy/http-router') {
            throw e
          }
        }
      }
    ),
    {
      numRuns: 100_000,
      verbose: 2,

      examples: [
        [{ httpMethod: 'valueOf', path: '/' }],
        [{ httpMethod: 'GET', path: 'valueOf' }]
      ]
    }
  )
})

test("fuzz `event` w/ `record` ({version: '2.0'})", async () => {
  fc.assert(
    fc.asyncProperty(
      fc.record({
        version: fc.constant('2.0'),
        requestContext: fc.record({
          http: fc.record({
            method: fc.constantFrom(
              'HEAD',
              'OPTIONS',
              'GET',
              'POST',
              'PATCH',
              'DELETE',
              'TRACE',
              'CONNECT'
            ),
            path: fc.webPath()
          })
        })
      }),
      async (event) => {
        try {
          await handler(event, context)
        } catch (e) {
          if (e.cause?.package !== '@middy/http-router') {
            throw e
          }
        }
      }
    ),
    {
      numRuns: 100_000,
      verbose: 2,

      examples: [
        [{ requestContext: { http: { method: 'valueOf', path: '/' } } }],
        [{ requestContext: { http: { method: 'GET', path: 'valueOf' } } }]
      ]
    }
  )
})

test("fuzz `event` w/ `record` ({version: 'vpc'})", async () => {
  fc.assert(
    fc.asyncProperty(
      fc.record({
        method: fc.constantFrom(
          'HEAD',
          'OPTIONS',
          'GET',
          'POST',
          'PATCH',
          'DELETE',
          'TRACE',
          'CONNECT'
        ),
        raw_path: fc.webPath() // TODO webUrl({ withDomain:false, withPath: true, withQueryParameters:true})
      }),
      async (event) => {
        try {
          await handler(event, context)
        } catch (e) {
          if (e.cause?.package !== '@middy/http-router') {
            throw e
          }
        }
      }
    ),
    {
      numRuns: 100_000,
      verbose: 2,

      examples: [
        [{ method: 'valueOf', raw_path: '?/' }],
        [{ method: 'GET', raw_path: '?valueOf' }]
      ]
    }
  )
})
