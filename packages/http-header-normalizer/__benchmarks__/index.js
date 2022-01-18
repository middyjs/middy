import Benchmark from 'benchmark'
import middy from '../../core/index.js'
import middleware from '../index.js'

const suite = new Benchmark.Suite('@middy/http-header-normalizer')

const context = {
  getRemainingTimeInMillis: () => 30000
}
const setupHandler = () => {
  const baseHandler = () => { }
  return middy(baseHandler)
    .use(middleware())
}

const warmHandler = setupHandler()

suite
  .add('Normalize Headers', async (event = {
    headers: {
      accept: '*/*',
      'accept-encoding': 'gzip, deflate, br',
      'content-type': 'application/json',
      Host: '',
      'User-Agent': '',
      'X-Amzn-Trace-Id': ''
    }
  }) => {
    try {
      await warmHandler(event, context)
    } catch (e) {}
  })
  .on('cycle', (event) => {
    console.log(suite.name, String(event.target))
  })
  .run({ async: true })
