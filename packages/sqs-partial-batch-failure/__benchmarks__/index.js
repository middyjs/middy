import Benchmark from 'benchmark'
import middy from '../../core/index.js'
import middleware from '../index.js'

const suite = new Benchmark.Suite('@middy/sqs-partial-batch-failure')

const context = {
  getRemainingTimeInMillis: () => 30000
}
const setupHandler = () => {
  const baseHandler = (event) => {
    const recordPromises = event.Records.map(async (record, index) => {
      return record
    })
    return Promise.allSettled(recordPromises)
  }
  return middy(baseHandler)
    .use(middleware())
}

const warmHandler = setupHandler()

suite
  .add('process failures', async (event = { }) => {
    try {
      await warmHandler(event, context)
    } catch (e) {}
  })
  .on('cycle', (event) => {
    console.log(suite.name, String(event.target))
  })
  .run({ async: true })
