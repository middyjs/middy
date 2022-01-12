import Benchmark from 'benchmark'
import middy from '../index.js'

const setupHandler = () => {
  const baseHandler = () => {}
  return middy(baseHandler)
}

const handler = setupHandler()


new Benchmark.Suite('e2e/aws-event', {})
  .add('Cold Invocation', async () => {
    const handler = setupHandler()
    await handler()
  })
  .add('Warm Invocation', async () => {
    await handler()
  })
  .on('cycle', (event) => {
    console.log(String(event.target))
  })
  .run({ async: true })
