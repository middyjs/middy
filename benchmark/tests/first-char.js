const option1 = (string) => {
  return string.charAt(0)
}

const option2 = (string) => {
  return string.substr(0, 1)
}

const option3 = (string) => {
  return string.slice(0, 1)
}
const option4 = (string) => {
  return string[0]
}

const Benchmark = require('benchmark')

new Benchmark.Suite('Get First Char', {})
  .add('option1', async () => {
    option1('hello')
  })
  .add('option2', async () => {
    option2('hello')
  })
  .add('option3', async () => {
    option3('hello')
  })
  .add('option4', async () => {
    option4('hello')
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
