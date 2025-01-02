import { test } from 'node:test'
import fc from 'fast-check'
import middy from '../../core/index.js'
import middleware from '../index.js'

const handler = middy((event) => event).use(middleware())
const context = {
  getRemainingTimeInMillis: () => 1000
}

test('fuzz `event` w/ `object`', async () => {
  fc.assert(
    fc.asyncProperty(fc.object(), async (event) => {
      try {
        await handler(event, context)
      } catch (e) {
        if (e.cause?.package !== '@middy/http-multipart-body-parser') {
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

test('fuzz `event` w/ `record`', async () => {
  fc.assert(
    fc.asyncProperty(
      fc.record({
        headers: fc.record({
          'content-type': fc.constant('multipart/form-data; boundary=')
        }),
        body: fc.string()
      }),
      async (event) => {
        try {
          await handler(event, context)
        } catch (e) {
          if (e.cause?.package !== '@middy/http-multipart-body-parser') {
            throw e
          }
        }
      }
    ),
    {
      numRuns: 100_000,
      verbose: 2,

      examples: []
    }
  )
})
