import { Bench } from 'tinybench'
import middy from '../../core/index.js'
import middleware from '../index.js'

const bench = new Bench({ time: 1_000 })

const context = {
  getRemainingTimeInMillis: () => 30000
}
const setupHandler = () => {
  const baseHandler = () => {}
  return middy(baseHandler).use(middleware())
}

const warmHandler = setupHandler()

const event = {}
await bench
  .add('Normalize Event', async () => {
    try {
      await warmHandler(event, context)
    } catch (e) {}
  })

  .run()

console.table(bench.table())
