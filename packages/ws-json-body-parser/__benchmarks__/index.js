import Benchmark from 'benchmark'
import middy from '../../core/index.js'
import middleware from '../index.js'

const suite = new Benchmark.Suite('@middy/ws-json-body-parser')

const context = {
  getRemainingTimeInMillis: () => 30000
}
const setupHandler = () => {
  return middy().use(middleware())
}

const warmHandler = setupHandler()

suite
  .add(
    'Parse body',
    async (
      event = {
        body: '{ "action": "message", "message":"hello" }'
      }
    ) => {
      try {
        await warmHandler(event, context)
      } catch (e) {}
    }
  )
  .on('cycle', (event) => {
    console.log(suite.name, String(event.target))
  })
  .run({ async: true })
