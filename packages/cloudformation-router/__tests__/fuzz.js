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
        if (e.cause?.package !== '@middy/cloudformation-router') {
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
        RequestType: fc.string(),
        RequestId: fc.string(),
        LogicalResourceId: fc.string(),
        StackId: fc.string()
      }),
      async (event) => {
        try {
          await handler(event, context)
        } catch (e) {
          if (e.cause?.package !== '@middy/cloudformation-router') {
            throw e
          }
        }
      }
    ),
    {
      numRuns: 100_000,
      verbose: 2,
      examples: [[{ requestContext: { routeKey: 'valueOf' } }]]
    }
  )
})
