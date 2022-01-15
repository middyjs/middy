import Benchmark from 'benchmark'

import { getInternal, processCache, jsonSafeParse, normalizeHttpResponse } from '../index.js'

const suite = new Benchmark.Suite('@middy/util')

suite
  .add('getInternal', async (event = {}) => {
    await getInternal(true, {
      internal: {
        key: Promise.resolve('value')
      }
    })
  })
  .add('processCache', async (event = {}) => {
    await processCache({ cacheExpiry: -1, cacheKey: 'key' })
  })
  .add('jsonSafeParse', async (event = {}) => {
    await jsonSafeParse('{"key":"value"}')
  })
  .add('normalizeHttpResponse', async (event = {}) => {
    await normalizeHttpResponse({})
  })
  .on('cycle', (event) => {
    console.log(suite.name, String(event.target))
  })
  .run({ async: true })
