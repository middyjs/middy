const defaultSafeParse = (body, reviver) => {
  try {
    return JSON.parse(body, reviver)
  } catch (err) {
    return body
  }
}

const sqsJsonBodyParserBefore = ({ reviver, safeParse }) => async (handler) => {
  const { event: { Records = [] } = { Records: [] } } = handler

  Records.forEach(record => {
    record.body = safeParse(record.body, reviver)
  })
}

export default ({ reviver, safeParse = defaultSafeParse } = {}) => ({
  before: sqsJsonBodyParserBefore({
    reviver,
    safeParse
  })
})
