const createEvent = require('@serverless/event-mocks').default
const middy = require('../../core')
const sqsJsonBodyParser = require('../')

describe('middleware/sqsJsonBodyParser >', () => {
  let opts
  let bodyParser
  let next
  let event

  beforeEach(() => {
    opts = undefined
    bodyParser = sqsJsonBodyParser(opts)
    next = jest.fn()
    event = createEvent('aws:sqs')
  })

  describe('as function >', () => {
    let handler

    beforeEach(() => {
      jest.spyOn(JSON, 'parse')

      handler = { event }
    })

    afterEach(() => {
      JSON.parse.mockRestore()
    })

    test('handles empty event object', () => {
      handler = {}
      bodyParser.before(handler, next)

      expect(JSON.parse).not.toHaveBeenCalled()
      expect(next).toHaveBeenCalledTimes(1)
    })

    test('handles empty Records array', function () {
      handler = { event: {} }
      bodyParser.before(handler, next)

      expect(JSON.parse).not.toHaveBeenCalled()
      expect(next).toHaveBeenCalledTimes(1)
    })

    test('parses each body payload', function () {
      const bodys = [{ one: 1 }, { two: 2 }, { three: 3 }]
      event.Records.push({ ...event.Records[0] })
      event.Records.push({ ...event.Records[0] })

      bodys.forEach((body, idx) => {
        event.Records[idx].body = JSON.stringify(body)
      })

      bodyParser.before(handler, next)

      expect(JSON.parse).toHaveBeenCalledTimes(3)
      event.Records.forEach((rcd, idx) => {
        expect(JSON.parse).toHaveBeenNthCalledWith((idx + 1), JSON.stringify(bodys[idx]), undefined)
        expect(rcd.body).toStrictEqual(bodys[idx])
      })
      expect(next).toHaveBeenCalledTimes(1)
    })

    test('returns original body when parse error', function () {
      const body = 'bad json'
      handler.event.Records[0].body = body
      bodyParser.before(handler, next)

      expect(JSON.parse).toHaveBeenCalledTimes(1)
      expect(JSON.parse).toHaveBeenCalledWith(body, undefined)
      expect(handler.event.Records[0].body).toBe(body)
      expect(next).toHaveBeenCalledTimes(1)
    })

    test('calls reviver when provided', function () {
      const body = '{}'
      handler.event.Records[0].body = body
      const reviver = jest.fn()
      opts = { reviver }
      bodyParser = sqsJsonBodyParser(opts)

      bodyParser.before(handler, next)

      expect(JSON.parse).toHaveBeenCalledTimes(1)
      expect(JSON.parse).toHaveBeenCalledWith(body, reviver)
      expect(reviver).toHaveBeenCalled()
      expect(next).toHaveBeenCalledTimes(1)
    })

    test('calls safeParse when provided', function () {
      const { body } = handler.event.Records[0]
      const safeParseRet = 'jibberish'
      const reviver = jest.fn()
      const safeParse = jest.fn().mockReturnValue(safeParseRet)
      opts = { reviver, safeParse }
      bodyParser = sqsJsonBodyParser(opts)

      bodyParser.before(handler, next)

      expect(safeParse).toHaveBeenCalledTimes(1)
      expect(safeParse).toHaveBeenCalledWith(body, reviver)
      expect(handler.event.Records[0].body).toBe(safeParseRet)
      expect(next).toHaveBeenCalledTimes(1)
    })
  })

  describe('as middleware > ', function () {
    let originalHandler
    let handler

    beforeEach(function () {
      originalHandler = jest.fn()
      handler = middy(originalHandler)

      handler.use(bodyParser)
    })

    test('parses the body', function () {
      const body = '{}'
      event.Records[0].body = body

      handler(event, {})

      expect(event.Records[0].body).toStrictEqual({})
    })

    test('parses all bodys', function () {
      const bodys = [{ one: 1 }, { two: 2 }]
      event.Records.push({ ...event.Records[0] })

      bodys.forEach((body, idx) => {
        event.Records[idx].body = JSON.stringify(body)
      })

      handler(event, {})

      event.Records.forEach((rcd, idx) => {
        expect(rcd.body).toStrictEqual(bodys[idx])
      })
    })

    test('returns original body when parse error', function () {
      const body = 'bad json'
      event.Records[0].body = body

      handler(event, {})

      expect(event.Records[0].body).toBe(body)
    })

    test('calls reviver when provided', function () {
      const body = '{}'
      event.Records[0].body = body
      const revivereRet = 'jibberish'
      const reviver = jest.fn().mockReturnValue(revivereRet)
      opts = { reviver }
      bodyParser = sqsJsonBodyParser(opts)

      handler = middy(originalHandler)

      handler.use(bodyParser)

      handler(event, {})

      expect(reviver).toHaveBeenCalled()
      expect(event.Records[0].body).toBe(revivereRet)
    })

    test('calls safeParse when provided', function () {
      const { body } = event.Records[0]
      const safeParseRet = 'jibberish'
      const safeParse = jest.fn().mockReturnValue(safeParseRet)
      opts = { safeParse }
      bodyParser = sqsJsonBodyParser(opts)

      handler = middy(originalHandler)

      handler.use(bodyParser)

      handler(event, {})

      expect(safeParse).toHaveBeenCalledTimes(1)
      expect(safeParse).toHaveBeenCalledWith(body, undefined)
      expect(event.Records[0].body).toBe(safeParseRet)
    })
  })
})
