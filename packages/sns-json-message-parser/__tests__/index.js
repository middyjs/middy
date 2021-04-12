const test = require('ava')
const sinon = require('sinon')
const createEvent = require('@serverless/event-mocks')
const middy = require('../../core/index.js')
const snsJsonMessageParser = require('../index.js')

let event

let sandbox
test.beforeEach((t) => {
  event = createEvent.default('aws:sns')
  sandbox = sinon.createSandbox()
})

test.afterEach((t) => {
  sandbox.restore()
})

test.serial('parses each message payload', async (t) => {
  const messages = [{ one: 1 }, { two: 2 }, { three: 3 }]
  event.Records.push(JSON.parse(JSON.stringify(event.Records[0])))
  event.Records.push(JSON.parse(JSON.stringify(event.Records[0])))

  messages.forEach((message, idx) => {
    event.Records[idx].Sns.Message = JSON.stringify(message)
  })
  const request = { event }
  await snsJsonMessageParser().before(request)

  event.Records.forEach((record, idx) => {
    t.deepEqual(record.Sns.Message, messages[idx])
  })
})

test.serial('returns original message when parse error', async (t) => {
  const request = { event }
  const message = 'bad json'
  request.event.Records[0].Sns.Message = message
  await snsJsonMessageParser().before(request)

  t.deepEqual(request.event.Records[0].Sns.Message, message)
})

test.serial('returns default message when nullish', async (t) => {
  const request = { event }
  const message = null
  request.event.Records[0].Sns.Message = message
  await snsJsonMessageParser().before(request)

  t.deepEqual(request.event.Records[0].Sns.Message, null)
})

test.serial('It should parse the message', async (t) => {
  const handler = middy().use(snsJsonMessageParser())
  const message = '{}'
  event.Records[0].Sns.Message = message

  await handler(event)

  t.deepEqual(event.Records[0].Sns.Message, {})
})

test.serial('It should parse all messages', async (t) => {
  const handler = middy().use(snsJsonMessageParser())
  const messages = [{ one: 1 }, { two: 2 }]
  event.Records.push(JSON.parse(JSON.stringify(event.Records[0])))

  messages.forEach((message, idx) => {
    event.Records[idx].Sns.Message = JSON.stringify(message)
  })

  await handler(event, {})

  event.Records.forEach((record, idx) => {
    t.deepEqual(record.Sns.Message, messages[idx])
  })
})

test.serial('It should return original message when parse error', async (t) => {
  const handler = middy().use(snsJsonMessageParser())
  const message = 'bad json'
  event.Records[0].Sns.Message = message

  await handler(event, {})

  t.deepEqual(event.Records[0].Sns.Message, message)
})

test.serial('It should call reviver when provided', async (t) => {
  const handler = middy()
  const message = '{}'
  event.Records[0].Sns.Message = message
  const reviverReturn = 'jibberish'
  const reviver = sandbox.stub().returns(reviverReturn)

  handler.use(snsJsonMessageParser({ reviver }))

  await handler(event, {})

  t.deepEqual(event.Records[0].Sns.Message, reviverReturn)
})
