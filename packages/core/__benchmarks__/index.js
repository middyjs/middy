import Benchmark from 'benchmark'
import middy from '../index.js'

const suite = new Benchmark.Suite('@middy/core')

const context = {
  getRemainingTimeInMillis: () => 30000
}
const setupHandler = (timeoutEarlyInMillis = 0) => {
  const baseHandler = () => {}
  return middy(baseHandler, { timeoutEarlyInMillis })
}

const warmHandler = setupHandler()
const warmtimeoutHandler = setupHandler(1000)

suite
  .add('Cold Invocation', async (event = {}) => {
    const coldHandler = setupHandler()
    await coldHandler(event, context)
  })
  .add('Cold Invocation w/ Timeout', async (event = {}) => {
    const coldHandler = setupHandler(1000)
    await coldHandler(event, context)
  })
  .add('Warm Invocation', async (event = {}) => {
    await warmHandler(event, context)
  })
  .add('Warm Invocation with Timeout', async (event = {}) => {
    await warmtimeoutHandler(event, context)
  })
  .on('cycle', (event) => {
    console.log(suite.name, String(event.target))
  })
  .run({ async: true })
