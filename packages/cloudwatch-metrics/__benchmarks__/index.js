/*
import { Bench } from 'tinybench'
import middy from '../../core/index.js'
import middleware from '../index.js'

const bench = new Bench({ time: 1_000 })

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
await bench
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

  .run()

console.table(bench.table()) */
