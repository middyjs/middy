require('promise.allsettled').shim()
const SQS = require('aws-sdk/clients/sqs')
const eventMocks = require('@serverless/event-mocks').default
const middy = require('../../core')
const sqsBatchMiddleware = require('../')

// Mock SQS
const mockDeleteMessageBatch = jest.fn()
mockDeleteMessageBatch.mockImplementation(() => ({
  async promise () { }
}))

const sqs = new SQS({ region: 'us-east-2' })
sqs.deleteMessageBatch = mockDeleteMessageBatch

beforeEach(() => {
  mockDeleteMessageBatch.mockClear()
})

describe('📨 SQS batch', () => {
  test('Should resolve when there are no failed messages', async () => {
    const event = eventMocks(
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
    const originalHandler = jest.fn(async () => {
      const settledRecords = await Promise.allSettled(event.Records.map((r) => Promise.resolve(r)))
      return settledRecords
    })
    const handler = middy(originalHandler)
      .use(sqsBatchMiddleware({ sqs }))
    await expect(handler(event)).resolves.toEqual([
      {
        status: 'fulfilled',
        value: {
          attributes: {
            ApproximateFirstReceiveTimestamp: '1545082649185',
            ApproximateReceiveCount: '1',
            SenderId: 'AIDAIENQZJOLO23YVJ4VO',
            SentTimestamp: '1545082649183'
          },
          awsRegion: 'us-east-2',
          body: '',
          eventSource: 'aws:sqs',
          eventSourceARN: 'arn:aws:sqs:us-east-2:123456789012:my-queue',
          md5OfBody: '098f6bcd4621d373cade4e832627b4f6',
          messageAttributes: {
            resolveOrReject: {
              stringValue: 'resolve'
            }
          },
          messageId: '059f36b4-87a3-44ab-83d2-661975830a7d',
          receiptHandle: 'AQEBwJnKyrHigUMZj6rYigCgxlaS3SLy0a...'
        }
      }
    ])
  })
  test('Should throw with failure reasons', async () => {
    const event = eventMocks(
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
    const originalHandler = jest.fn(async () => {
      const settledRecords = await Promise.allSettled(event.Records.map((r) => {
        if (r.messageAttributes.resolveOrReject.stringValue === 'resolve') return Promise.resolve(r.messageId)
        return Promise.reject(new Error('Error message...'))
      }))
      return settledRecords
    })
    const handler = middy(originalHandler)
      .use(sqsBatchMiddleware({ sqs }))
    await expect(handler(event)).rejects.toThrow('Error message...')
    expect(mockDeleteMessageBatch).toHaveBeenCalledWith({
      Entries: [{
        Id: '0',
        ReceiptHandle: 'successfulMessageReceiptHandle'
      }],
      QueueUrl: 'https://sqs.us-east-2.amazonaws.com/123456789012/my-queue'
    })
  })
})
