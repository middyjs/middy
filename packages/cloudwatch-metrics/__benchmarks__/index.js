/*
import Benchmark from 'benchmark'
import middy from '../../core/index.js'
import middleware from '../index.js'

const suite = new Benchmark.Suite('@middy/cloudwatch-metrics')

const context = {
  getRemainingTimeInMillis: () => 30000
}
const setupHandler = () => {
  const baseHandler = () => {}
  return middy(baseHandler)
    .use(middleware({ namespace: 'namespace' }))
}

const warmHandler = setupHandler()

// TODO fix error
suite
  .add('Cold Invocation', async (event = {}) => {
    const coldHandler = setupHandler()
    try {
      await coldHandler(event, context)
    } catch (e) {}
  })
  .add('Warm Invocation', async (event = {}) => {
    try {
      await warmHandler(event, context)
    } catch (e) {}
  })
  .on('cycle', (event) => {
    console.log(suite.name, String(event.target))
  })
  .run({ async: true }) */
