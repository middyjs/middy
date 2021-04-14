// Mock out event and AWS response
const event = {
  Records: [
    {
      messageId: '059f36b4-87a3-44ab-83d2-661975830a7d',
      receiptHandle: 'AQEBwJnKyrHigUMZj6rYigCgxlaS3SLy0a...',
      body: '{"hello":"world"}',
      attributes: {
        ApproximateReceiveCount: '1',
        SentTimestamp: '1545082649183',
        SenderId: 'AIDAIENQZJOLO23YVJ4VO',
        ApproximateFirstReceiveTimestamp: '1545082649185'
      },
      messageAttributes: {},
      md5OfBody: 'e4e68fb7bd0e697a0ae8f1bb342846b3',
      eventSource: 'aws:sqs',
      eventSourceARN: 'arn:aws:sqs:us-east-2:123456789012:my-queue',
      awsRegion: 'us-east-2'
    },
    {
      messageId: '2e1424d4-f796-459a-8184-9c92662be6da',
      receiptHandle: 'AQEBzWwaftRI0KuVm4tP+/7q1rGgNqicHq...',
      body: 'Test message.',
      attributes: {
        ApproximateReceiveCount: '1',
        SentTimestamp: '1545082650636',
        SenderId: 'AIDAIENQZJOLO23YVJ4VO',
        ApproximateFirstReceiveTimestamp: '1545082650649'
      },
      messageAttributes: {},
      md5OfBody: 'e4e68fb7bd0e697a0ae8f1bb342846b3',
      eventSource: 'aws:sqs',
      eventSourceARN: 'arn:aws:sqs:us-east-2:123456789012:my-queue',
      awsRegion: 'us-east-2'
    }
  ]
}

const sinon = require('sinon')
const SQS = require('aws-sdk/clients/sqs.js')
SQS.prototype.deleteMessageBatch = sinon
  .createSandbox()
  .stub()
  .returns({
    promise: () =>
      Promise.resolve({
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
  })

/**
 * Trigger Lambda from SQS Event
 * https://docs.aws.amazon.com/lambda/latest/dg/with-sqs.html
 **/
const middy = require('@middy/core')
const sqsJsonBodyParserMiddleware = require('@middy/sqs-json-body-parser')
const sqsPartialBatchFailureMiddleware = require('@middy/sqs-partial-batch-failure')

const handler = middy((event) => {
  return Promise.allSettled(event.Records.map(async (record) => record))
})
  .use(sqsJsonBodyParserMiddleware())
  .use(
    sqsPartialBatchFailureMiddleware({
      AwsClient: SQS
    })
  )

module.exports = { handler, event }
