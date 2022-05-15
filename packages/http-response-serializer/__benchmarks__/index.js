import Benchmark from 'benchmark'
import middy from '../../core/index.js'
import middleware from '../index.js'

const suite = new Benchmark.Suite('@middy/http-response-serializer')

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
  return middy(baseHandler).use(
    middleware({
      serializers: [
        {
          regex: /^application\/xml$/,
          serializer: ({ body }) => `<message>${body}</message>`
        },
        {
          regex: /^application\/json$/,
          serializer: ({ body }) => JSON.stringify(body)
        },
        {
          regex: /^text\/plain$/,
          serializer: ({ body }) => body
        }
      ],
      default: 'application/json'
    })
  )
}

const warmHandler = setupHandler()

suite
  .add('Serialize Response', async (event = {}) => {
    try {
      await warmHandler(event, context)
    } catch (e) {}
  })
  .on('cycle', (event) => {
    console.log(suite.name, String(event.target))
  })
  .run({ async: true })
