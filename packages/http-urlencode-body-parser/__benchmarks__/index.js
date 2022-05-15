import Benchmark from 'benchmark'
import middy from '../../core/index.js'
import middleware from '../index.js'

const suite = new Benchmark.Suite('@middy/http-urlencode-body-parser')

const context = {
  getRemainingTimeInMillis: () => 30000
}
const setupHandler = () => {
  const baseHandler = () => {}
  return middy(baseHandler).use(middleware())
}

const warmHandler = setupHandler()

suite
  .add(
    'Parse body',
    async (
      event = {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
        },
        body: 'a[b][c][d]=i'
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
