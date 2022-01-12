import Benchmark from 'benchmark'
import middy from '../index.js'

const suite = new Benchmark.Suite('@middy/core')

const setupHandler = () => {
  const baseHandler = () => {}
  return middy(baseHandler)
}

const warmHandler = setupHandler()

suite
  .add('Cold Invocation', async (event = {}) => {
    const coldHandler = setupHandler()
    await coldHandler(event)
  })
  .add('Warm Invocation', async (event = {}) => {
    await warmHandler(event)
  })
  .on('cycle', (event) => {
    console.log(suite.name, String(event.target))
  })
  .run({ async: true })
