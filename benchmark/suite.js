const Benchmark = require('benchmark')

// node suite.js {example}
const example = process.argv[2] ?? 'baseline'

const {
  handler: warmMiddleware,
  event: warmEvent,
  context: warmContext
} = require(`./examples/${example}`)
const {
  handler: warmMinMiddleware,
  event: warmMinEvent,
  context: warmMinContext
} = require(`./examples/${example}.min`)

console.log(`Running ${example} ...`)
new Benchmark.Suite(example, {})
  .add('Cold Start', async () => {
    const { handler, event, context } = require(`./examples/${example}`)
    await handler(event, context)
  })
  .add('Cold Start (min)', async () => {
    const { handler, event, context } = require(`./examples/${example}.min`)
    await handler(event, context)
  })
  .add('Warm Start', async () => {
    await warmMiddleware(warmEvent, warmContext)
  })
  .add('Warm Start (min)', async () => {
    await warmMinMiddleware(warmMinEvent, warmMinContext)
  })
  // add listeners
  .on('cycle', (event) => {
    console.log(String(event.target))
  })
  .on('complete', function () {
    // console.log('Fastest is ' + this.filter('fastest').map('name'))
  })
  // run async
  .run({ async: true })
