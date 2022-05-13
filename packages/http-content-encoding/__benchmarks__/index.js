import Benchmark from 'benchmark'
import middy from '../../core/index.js'
import middleware from '../index.js'

const suite = new Benchmark.Suite('@middy/http-content-encoding')

const context = {
  getRemainingTimeInMillis: () => 30000
}
const setupHandler = (options) => {
  const baseHandler = () => { return JSON.stringify(new Array(100000).fill(0)) }
  return middy(baseHandler)
    .use(middleware(options))
}

const gzHandler = setupHandler({ preferredEncoding: 'gz' })
const brHandler = setupHandler({ preferredEncoding: 'br' })

suite
  .add('gzip Response', async (event = {}) => {
    try {
      await gzHandler(event, context)
    } catch (e) {}
  })
  .add('brotli Response', async (event = {}) => {
    try {
      await brHandler(event, context)
    } catch (e) {}
  })
  .on('cycle', (event) => {
    console.log(suite.name, String(event.target))
  })
  .run({ async: true })
