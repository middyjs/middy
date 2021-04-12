const option1 = (string) => {
  return string + ' world'
}

const option2 = (string) => {
  return `${string} world`
}

const option3 = (string) => {
  string += ' world'
  return string
}

const Benchmark = require('benchmark')

new Benchmark.Suite('String concat', {})
  .add('option1', async () => {
    option1('hello')
  })
  .add('option2', async () => {
    option2('hello')
  })
  .add('option3', async () => {
    option3('hello')
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
