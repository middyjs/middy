import Benchmark from 'benchmark'
import middy from '../../core/index.js'
import middleware from '../index.js'

const suite = new Benchmark.Suite('@middy/error-logger')

const context = {
  getRemainingTimeInMillis: () => 30000
}
const setupHandler = () => {
  const baseHandler = () => { throw new Error() }
  return middy(baseHandler)
    .use(middleware({ logger: () => {} }))
}

const warmHandler = setupHandler()

suite
  .add('Catch Error', async (event = {}) => {
    try {
      await warmHandler(event, context)
    } catch (e) {}
  })
  .on('cycle', (event) => {
    console.log(suite.name, String(event.target))
  })
  .run({ async: true })
