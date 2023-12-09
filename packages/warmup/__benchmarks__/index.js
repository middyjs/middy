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

await bench
  .add(
    'Change Context',
    async (
      event = {
        source: 'serverless-plugin-warmup'
      }
    ) => {
      try {
        await warmHandler(event, context)
      } catch (e) {}
    }
  )

  .run()

console.table(bench.table())
