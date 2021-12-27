/* eslint-disable no-empty */

'use strict'
const forIncrement = (arr) => {
  for (let idx = 0, l = arr.length; idx < l; idx++) {
    const item = arr[idx]
    if (item) {
    }
  }
}

const forDecrement = (arr) => {
  for (let idx = arr.length; --idx; idx) {
    const item = arr[idx]
    if (item) {
    }
  }
}

const forOf = (arr) => {
  for (const item of arr) {
    if (item) {
    }
  }
}

const forOfEntries = (arr) => {
  for (const [idx, item] of arr.entries()) {
    if (item && idx) {
    }
  }
}

const map = (arr) => {
  arr.map((item, idx) => {
    if (item && idx) {
    }
    return item
  })
}

const forEach = (arr) => {
  arr.forEach((item, idx) => {
    if (item && idx) {
    }
  })
}

const whileShift = (arr) => {
  while (arr.length) {
    const item = arr.shift()
    if (item) {
    }
  }
}

const whilePop = (arr) => {
  while (arr.length) {
    const item = arr.pop()
    if (item) {
    }
  }
}

const recursionShift = (arr, idx = 0) => {
  if (!arr.length) return
  const item = arr.shift()
  if (item) {
  }
  return recursionShift(arr, idx++)
}

const recursionPop = (arr, idx = 0) => {
  if (!arr.length) return
  const item = arr.pop()
  if (item) {
  }
  return recursionPop(arr, idx++)
}

const arr = [...Array(10).keys()]
const Benchmark = require('benchmark')
new Benchmark.Suite('Get First Char', {})
  .add('forIncrement', async () => {
    forIncrement([...arr])
  })
  .add('forDecrement', async () => {
    forDecrement([...arr])
  })
  .add('forOf', async () => {
    forOf([...arr])
  })
  .add('forOfEntries', async () => {
    forOfEntries([...arr])
  })
  .add('map', async () => {
    map([...arr])
  })
  .add('forEach', async () => {
    forEach([...arr])
  })
  .add('whileShift', async () => {
    whileShift([...arr])
  })
  .add('whilePop', async () => {
    whilePop([...arr])
  })
  .add('recursionShift', async () => {
    recursionShift([...arr])
  })
  .add('recursionPop', async () => {
    recursionPop([...arr])
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
