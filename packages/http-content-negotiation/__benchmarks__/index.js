import Benchmark from 'benchmark'
import middy from '../../core/index.js'
import middleware from '../index.js'

const suite = new Benchmark.Suite('@middy/http-content-negotiation')

const context = {
  getRemainingTimeInMillis: () => 30000
}
const setupHandler = () => {
  const baseHandler = () => { }
  return middy(baseHandler)
    .use(middleware({
      availableCharsets: ['utf-8'],
      availableEncodings: ['br', 'gz'],
      availableLanguages: ['en-CA'],
      availableMediaTypes: ['text/plain', 'application/json']
    }))
}

const warmHandler = setupHandler()

suite
  .add('Parse Headers', async (event = {
    headers: {
      'Accept-Charset': 'utf-8, iso-8859-5, unicode-1-1;q=0.8',
      'Accept-Encoding': '*/*',
      'Accept-Language': 'da, en-gb;q=0.8, en;q=0.7',
      Accept: 'text/plain; q=0.5, text/html, text/x-dvi; q=0.8, text/x-c'
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
