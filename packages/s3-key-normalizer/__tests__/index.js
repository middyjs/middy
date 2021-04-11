const test = require('ava')
const middy = require('../../core/index.js')
const s3KeyNormalizer = require('../index.js')
const sqsJsonBodyParser = require('@middy/sqs-json-body-parser')

test('It normalizes keys in a s3 event', async (t) => {
  const event = {
    Records: [
      {
        eventVersion: '2.1',
        eventTime: '1970-01-01T00:00:00.000Z',
        requestParameters: {
          sourceIPAddress: '127.0.0.1'
        },
        s3: {
          configurationId: 'testConfigRule',
          object: {
            eTag: '0123456789abcdef0123456789abcdef',
            sequencer: '0A1B2C3D4E5F678901',
            key: 'This+is+a+picture.jpg',
            size: 1024
          },
          bucket: {
            arn: 'arn:aws:s3:::mybucket',
            name: 'sourcebucket',
            ownerIdentity: {
              principalId: 'EXAMPLE'
            }
          },
          s3SchemaVersion: '1.0'
        },
        responseElements: {
          'x-amz-id-2':
            'EXAMPLE123/5678abcdefghijklambdaisawesome/mnopqrstuvwxyzABCDEFGH',
          'x-amz-request-id': 'EXAMPLE123456789'
        },
        awsRegion: 'us-east-1',
        eventName: 'ObjectCreated:Put',
        userIdentity: {
          principalId: 'EXAMPLE'
        },
        eventSource: 'aws:s3'
      }
    ]
  }

  const handler = middy((event, context) => event)

  handler.use(s3KeyNormalizer())

  const response = await handler(event)

  t.is(response.Records[0].s3.object.key, 'This is a picture.jpg')
})

