import Benchmark from 'benchmark'
import middy from '../../core/index.js'
import router from '../index.js'

const suite = new Benchmark.Suite('@middy/ws-router')

const context = {
  getRemainingTimeInMillis: () => 30000
}
const setupHandler = () => {
  const handler = () => {}
  return middy(router([
    { routeKey: '$connect', handler },
    { routeKey: '$disconnect', handler },
    { routeKey: '$default', handler }
  ]))
}

const warmHandler = setupHandler()

suite
  .add('short static', async (event = { requestContext: { routeKey: '$connect' } }) => {
    try {
      await warmHandler(event, context)
    } catch (e) {}
  })
  .on('cycle', (event) => {
    console.log(suite.name, String(event.target))
  })
  .run({ async: true })
