import test from 'ava'
import createEvent from '@serverless/event-mocks'
import eventNormalizer from '../index.js'
import middy from '../../core/index.js'

// const event = {}
const context = {
  getRemainingTimeInMillis: () => 1000
}

test('It should skip when empty event', async (t) => {
  const handler = middy((event) => event).use(eventNormalizer())

  const event = {}
  const response = await handler(event, context)

  t.deepEqual(response, event)
})

test('It should skip when unknown event', async (t) => {
  const handler = middy((event) => event).use(eventNormalizer())

  const event = { Records: [{ eventSource: 'aws:new' }] }
  const response = await handler(event, context)

  t.deepEqual(response, { Records: [{ eventSource: 'aws:new' }] })
})

// Events //

// CloudWatch Logs
test('It should parse CloudWatch logs event', async (t) => {
  const handler = middy((event) => event).use(eventNormalizer())

  const userParameters = { key: 'value' }
  const event = {
    'CodePipeline.job': {
      id: 'c0d76431-b0e7-xmpl-97e3-e8ee786eb6f6',
      accountId: '123456789012',
      data: {
        actionConfiguration: {
          configuration: {
            FunctionName: 'my-function',
            UserParameters: JSON.stringify(userParameters)
          }
        },
        inputArtifacts: [
          {
            name: 'my-pipeline-SourceArtifact',
            revision: 'e0c7xmpl2308ca3071aa7bab414de234ab52eea',
            location: {
              type: 'S3',
              s3Location: {
                bucketName: 'us-west-2-123456789012-my-pipeline',
                objectKey: 'my-pipeline/test-api-2/TdOSFRV'
              }
            }
          }
        ],
        outputArtifacts: [
          {
            name: 'invokeOutput',
            revision: null,
            location: {
              type: 'S3',
              s3Location: {
                bucketName: 'us-west-2-123456789012-my-pipeline',
                objectKey: 'my-pipeline/invokeOutp/D0YHsJn'
              }
            }
          }
        ],
        artifactCredentials: {
          accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
          secretAccessKey: '6CGtmAa3lzWtV7a...',
          sessionToken: 'IQoJb3JpZ2luX2VjEA...',
          expirationTime: 1575493418000
        }
      }
    }
  }

  const response = await handler(event, context)

  t.deepEqual(
    response['CodePipeline.job'].data.actionConfiguration.configuration
      .UserParameters,
    userParameters
  )
})

// CodePipeline
test('It should parse CodePipeline event', async (t) => {
  const handler = middy((event) => event).use(eventNormalizer())

  const eventJSON = {
    messageType: 'DATA_MESSAGE',
    owner: '123456789012',
    logGroup: '/aws/lambda/echo-nodejs',
    logStream: '2019/03/13/[$LATEST]94fa867e5374431291a7fc14e2f56ae7',
    subscriptionFilters: ['LambdaStream_cloudwatchlogs-node'],
    logEvents: [
      {
        id: '34622316099697884706540976068822859012661220141643892546',
        timestamp: 1552518348220,
        message:
          'REPORT RequestId: 6234bffe-149a-b642-81ff-2e8e376d8aff\tDuration: 46.84 ms\tBilled Duration: 47 ms \tMemory Size: 192 MB\tMax Memory Used: 72 MB\t\n'
      }
    ]
  }
  const event = {
    awslogs: {
      data: Buffer.from(JSON.stringify(eventJSON), 'utf-8').toString('base64')
    }
  }

  const response = await handler(event, context)

  t.deepEqual(response.awslogs.data, eventJSON)
})

