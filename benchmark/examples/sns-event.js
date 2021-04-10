// Mock out event
const event = {
  Records: [
    {
      EventVersion: '1.0',
      EventSubscriptionArn: 'arn:aws:sns:us-east-2:123456789012:sns-lambda:21be56ed-a058-49f5-8c98-aedd2564c486',
      EventSource: 'aws:sns',
      Sns: {
        SignatureVersion: '1',
        Timestamp: '2019-01-02T12:45:07.000Z',
        Signature: 'tcc6faL2yUC6dgZdmrwh1Y4cGa/ebXEkAi6RibDsvpi+tE/1+82j...65r==',
        SigningCertUrl: 'https://sns.us-east-2.amazonaws.com/SimpleNotificationService-ac565b8b1a6c5d002d285f9598aa1d9b.pem',
        MessageId: '95df01b4-ee98-5cb9-9903-4c221d41eb5e',
        Message: 'Hello from SNS!',
        MessageAttributes: {
          Test: {
            Type: 'String',
            Value: 'TestString'
          },
          TestBinary: {
            Type: 'Binary',
            Value: 'TestBinary'
          }
        },
        Type: 'Notification',
        UnsubscribeUrl: 'https://sns.us-east-2.amazonaws.com/?Action=Unsubscribe&amp;SubscriptionArn=arn:aws:sns:us-east-2:123456789012:test-lambda:21be56ed-a058-49f5-8c98-aedd2564c486',
        TopicArn: 'arn:aws:sns:us-east-2:123456789012:sns-lambda',
        Subject: 'TestInvoke'
      }
    }
  ]
}

/**
 * Trigger Lambda from SNS Event
 * https://docs.aws.amazon.com/lambda/latest/dg/with-sns.html
 **/
const middy = require('@middy/core')
// const snsJsonMessageParserMiddleware = require('@middy/sns-json-message-parser')

const handler = middy(() => {})
//  .use(snsJsonMessageParserMiddleware())

module.exports = { handler, event }
