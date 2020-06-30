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

const originalHandler = jest.fn(async (e) => {
  const processedRecords = e.Records.map(async (r) => {
    if (r.messageAttributes.resolveOrReject.stringValue === 'resolve') return r.messageId
    throw new Error('Error message...')
  })
  return Promise.allSettled(processedRecords)
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
    const handler = middy(originalHandler)
      .use(sqsBatchMiddleware({ sqs }))
    await expect(handler(event)).resolves.toEqual([
      {
        status: 'fulfilled',
        value: '059f36b4-87a3-44ab-83d2-661975830a7d'
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
