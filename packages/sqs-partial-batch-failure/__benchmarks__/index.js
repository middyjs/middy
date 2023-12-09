import { Bench } from 'tinybench'
import middy from '../../core/index.js'
import middleware from '../index.js'

const bench = new Bench({ time: 1_000 })

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
  return middy(baseHandler).use(middleware())
}

const warmHandler = setupHandler()

await bench
  .add('process failures', async (event = {}) => {
    try {
      await warmHandler(event, context)
    } catch (e) {}
  })

  .run()

console.table(bench.table())
