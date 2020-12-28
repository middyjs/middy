
export default () => {
  let time = {}

  const before = (id) => time[id] = process.hrtime()
  const after = (id) => console.log(id, process.hrtime(time[id])[1] / 1000000, 'ms')

  return { before, after}
}
