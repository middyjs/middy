const t1 = (a, b) => {
  b?.run?.()
  return a
}
console.log('t1', t1('a'))
// // Result: console.log(((void 0).run(),"a"))
// // Expected: console.log("t1","a")

const t2 = (a, b) => {
  b?.run?.()
  return a
}
console.log('t2', t2('a'))
console.log('t2', t2('a'))
// Result: console.log("t2", "a")
// Expected: console.log("t2", "a")

const t3r = (a, b, c = 1) => {
  if (!c) return a
  b?.run2?.()
  return t3r(a, b, --c)
}

const t3 = (a, b) => {
  b?.run1?.()
  return t3r(a, b)
}
console.log('t3', t3('a'))

const t4 = (a, b) => {
  b?.run1?.()
  const arr = []
  const t4a = () => {
    return arr
  }
  t4a.add = () => {
    arr.push('b')
    return t4a
  }
  t4a.obj = { a: arr }
  return t4a
}
console.log('t4', t4('a').add()())

const t5 = async (a, b) => {
  await b?.run1?.()
  return a
}

;(async () => {
  console.log('t5', await t5('a'))
})()

const t6a = async (a, b) => {
  b?.run2?.()
  return a
}

const t6 = (a, b) => {
  b?.run1?.()
  try {
    return t6a(a, b)
  } catch (e) {}
  return a
}
console.log('t6', t6('a'))
// const t5 = (a, b) => {
//   b?.run?.()
//   const t5a = () => {
//     return a
//   }
//   t5a.test = () => {
//     return a + 'b'
//   }
//   return t5a
// }
// console.log('t5', {t5:t5('a')()})

// export default t4('a')
