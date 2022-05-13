import Benchmark from 'benchmark'
import middy from '../../core/index.js'
import middleware from '../index.js'

const suite = new Benchmark.Suite('@middy/http-partial-response')

const context = {
  getRemainingTimeInMillis: () => 30000
}
const setupHandler = () => {
  const baseHandler = () => ({
    body: JSON.stringify({
      foo: 'bar',
      bar: 'foo'
    })
  })
  return middy(baseHandler)
    .use(middleware())
}

const warmHandler = setupHandler()

suite
  .add('Normalize Headers', async (event = {
    queryStringParameters: {
      fields: 'foo'
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
