import { Bench } from 'tinybench'
import middy from '../../core/index.js'
import middleware from '../index.js'
import { transpileSchema } from '../transpile.js'

const bench = new Bench({ time: 1_000 })

const context = {
  getRemainingTimeInMillis: () => 30000
}
const setupHandler = () => {
  const baseHandler = () => {}
  return middy(baseHandler).use(
    middleware({
      eventSchema: transpileSchema({ type: 'object' }),
      responseSchema: transpileSchema({ type: 'object' })
    })
  )
}

const warmHandler = setupHandler()

await bench
  .add('type check input & output', async (event = {}) => {
    try {
      await warmHandler(event, context)
    } catch (e) {}
  })

  .run()

console.table(bench.table())
