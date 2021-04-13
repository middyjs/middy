const option1 = (string, reviver) => {
  try {
    return JSON.parse(string, reviver)
  } catch (e) {}

  return string
}

const option2 = (string, reviver) => {
  if (typeof string !== 'string') return string
  try {
    return JSON.parse(string, reviver)
  } catch (e) {}

  return string
}

const option3 = (string, reviver) => {
  if (typeof string !== 'string') return string
  const firstChar = string[0]
  if (firstChar !== '{' && firstChar !== '[' && firstChar !== '"') return string
  try {
    return JSON.parse(string, reviver)
  } catch (e) {}

  return string
}

const Benchmark = require('benchmark')

new Benchmark.Suite('JSON.parse', {})
  .add('option1 json', async () => {
    option1('{"hello":"world"}')
  })
  .add('option2 json', async () => {
    option2('{"hello":"world"}')
  })
  .add('option3 json', async () => {
    option3('{"hello":"world"}')
  })
  .add('option1 string', async () => {
    option1('hello world')
  })
  .add('option2 string', async () => {
    option2('hello world')
  })
  .add('option3 string', async () => {
    option3('hello world')
  })
  .add('option1 object', async () => {
    option1({ hello: 'world' })
  })
  .add('option2 object', async () => {
    option2({ hello: 'world' })
  })
  .add('option3 object', async () => {
    option3({ hello: 'world' })
  })
  // add listeners
  .on('cycle', (event) => {
    console.log(String(event.target))
  })
  .on('complete', function () {
    console.log('Fastest is ' + this.filter('fastest').map('name'))
  })
  // run async
  .run({ async: true })
