
const loop = [...Array(1000).keys()]

const forIncrement = () => {
  for(let idx = 0, l = loop.length; idx<l; idx++) {
    const item = loop[idx]
  }
}

const forDecrement = () => {
  for(let idx = loop.length; --idx;) {
    const item = loop[idx]
  }
}

const forOf = () => {
  for(let item of loop){}
}

const forOfEntries = () => {
  for(let [idx,item] of loop.entries()){}
}

const map = () => {
  loop.map((item, idx) => {
    return item
  })
}

const forEach = () => {
  loop.forEach((item, idx) => {})
}

const Benchmark = require('benchmark')

new Benchmark.Suite('Get First Char', {})
  .add('forIncrement', async () => {
    forIncrement()
  })
  .add('forDecrement', async () => {
    forDecrement()
  })
  .add('forOf', async () => {
    forOf()
  })
  .add('forOfEntries', async () => {
    forOfEntries()
  })
  .add('map', async () => {
    map()
  })
  .add('forEach', async () => {
    forEach()
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
