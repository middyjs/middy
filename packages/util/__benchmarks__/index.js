import { Bench } from 'tinybench'

import {
  getInternal,
  processCache,
  jsonSafeParse,
  normalizeHttpResponse
} from '../index.js'

const bench = new Bench({ time: 1_000 })

await bench
  .add('getInternal', async () => {
    await getInternal(true, {
      internal: {
        key: Promise.resolve('value')
      }
    })
  })
  .add('processCache', async () => {
    await processCache({ cacheExpiry: -1, cacheKey: 'key' })
  })
  .add('jsonSafeParse', async () => {
    await jsonSafeParse('{"key":"value"}')
  })
  .add('normalizeHttpResponse', async () => {
    await normalizeHttpResponse({})
  })

  .run()

console.table(bench.table())
