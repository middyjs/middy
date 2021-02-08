const test = require('ava')
const sinon = require('sinon')
const createEvent = require('@serverless/event-mocks')
const middy = require('../../core/index.js')
const sqsJsonBodyParser = require('../index.js')

let event

let sandbox
test.beforeEach((t) => {
  event = createEvent.default('aws:sqs')
  sandbox = sinon.createSandbox()
})

test.afterEach((t) => {
  sandbox.restore()
})

test.serial('parses each body payload', async (t) => {
  const handler = { event }
  const bodys = [{ one: 1 }, { two: 2 }, { three: 3 }]
  event.Records.push({ ...event.Records[0] })
  event.Records.push({ ...event.Records[0] })

  bodys.forEach((body, idx) => {
    event.Records[idx].body = JSON.stringify(body)
  })

  await sqsJsonBodyParser().before(handler)

  event.Records.forEach((rcd, idx) => {
    t.deepEqual(rcd.body, bodys[idx])
  })
})

test.serial('returns original body when parse error', async (t) => {
  const handler = { event }
  const body = 'bad json'
  handler.event.Records[0].body = body
  await sqsJsonBodyParser().before(handler)

  t.deepEqual(handler.event.Records[0].body, body)
})

test.serial('returns default body when nullish', async (t) => {
  const handler = { event }
  const body = null
  handler.event.Records[0].body = body
  await sqsJsonBodyParser().before(handler)

  t.deepEqual(handler.event.Records[0].body, {})
})

test.serial('It should parse the body', async (t) => {
  const handler = middy().use(sqsJsonBodyParser())
  const body = '{}'
  event.Records[0].body = body

  await handler(event, {})

  t.deepEqual(event.Records[0].body, {})
})

test.serial('It should parse all bodys', async (t) => {
  const handler = middy().use(sqsJsonBodyParser())
  const bodys = [{ one: 1 }, { two: 2 }]
  event.Records.push({ ...event.Records[0] })

  bodys.forEach((body, idx) => {
    event.Records[idx].body = JSON.stringify(body)
  })

  await handler(event, {})

  event.Records.forEach((rcd, idx) => {
    t.deepEqual(rcd.body, bodys[idx])
  })
})

test.serial('It should return original body when parse error', async (t) => {
  const handler = middy().use(sqsJsonBodyParser())
  const body = 'bad json'
  event.Records[0].body = body

  await handler(event, {})

  t.deepEqual(event.Records[0].body, body)
})

test.serial('It should call reviver when provided', async (t) => {
  const handler = middy()
  const body = '{}'
  event.Records[0].body = body
  const reviverReturn = 'jibberish'
  const reviver = sandbox.stub().returns(reviverReturn)

  handler.use(sqsJsonBodyParser({ reviver }))

  await handler(event, {})

  t.deepEqual(event.Records[0].body, reviverReturn)
})
