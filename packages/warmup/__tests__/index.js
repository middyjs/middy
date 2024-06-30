import { test } from 'node:test'
import { equal } from 'node:assert/strict'

import middy from '../../core/index.js'
import warmup from '../index.js'

const defaultEvent = {}
const defaultContext = {
  getRemainingTimeInMillis: () => 1000
}

test("Should exit with 'warmup' if provided warmup check function is provide and returns true", async (t) => {
  const handler = middy(() => {})

  handler.use(
    warmup({
      isWarmingUp: () => true
    })
  )

  const response = await handler(defaultEvent, defaultContext)

  equal(response, 'warmup')
})

test("Should exit not with 'warmup' if provided warmup check function is provide and returns false", async (t) => {
  const handler = middy(() => {})

  handler.use(
    warmup({
      isWarmingUp: () => false
    })
  )

  const response = await handler(defaultEvent, defaultContext)

  equal(response, undefined)
})

test("Should exit with 'warmup' if event.source === 'serverless-plugin-warmup' if no warmup check function provided", async (t) => {
  const handler = middy(() => {})

  handler.use(warmup())

  const event = {
    source: 'serverless-plugin-warmup'
  }
  const response = await handler(event, defaultContext)

  equal(response, 'warmup')
})

test("Should not exit with 'warmup' if event.source !== 'serverless-plugin-warmup' if no warmup check function provided", async (t) => {
  const handler = middy(() => {})

  handler.use(warmup())

  const event = {
    source: 'warmup'
  }
  const response = await handler(event, defaultContext)

  equal(response, undefined)
})
