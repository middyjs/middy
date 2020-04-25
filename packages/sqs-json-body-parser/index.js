const defaultSafeParse = (body, reviver) => {
  try {
    return JSON.parse(body, reviver)
  } catch (err) {
    return body
  }
}

const sqsJsonBodyParserBefore = ({ reviver, safeParse }) => (handler, next) => {
  const { event: { Records = [] } = { Records: [] } } = handler

  Records.forEach(record => {
    record.body = safeParse(record.body, reviver)
  })

  next()
}

module.exports = ({ reviver, safeParse = defaultSafeParse } = {}) => ({
  before: sqsJsonBodyParserBefore({
    reviver,
    safeParse
  })
})
