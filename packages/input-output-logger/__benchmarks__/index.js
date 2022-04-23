import Benchmark from 'benchmark'
import middy from '../../core/index.js'
import middleware from '../index.js'

const suite = new Benchmark.Suite('@middy/input-output-logger')

const context = {
  getRemainingTimeInMillis: () => 30000,
  functionName: 'benchmark'
}
const setupHandler = (options) => {
  const baseHandler = (event) => event
  return middy(baseHandler).use(
    middleware({
      logger: () => {},
      ...options
    })
  )
}

const warmHandler = setupHandler()
const shallowHandler = setupHandler({
  awsContext: ['functionName'],
  omitPaths: ['event.zooloo', 'event.hoo', 'response.hoo']
})
const deepHandler = setupHandler({
  awsContext: ['functionName'],
  omitPaths: ['event.hoo', 'response.foo.[].foo']
})

suite
  .add('log objects', async (event = {}) => {
    try {
      await warmHandler(event, context)
    } catch (e) {}
  })
  .add(
    'omit shallow values',
    async (
      event = { foo: [{ foo: 'bar', fuu: { boo: 'baz' } }], hoo: false }
    ) => {
      try {
        await shallowHandler(event, context)
      } catch (e) {}
    }
  )
  .add(
    'omit deep values',
    async (
      event = { foo: [{ foo: 'bar', fuu: { boo: 'baz' } }], hoo: false }
    ) => {
      try {
        await deepHandler(event, context)
      } catch (e) {}
    }
  )
  .on('cycle', (event) => {
    console.log(suite.name, String(event.target))
  })
  .run({ async: true })
