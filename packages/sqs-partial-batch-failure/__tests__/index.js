import test from 'ava'
import sinon from 'sinon'
import createEvent from '@serverless/event-mocks'

import middy from '../../core/index.js'
import sqsPartialBatchFailure from '../index.js'

const baseHandler = async (e) => {
  const processedRecords = e.Records.map(async (r) => {
    if (r.messageAttributes.resolveOrReject.stringValue === 'resolve') {
      return r.messageId
    }
    throw new Error('record')
  })
  return Promise.allSettled(processedRecords)
}

// const event = {}
const context = {
  getRemainingTimeInMillis: () => 1000
}

test('Should return when there are only failed messages', async (t) => {
  const event = createEvent.default('aws:sqs', {
    Records: [
      {
        messageAttributes: {
          resolveOrReject: {
            stringValue: 'reject'
          }
        },
        body: ''
      }
    ]
  })
  const logger = sinon.spy()

  const handler = middy(baseHandler)
    .use(sqsPartialBatchFailure({ logger }))

  const response = await handler(event, context)

  t.deepEqual(response, { batchItemFailures: event.Records.map(r => ({ itemIdentifier: r.messageId })) })
  t.is(logger.callCount, 1)
})

test('Should resolve when there are no failed messages', async (t) => {
  const event = createEvent.default('aws:sqs', {
    Records: [
      {
        messageAttributes: {
          resolveOrReject: {
            stringValue: 'resolve'
          }
        },
        body: ''
      }
    ]
  })
  const logger = sinon.spy()

  const handler = middy(baseHandler)
    .use(sqsPartialBatchFailure({ logger }))

  const response = await handler(event, context)
  t.deepEqual(response, { batchItemFailures: [] })
  t.is(logger.callCount, 0)
})

test('Should return only the rejected messageIds', async (t) => {
  const event = createEvent.default('aws:sqs', {
    Records: [
      {
        messageAttributes: {
          resolveOrReject: {
            stringValue: 'reject'
          }
        },
        body: ''
      },
      {
        messageAttributes: {
          resolveOrReject: {
            stringValue: 'resolve'
          }
        },
        body: ''
      }
    ]
  })
  const logger = sinon.spy()

  const handler = middy(baseHandler)
    .use(sqsPartialBatchFailure({ logger }))

  const response = await handler(event, context)
  t.deepEqual(response, { batchItemFailures: event.Records.filter(r => r.messageAttributes.resolveOrReject.stringValue === 'reject').map(r => ({ itemIdentifier: r.messageId })) })
  t.is(logger.callCount, 1)
})