// Config
test('It should parse Config event', async (t) => {
  const handler = middy((event) => event).use(eventNormalizer())

  const invokingEvent = {
    configurationItem: {
      configurationItemCaptureTime: '2016-02-17T01:36:34.043Z',
      awsAccountId: '000000000000',
      configurationItemStatus: 'OK',
      resourceId: 'i-00000000',
      ARN: 'arn:aws:ec2:us-east-1:000000000000:instance/i-00000000',
      awsRegion: 'us-east-1',
      availabilityZone: 'us-east-1a',
      resourceType: 'AWS::EC2::Instance',
      tags: { Foo: 'Bar' },
      relationships: [
        {
          resourceId: 'eipalloc-00000000',
          resourceType: 'AWS::EC2::EIP',
          name: 'Is attached to ElasticIp'
        }
      ],
      configuration: { foo: 'bar' }
    },
    messageType: 'ConfigurationItemChangeNotification'
  }
  const ruleParameters = { myParameterKey: 'myParameterValue' }
  const event = {
    invokingEvent: JSON.stringify(invokingEvent),
    ruleParameters: JSON.stringify(ruleParameters),
    resultToken: 'myResultToken',
    eventLeftScope: false,
    executionRoleArn: 'arn:aws:iam::012345678912:role/config-role',
    configRuleArn:
      'arn:aws:config:us-east-1:012345678912:config-rule/config-rule-0123456',
    configRuleName: 'change-triggered-config-rule',
    configRuleId: 'config-rule-0123456',
    accountId: '012345678912',
    version: '1.0'
  }
  const response = await handler(event, context)

  t.deepEqual(response.invokingEvent, invokingEvent)
  t.deepEqual(response.ruleParameters, ruleParameters)
})