test('It normalizes keys in a s3 event from sqs', async (t) => {
  const event = {
    Records: [
      {
        messageId: '2e1424d4-f796-459a-8184-9c92662be6da',
        receiptHandle: 'AQEBzWwaftRI0KuVm4tP+/7q1rGgNqicHq...',
        body: JSON.stringify({
          Records: [
            {
              eventVersion: '2.1',
              eventTime: '1970-01-01T00:00:00.000Z',
              requestParameters: {
                sourceIPAddress: '127.0.0.1'
              },
              s3: {
                configurationId: 'testConfigRule',
                object: {
                  sequencer: '0A1B2C3D4E5F678901',
                  key: 'This+is+a+picture.jpg'
                },
                bucket: {
                  arn: 'arn:aws:s3:::mybucket',
                  name: 'sourcebucket',
                  ownerIdentity: {
                    principalId: 'EXAMPLE'
                  }
                },
                s3SchemaVersion: '1.0'
              },
              responseElements: {
                'x-amz-id-2':
                  'EXAMPLE123/5678abcdefghijklambdaisawesome/mnopqrstuvwxyzABCDEFGH',
                'x-amz-request-id': 'EXAMPLE123456789'
              },
              awsRegion: 'us-east-1',
              eventName: 'ObjectRemoved:Delete',
              userIdentity: {
                principalId: 'EXAMPLE'
              },
              eventSource: 'aws:s3'
            }
          ]
        }),
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

  const handler = middy((event, context) => event)

  handler.use(sqsJsonBodyParser()).use(s3KeyNormalizer())

  const response = await handler(event)

  t.is(
    response.Records[0].body.Records[0].s3.object.key,
    'This is a picture.jpg'
  )
})

// TODO requires `sns-json-body-parser`
/* test('It normalizes keys in a s3 event from sns', async (t) => {
  const event =
    {
      Records: [
        {
          EventVersion: '1.0',
          EventSubscriptionArn:
            'arn:aws:sns:us-east-2:123456789012:sns-lambda:21be56ed-a058-49f5-8c98-aedd2564c486',
          EventSource: 'aws:sns',
          Sns: {
            SignatureVersion: '1',
            Timestamp: '2019-01-02T12:45:07.000Z',
            Signature:
              'tcc6faL2yUC6dgZdmrwh1Y4cGa/ebXEkAi6RibDsvpi+tE/1+82j...65r==',
            SigningCertUrl:
              'https://sns.us-east-2.amazonaws.com/SimpleNotificationService-ac565b8b1a6c5d002d285f9598aa1d9b.pem',
            MessageId: '95df01b4-ee98-5cb9-9903-4c221d41eb5e',
            Message: JSON.stringify({
              Records: [
                {
                  eventVersion: '2.1',
                  eventTime: '1970-01-01T00:00:00.000Z',
                  requestParameters: {
                    sourceIPAddress: '127.0.0.1'
                  },
                  s3: {
                    configurationId: 'testConfigRule',
                    object: {
                      sequencer: '0A1B2C3D4E5F678901',
                      key: 'This+is+a+picture.jpg'
                    },
                    bucket: {
                      arn: 'arn:aws:s3:::mybucket',
                      name: 'sourcebucket',
                      ownerIdentity: {
                        principalId: 'EXAMPLE'
                      }
                    },
                    s3SchemaVersion: '1.0'
                  },
                  responseElements: {
                    'x-amz-id-2':
                      'EXAMPLE123/5678abcdefghijklambdaisawesome/mnopqrstuvwxyzABCDEFGH',
                    'x-amz-request-id': 'EXAMPLE123456789'
                  },
                  awsRegion: 'us-east-1',
                  eventName: 'ObjectRemoved:Delete',
                  userIdentity: {
                    principalId: 'EXAMPLE'
                  },
                  eventSource: 'aws:s3'
                }
              ]
            }),
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
            UnsubscribeUrl:
              'https://sns.us-east-2.amazonaws.com/?Action=Unsubscribe&amp;SubscriptionArn=arn:aws:sns:us-east-2:123456789012:test-lambda:21be56ed-a058-49f5-8c98-aedd2564c486',
            TopicArn: 'arn:aws:sns:us-east-2:123456789012:sns-lambda',
            Subject: 'TestInvoke'
          }
        }
      ]
    }

  const handler = middy((event, context) => event)

  handler
    .use(sqsJsonBodyParser())
    .use(s3KeyNormalizer())

  const response = await handler(event)
console.log(JSON.stringify(response, null, 2))
  t.is(response.Records[0].Sns.Message.Records[0].s3.object.key, 'This is a picture.jpg')
}) */

test('It should not normalize the event if the event version is not 2.x', async (t) => {
  const event = {
    Records: [
      {
        eventVersion: '2.3',
        eventTime: '1970-01-01T00:00:00.000Z',
        requestParameters: {
          sourceIPAddress: '127.0.0.1'
        },
        s3: {
          configurationId: 'testConfigRule',
          object: {
            sequencer: '0A1B2C3D4E5F678901',
            key: 'This+is+a+picture.jpg'
          },
          bucket: {
            arn: 'arn:aws:s3:::mybucket',
            name: 'sourcebucket',
            ownerIdentity: {
              principalId: 'EXAMPLE'
            }
          },
          s3SchemaVersion: '1.0'
        },
        responseElements: {
          'x-amz-id-2':
            'EXAMPLE123/5678abcdefghijklambdaisawesome/mnopqrstuvwxyzABCDEFGH',
          'x-amz-request-id': 'EXAMPLE123456789'
        },
        awsRegion: 'us-east-1',
        eventName: 'ObjectRemoved:Delete',
        userIdentity: {
          principalId: 'EXAMPLE'
        },
        eventSource: 'aws:s3'
      }
    ]
  }
  const eventOriginalCopy = { ...event }
  const handler = middy((event, context) => event)

  handler.use(s3KeyNormalizer())

  const response = await handler(event)

  t.deepEqual(response, eventOriginalCopy)
})

test("It should not normalize the event if it doesn't look like an S3 event", async (t) => {
  const alexaEvent = {
    header: {
      payloadVersion: '2',
      namespace: 'Alexa.ConnectedHome.Discovery',
      name: 'DiscoverAppliancesRequest',
      messageId: 'F8752B11-69BB-4246-B923-3BFB27C06C7D'
    },
    payload: {
      accessToken: '1'
    }
  }

  const eventOriginalCopy = { ...alexaEvent }

  const handler = middy((event, context) => event)

  handler.use(s3KeyNormalizer())

  const response = await handler(alexaEvent)

  // checks if the event is still equal to its original copy
  t.deepEqual(response, eventOriginalCopy)
})

test("It should not normalize the event if the S3 event doesn't match the expected format", async (t) => {
  const event = {
    Records: [
      {
        eventVersion: '3.0',
        eventTime: '1970-01-01T00:00:00.000Z',
        requestParameters: {
          sourceIPAddress: '127.0.0.1'
        },
        s3: {
          configurationId: 'testConfigRule',
          object: {
            eTag: '0123456789abcdef0123456789abcdef',
            sequencer: '0A1B2C3D4E5F678901',
            key: 'This+is+a+picture.jpg',
            size: 1024
          },
          bucket: {
            arn: 'arn:aws:s3:::mybucket',
            name: 'sourcebucket',
            ownerIdentity: {
              principalId: 'EXAMPLE'
            }
          },
          s3SchemaVersion: '1.0'
        },
        responseElements: {
          'x-amz-id-2':
            'EXAMPLE123/5678abcdefghijklambdaisawesome/mnopqrstuvwxyzABCDEFGH',
          'x-amz-request-id': 'EXAMPLE123456789'
        },
        awsRegion: 'us-east-1',
        eventName: 'ObjectCreated:Put',
        userIdentity: {
          principalId: 'EXAMPLE'
        },
        eventSource: 'aws:s3'
      }
    ]
  }

  const eventOriginalCopy = { ...event }

  const handler = middy((event, context) => event)

  handler.use(s3KeyNormalizer())

  const response = await handler(event)

  // checks if the event is still equal to its original copy
  t.deepEqual(response, eventOriginalCopy)
})
