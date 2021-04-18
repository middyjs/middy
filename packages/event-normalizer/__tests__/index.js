const test = require('ava')
const sinon = require('sinon')
const createEvent = require('@serverless/event-mocks')
const middy = require('../../core/index.js')
const eventNormalizer = require('../index.js')

let event

let sandbox
test.beforeEach((t) => {
  sandbox = sinon.createSandbox()
})

test.afterEach((t) => {
  sandbox.restore()
  event = undefined
})

test.serial('It should skip when empty event', async (t) => {
  const request = { event: {} }

  const res = await eventNormalizer().before(request)

  t.is(res, undefined)
  t.deepEqual(request, { event: {} })
})

test.serial('It should skip when unknown event', async (t) => {
  const request = { event: { Records: [{ eventSource: 'aws:new' }] } }

  const res = await eventNormalizer().before(request)

  t.is(res, undefined)
  t.deepEqual(request, { event: { Records: [{ eventSource: 'aws:new' }] } })
})

test.serial('It should parse nested events', async (t) => {
  const s3Event = createEvent.default('aws:s3')
  const sqsEvent = createEvent.default('aws:sqs')
  sqsEvent.Records[0].body = JSON.stringify(s3Event)
  const snsEvent = createEvent.default('aws:sns')
  snsEvent.Records[0].Sns.Message = JSON.stringify(sqsEvent)
  const request = { event: snsEvent }

  await eventNormalizer().before(request)

  t.deepEqual(request.event.Records[0].Sns.Message.Records[0].body, s3Event)
})

// SNS
test.serial('It should parse SNS event message', async (t) => {
  const message = { hello: 'world' }
  const request = { event: createEvent.default('aws:sns') }
  request.event.Records[0].Sns.Message = JSON.stringify(message)

  await eventNormalizer().before(request)

  t.deepEqual(request.event.Records[0].Sns.Message, message)
})

// SQS
test.serial('It should parse SQS event body', async (t) => {
  const body = { hello: 'world' }
  const request = { event: createEvent.default('aws:sqs') }
  request.event.Records[0].body = JSON.stringify(body)

  await eventNormalizer().before(request)

  t.deepEqual(request.event.Records[0].body, body)
})

// S3
test.serial('It should normalize S3 event key', async (t) => {
  const request = { event: createEvent.default('aws:s3') }
  request.event.Records[0].s3.object.key = 'This+is+a+picture.jpg'

  await eventNormalizer().before(request)

  t.is(request.event.Records[0].s3.object.key, 'This is a picture.jpg')
})

// DynamoDB
test.serial('It should parse DynamoDB event keys/images', async (t) => {
  const request = { event: createEvent.default('aws:dynamo') }

  await eventNormalizer().before(request)

  t.deepEqual(request.event.Records[0].dynamodb, {
    Keys: { Id: 101 },
    NewImage: {
      Message: 'New item!',
      Id: 101
    },
    OldImage: {},
    SequenceNumber: '111',
    SizeBytes: 26,
    StreamViewType: 'NEW_AND_OLD_IMAGES',
  })
})

// Kinesis Stream
test.serial('It should parse Kinesis Stream event data', async (t) => {
  const data = { hello: 'world' }
  const request = { event: createEvent.default('aws:kinesis') }
  request.event.Records[0].kinesis.data = Buffer.from(JSON.stringify(data), 'utf-8').toString('base64')

  await eventNormalizer().before(request)

  t.deepEqual(request.event.Records[0].kinesis.data, data)
})

// Kinesis Firehose
test.serial('It should parse Kinesis Firehose event data', async (t) => {
  const data = { hello: 'world' }
  const request = { event: {
      invocationId: 'invoked123',
      deliveryStreamArn: 'aws:lambda:events',
      region: 'us-west-2',
      records: [
        {
          data: Buffer.from(JSON.stringify(data), 'utf-8').toString('base64'),
          recordId: 'record1',
          approximateArrivalTimestamp: 1510772160000,
          kinesisRecordMetadata: {
            shardId: 'shardId-000000000000',
            partitionKey: '4d1ad2b9-24f8-4b9d-a088-76e9947c317a',
            approximateArrivalTimestamp: '2012-04-23T18:25:43.511Z',
            sequenceNumber:
              '49546986683135544286507457936321625675700192471156785154',
            subsequenceNumber: ''
          }
        },
        {
          data: 'SGVsbG8gV29ybGQ=',
          recordId: 'record2',
          approximateArrivalTimestamp: 151077216000,
          kinesisRecordMetadata: {
            shardId: 'shardId-000000000001',
            partitionKey: '4d1ad2b9-24f8-4b9d-a088-76e9947c318a',
            approximateArrivalTimestamp: '2012-04-23T19:25:43.511Z',
            sequenceNumber:
              '49546986683135544286507457936321625675700192471156785155',
            subsequenceNumber: ''
          }
        }
      ]
    }
  }

  await eventNormalizer().before(request)

  t.deepEqual(request.event.records[0].data, data)
})