// DynamoDB
test('It should parse DynamoDB event keys/images', async (t) => {
  const handler = middy((event) => event).use(eventNormalizer())

  const event = createEvent.default('aws:dynamo')
  event.Records[0].dynamodb.Keys = {
    NULL: { NULL: null },
    BOOL: { NULL: undefined, BOOL: '1' },
    N: { N: '1' },
    BN: { N: '19007199254740991' },
    B: { B: '1' },
    S: { S: '1' },
    L: { L: [{ N: '1' }] },
    M: { M: { Id: { N: '1' } } },
    NS: { NS: ['1'] },
    BS: { BS: ['1'] },
    SS: { SS: ['1'] }
  }

  const response = await handler(event, context)

  t.deepEqual(response.Records[0].dynamodb, {
    Keys: {
      B: '1',
      BOOL: true,
      BN: 19007199254740991n,
      BS: new Set(['1']),
      L: [1],
      M: {
        Id: 1
      },
      N: 1,
      NS: new Set([1]),
      NULL: null,
      S: '1',
      SS: new Set(['1'])
    },
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

test('It should parse DynamoDB event with wrapNumbers set', async (t) => {
  const handler = middy((event) => event).use(
    eventNormalizer({ wrapNumbers: true })
  )

  const event = createEvent.default('aws:dynamo')
  event.Records[0].dynamodb.Keys = {
    BN: { N: '-9007199254740998.25' }
  }

  const response = await handler(event, context)

  t.deepEqual(response.Records[0].dynamodb, {
    Keys: {
      BN: { value: '-9007199254740998.25' }
    },
    NewImage: {
      Message: 'New item!',
      Id: { value: '101' }
    },
    OldImage: {},
    SequenceNumber: '111',
    SizeBytes: 26,
    StreamViewType: 'NEW_AND_OLD_IMAGES'
  })
})

test('It should catch DynamoDB event with invalid BigInt', async (t) => {
  const handler = middy((event) => event).use(eventNormalizer())

  const value = '-9007199254740998.25'
  const event = createEvent.default('aws:dynamo')
  event.Records[0].dynamodb.Keys = {
    BN: { N: value }
  }

  try {
    await handler(event, context)
  } catch (e) {
    t.is(
      e.message,
      `${value} can't be converted to BigInt. Set options.wrapNumbers to get string value.`
    )
  }
})

test('It should catch DynamoDB event with unknown type', async (t) => {
  const handler = middy((event) => event).use(eventNormalizer())

  const event = createEvent.default('aws:dynamo')
  event.Records[0].dynamodb.Keys = {
    BN: { J: '1' }
  }

  try {
    await handler(event, context)
  } catch (e) {
    t.is(e.message, 'Unsupported type passed: J')
  }
})

// Apache Kafka
test('It should parse Apache Kafka event', async (t) => {
  const handler = middy((event) => event).use(eventNormalizer())

  const event = {
    eventSource: 'SelfManagedKafka',
    bootstrapServers:
      'b-2.demo-cluster-1.a1bcde.c1.kafka.us-east-1.amazonaws.com:9092,b-1.demo-cluster-1.a1bcde.c1.kafka.us-east-1.amazonaws.com:9092',
    records: {
      mytopic0: [
        {
          topic: 'mytopic',
          partition: '0',
          offset: 15,
          timestamp: 1545084650987,
          timestampType: 'CREATE_TIME',
          value: 'SGVsbG8sIHRoaXMgaXMgYSB0ZXN0Lg==',
          headers: [
            {
              headerKey: [104, 101, 97, 100, 101, 114, 86, 97, 108, 117, 101]
            }
          ]
        }
      ]
    }
  }
  const response = await handler(event, context)

  t.deepEqual(response.records.mytopic0[0].value, 'Hello, this is a test.')
})

// Kinesis Firehose
test('It should parse Kinesis Firehose event data', async (t) => {
  const handler = middy((event) => event).use(eventNormalizer())

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

// Kinesis Stream
test('It should parse Kinesis Stream event data', async (t) => {
  const handler = middy((event) => event).use(eventNormalizer())

  const data = { hello: 'world' }
  const event = createEvent.default('aws:kinesis')
  event.Records[0].kinesis.data = Buffer.from(
    JSON.stringify(data),
    'utf-8'
  ).toString('base64')
  const response = await handler(event, context)

  t.deepEqual(response.Records[0].kinesis.data, data)
})

// MQ
test('It should parse MQ event', async (t) => {
  const handler = middy((event) => event).use(eventNormalizer())

  const event = {
    eventSource: 'aws:amq',
    eventSourceArn:
      'arn:aws:mq:us-west-2:112556298976:broker:test:b-9bcfa592-423a-4942-879d-eb284b418fc8',
    messages: [
      {
        messageID:
          'ID:b-9bcfa592-423a-4942-879d-eb284b418fc8-1.mq.us-west-2.amazonaws.com-37557-1234520418293-4:1:1:1:1',
        messageType: 'jms/text-message',
        data: 'QUJDOkFBQUE=',
        connectionId: 'myJMSCoID',
        redelivered: false,
        destination: {
          physicalname: 'testQueue'
        },
        timestamp: 1598827811958,
        brokerInTime: 1598827811958,
        brokerOutTime: 1598827811959
      }
    ]
  }
  const response = await handler(event, context)

  t.deepEqual(response.messages[0].data, 'ABC:AAAA')
})

// MSK
test('It should parse MSK event', async (t) => {
  const handler = middy((event) => event).use(eventNormalizer())

  const event = {
    eventSource: 'aws:kafka',
    eventSourceArn:
      'arn:aws:kafka:sa-east-1:123456789012:cluster/vpc-2priv-2pub/751d2973-a626-431c-9d4e-d7975eb44dd7-2',
    records: {
      mytopic0: [
        {
          topic: 'mytopic',
          partition: '0',
          offset: 15,
          timestamp: 1545084650987,
          timestampType: 'CREATE_TIME',
          value: 'SGVsbG8sIHRoaXMgaXMgYSB0ZXN0Lg==',
          headers: [
            {
              headerKey: [104, 101, 97, 100, 101, 114, 86, 97, 108, 117, 101]
            }
          ]
        }
      ]
    }
  }
  const response = await handler(event, context)

  t.deepEqual(response.records.mytopic0[0].value, 'Hello, this is a test.')
})

// SNS
test('It should parse SNS event message', async (t) => {
  const handler = middy((event) => event).use(eventNormalizer())

  const message = { hello: 'world' }
  const event = createEvent.default('aws:sns')
  event.Records[0].Sns.Message = JSON.stringify(message)
  const response = await handler(event, context)

  t.deepEqual(response.Records[0].Sns.Message, message)
})

// SQS
test('It should parse SQS event body', async (t) => {
  const handler = middy((event) => event).use(eventNormalizer())

  const body = { hello: 'world' }
  const event = createEvent.default('aws:sqs')
  event.Records[0].body = JSON.stringify(body)
  const response = await handler(event, context)

  t.deepEqual(response.Records[0].body, body)
})

// S3
test('It should normalize S3 event key', async (t) => {
  const handler = middy((event) => event).use(eventNormalizer())

  const event = createEvent.default('aws:s3')
  event.Records[0].s3.object.key = 'This+is+a+picture.jpg'
  const response = await handler(event, context)

  t.is(response.Records[0].s3.object.key, 'This is a picture.jpg')
})

// S3 Batch
test('It should normalize S3 Batch event key', async (t) => {
  const handler = middy((event) => event).use(eventNormalizer())

  const event = {
    invocationSchemaVersion: '1.0',
    invocationId: 'YXNkbGZqYWRmaiBhc2RmdW9hZHNmZGpmaGFzbGtkaGZza2RmaAo',
    job: {
      id: 'f3cc4f60-61f6-4a2b-8a21-d07600c373ce'
    },
    tasks: [
      {
        taskId: 'dGFza2lkZ29lc2hlcmUK',
        s3Key: 'customer+Image+1.jpg',
        s3VersionId: '1',
        s3BucketArn: 'arn:aws:s3:us-east-1:0123456788:examplebucket'
      }
    ]
  }
  const response = await handler(event, context)

  t.is(response.tasks[0].s3Key, 'customer Image 1.jpg')
})

// S3 -> SNS -> SQS
test('It should parse S3 -> SNS -> SQS event', async (t) => {
  const handler = middy((event) => event).use(eventNormalizer())

  const event = {
    Records: [
      {
        messageId: '07dee686-bfa4-40d0-a85f-4194e204dbaa',
        receiptHandle: 'XNIOA7DA==',
        body: '{\n  "Type" : "Notification",\n  "MessageId" : "00e1a25f-b7c9-5cdf-a548-f838aec0e14b",\n  "TopicArn" : "arn:aws:sns:ca-central-1:********:topic",\n  "Subject" : "Amazon S3 Notification",\n  "Message" : "{\\"Records\\":[{\\"eventVersion\\":\\"2.1\\",\\"eventSource\\":\\"aws:s3\\",\\"awsRegion\\":\\"ca-central-1\\",\\"eventTime\\":\\"2022-01-23T08:50:15.375Z\\",\\"eventName\\":\\"ObjectCreated:Put\\",\\"userIdentity\\":{\\"principalId\\":\\"AWS:********\\"},\\"requestParameters\\":{\\"sourceIPAddress\\":\\"0.0.0.0\\"},\\"responseElements\\":{\\"x-amz-request-id\\":\\"*******\\",\\"x-amz-id-2\\":\\"*****\\"},\\"s3\\":{\\"s3SchemaVersion\\":\\"1.0\\",\\"configurationId\\":\\"dataset\\",\\"bucket\\":{\\"name\\":\\"s3-upload\\",\\"ownerIdentity\\":{\\"principalId\\":\\"********\\"},\\"arn\\":\\"arn:aws:s3:::s3-upload\\"},\\"object\\":{\\"key\\":\\"path/to/file.csv\\",\\"size\\":9109,\\"eTag\\":\\"*****\\",\\"sequencer\\":\\"0061ED16C7445880F0\\"}}}]}",\n  "Timestamp" : "2022-01-23T08:50:16.906Z",\n  "SignatureVersion" : "1",\n  "Signature" : "********",\n  "SigningCertURL" : "https://sns.ca-central-1.amazonaws.com/SimpleNotificationService-*****.pem",\n  "UnsubscribeURL" : "https://sns.ca-central-1.amazonaws.com/?Action=Unsubscribe&SubscriptionArn=arn:aws:sns:ca-central-1:*********:topic:cfa3ee69-92f9-4db8-9784-f647f868952d"\n}',
        attributes: {
          ApproximateReceiveCount: '1',
          SentTimestamp: '1642927816967',
          SenderId: 'AIDAJKASJ4',
          ApproximateFirstReceiveTimestamp: '1642927816972'
        },
        messageAttributes: {},
        md5OfBody: '141dbdeb46110bc11a04210ac6b5efaf',
        eventSource: 'aws:sqs',
        eventSourceARN: 'arn:aws:sqs:ca-central-1:*********:queue',
        awsRegion: 'ca-central-1'
      }
    ]
  }
  const response = await handler(event, context)

  t.deepEqual(response.Records[0].body.Message.Records[0].eventSource, 'aws:s3')
})
