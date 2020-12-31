import test from 'ava'
import sinon from 'sinon'
import createEvent from '@serverless/event-mocks'
import { SQS } from '@aws-sdk/client-sqs'
import middy from '../../core/index.js'
import sqsPartialBatchFailure from '../index.js'
import { clearCache } from '../../core/util.js'

let sandbox
test.beforeEach(t => {
  sandbox = sinon.createSandbox()
})

test.afterEach((t) => {
  sandbox.restore()
  clearCache()
})

const originalHandler = async (e) => {
  const processedRecords = e.Records.map(async (r) => {
    if (r.messageAttributes.resolveOrReject.stringValue === 'resolve') return r.messageId
    throw new Error('Error message...')
  })
  return Promise.allSettled(processedRecords)
}

test.serial('Should resolve when there are no failed messages', async (t) => {
  const event = createEvent.default(
    'aws:sqs',
    {
      Records: [{
        messageAttributes: {
          resolveOrReject: {
            stringValue: 'resolve'
          }
        },
        body: ''
      }]
    }
  )
  sandbox.stub(SQS.prototype, 'deleteMessageBatch').resolves({})
  const handler = middy(originalHandler)
    .use(sqsPartialBatchFailure({
      awsClientConstructor: SQS,
    }))

  const res = await handler(event)
  t.deepEqual(res, [
    {
      status: 'fulfilled',
      value: '059f36b4-87a3-44ab-83d2-661975830a7d'
    }
  ])
})

test.serial('Should resolve when there are no failed messages, prefetch disabled', async (t) => {
  const event = createEvent.default(
    'aws:sqs',
    {
      Records: [{
        messageAttributes: {
          resolveOrReject: {
            stringValue: 'resolve'
          }
        },
        body: ''
      }]
    }
  )
  sandbox.stub(SQS.prototype, 'deleteMessageBatch').resolves({})
  const handler = middy(originalHandler)
    .use(sqsPartialBatchFailure({
      awsClientConstructor: SQS,
      disablePrefetch: true
    }))

  const res = await handler(event)
  t.deepEqual(res, [
    {
      status: 'fulfilled',
      value: '059f36b4-87a3-44ab-83d2-661975830a7d'
    }
  ])
})

test.serial('Should throw with failure reasons', async (t) => {
  const event = createEvent.default(
    'aws:sqs',
    {
      Records: [{
        receiptHandle: 'successfulMessageReceiptHandle',
        messageAttributes: {
          resolveOrReject: {
            stringValue: 'resolve'
          }
        }
      }, {
        messageAttributes: {
          resolveOrReject: {
            stringValue: 'reject'
          }
        }
      }]
    }
  )
  const sqs = sandbox.stub(SQS.prototype, 'deleteMessageBatch').resolves({})
  const handler = middy(originalHandler)
    .use(sqsPartialBatchFailure({
      awsClientConstructor: SQS,
    }))
  try {
    await handler(event)
  } catch (e) {
    t.is(e.message, 'Error message...')
    t.is(sqs.callCount, 1)
    /*t.true(sqs.calledWith({
      Entries: [{ Id: '0', ReceiptHandle: 'successfulMessageReceiptHandle' }],
      QueueUrl: 'https://sqs.us-east-2.amazonaws.com/123456789012/my-queue'
    }))*/
  }
})

