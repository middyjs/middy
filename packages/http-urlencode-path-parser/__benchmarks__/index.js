import Benchmark from 'benchmark'
import middy from '../../core/index.js'
import middleware from '../index.js'

const suite = new Benchmark.Suite('@middy/http-urlencode-path-parser')

const context = {
  getRemainingTimeInMillis: () => 30000
}
const setupHandler = () => {
  const baseHandler = () => { }
  return middy(baseHandler)
    .use(middleware())
}

const warmHandler = setupHandler()

suite
  .add('Parse body', async (event = {
    pathParameters: {
      char: 'M%C3%AEddy'
    }
  }) => {
    try {
      await warmHandler(event, context)
    } catch (e) {}
  })
  .on('cycle', (event) => {
    console.log(suite.name, String(event.target))
  })
  .run({ async: true })
