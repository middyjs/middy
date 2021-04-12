const loop = [...Array(1000).keys()]

const forIncrement = () => {
  for (let idx = 0, l = loop.length; idx < l; idx++) {
    const item = loop[idx]
    if (item) {
    }
  }
}

const forDecrement = () => {
  for (let idx = loop.length; --idx; ) {
    const item = loop[idx]
    if (item) {
    }
  }
}

const forOf = () => {
  for (const item of loop) {
    if (item) {
    }
  }
}

const forOfEntries = () => {
  for (const [idx, item] of loop.entries()) {
    if (item && idx) {
    }
  }
}

const map = () => {
  loop.map((item, idx) => {
    if (item && idx) {
    }
    return item
  })
}

const forEach = () => {
  loop.forEach((item, idx) => {
    if (item && idx) {
    }
  })
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
