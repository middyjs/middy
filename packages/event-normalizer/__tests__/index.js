import test from 'ava'
import createEvent from '@serverless/event-mocks'
import eventNormalizer from '../index.js'
import middy from '../../core/index.js'

// const event = {}
const context = {
  getRemainingTimeInMillis: () => 1000
}

test.serial('It should skip when empty event', async (t) => {
  const handler = middy((event) => event)
    .use(eventNormalizer())

  const event = {}
  const response = await handler(event, context)

  t.deepEqual(response, event)
})

test.serial('It should skip when unknown event', async (t) => {
  const handler = middy((event) => event)
    .use(eventNormalizer())

  const event = { Records: [{ eventSource: 'aws:new' }] }
  const response = await handler(event, context)

  t.deepEqual(response, { Records: [{ eventSource: 'aws:new' }] })
})

test.serial('It should parse nested events', async (t) => {
  const handler = middy((event) => event)
    .use(eventNormalizer())

  const s3Event = createEvent.default('aws:s3')
  const snsEvent = createEvent.default('aws:sns')
  snsEvent.Records[0].Sns.Message = JSON.stringify(s3Event)
  const sqsEvent = createEvent.default('aws:sqs')
  sqsEvent.Records[0].body = JSON.stringify(snsEvent)
  const event = sqsEvent
  const response = await handler(event, context)

  t.deepEqual(response.Records[0].body.Records[0].Sns.Message, s3Event)
})

// SNS
test.serial('It should parse SNS event message', async (t) => {
  const handler = middy((event) => event)
    .use(eventNormalizer())

  const message = { hello: 'world' }
  const event = createEvent.default('aws:sns')
  event.Records[0].Sns.Message = JSON.stringify(message)
  const response = await handler(event, context)

  t.deepEqual(response.Records[0].Sns.Message, message)
})

// SQS
test.serial('It should parse SQS event body', async (t) => {
  const handler = middy((event) => event)
    .use(eventNormalizer())

  const body = { hello: 'world' }
  const event = createEvent.default('aws:sqs')
  event.Records[0].body = JSON.stringify(body)
  const response = await handler(event, context)

  t.deepEqual(response.Records[0].body, body)
})

// S3
test.serial('It should normalize S3 event key', async (t) => {
  const handler = middy((event) => event)
    .use(eventNormalizer())

  const event = createEvent.default('aws:s3')
  event.Records[0].s3.object.key = 'This+is+a+picture.jpg'
  const response = await handler(event, context)

  t.is(response.Records[0].s3.object.key, 'This is a picture.jpg')
})

// DynamoDB
test.serial('It should parse DynamoDB event keys/images', async (t) => {
  const handler = middy((event) => event)
    .use(eventNormalizer())

  const event = createEvent.default('aws:dynamo')
  const response = await handler(event, context)

  t.deepEqual(response.Records[0].dynamodb, {
    Keys: { Id: 101 },
    NewImage: {
      Message: 'New item!',
      Id: 101
    },
    OldImage: {},
    SequenceNumber: '111',
    SizeBytes: 26,
    StreamViewType: 'NEW_AND_OLD_IMAGES'
  })
})

// Kinesis Stream
test.serial('It should parse Kinesis Stream event data', async (t) => {
  const handler = middy((event) => event)
    .use(eventNormalizer())

  const data = { hello: 'world' }
  const event = createEvent.default('aws:kinesis')
  event.Records[0].kinesis.data = Buffer.from(
    JSON.stringify(data),
    'utf-8'
  ).toString('base64')
  const response = await handler(event, context)

  t.deepEqual(response.Records[0].kinesis.data, data)
})

// Kinesis Firehose
test.serial('It should parse Kinesis Firehose event data', async (t) => {
  const handler = middy((event) => event)
    .use(eventNormalizer())

  const data = { hello: 'world' }
  const event = {
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
  const response = await handler(event, context)

  t.deepEqual(response.records[0].data, data)
})
