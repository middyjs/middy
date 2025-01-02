import { test } from 'node:test'
import fc from 'fast-check'
import middy from '../../core/index.js'
import middleware from '../index.js'
import { transpileSchema } from '../transpile.js'

const eventSchema = transpileSchema({
  type: 'object',
  properties: {},
  maxProperties: 1
})
const handler = middy((event) => event).use(middleware({ eventSchema }))
const context = {
  getRemainingTimeInMillis: () => 1000
}

test('fuzz `event` w/ `object`', async () => {
  fc.assert(
    fc.asyncProperty(fc.object(), async (event) => {
      try {
        await handler(event, context)
      } catch (e) {
        if (e.cause?.package !== '@middy/validator') {
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
