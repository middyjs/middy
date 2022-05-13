import DynamoDB from 'aws-sdk/clients/dynamodb.js' // v2
// import { unmarshall } from '@aws-sdk/util-dynamodb' // v3
import { jsonSafeParse } from '@middy/util'
const { unmarshall } = DynamoDB.Converter

const eventNormalizerMiddleware = () => {
  const eventNormalizerMiddlewareBefore = async (request) => {
    parseEvent(request.event)
  }
  return {
    before: eventNormalizerMiddlewareBefore
  }
}

const parseEvent = (event) => {
  // event.eventSource => aws:amq, aws:kafka, aws:SelfManagedKafka
  // event.deliveryStreamArn => aws:lambda:events
  let eventSource = event.eventSource ?? event.deliveryStreamArn

  // event.records => aws:lambda:events
  // event.messages => aws:amq
  // event.tasks => aws:s3:batch
  const records =
    event.Records ?? event.records ?? event.messages ?? event.tasks

  if (!Array.isArray(records)) {
    // event.configRuleId => aws:config
    // event.awslogs => aws:cloudwatch
    // event['CodePipeline.job'] => aws:codepipeline
    eventSource ??=
      (event.configRuleId && 'aws:config') ??
      (event.awslogs && 'aws:cloudwatch') ??
      (event['CodePipeline.job'] && 'aws:codepipeline')
    if (eventSource) {
      events[eventSource]?.(event)
    }
    return
  }

  // record.EventSource => aws:sns
  eventSource ??=
    records[0].eventSource ??
    records[0].EventSource ??
    (records[0].s3Key && 'aws:s3:batch')
  for (const record of records) {
    events[eventSource]?.(record)
  }
}

const events = {
  'aws:amq': (message) => {
    message.data = base64Parse(message.data)
  },
  'aws:cloudwatch': (event) => {
    event.awslogs.data = base64Parse(event.awslogs.data)
  },
  'aws:codepipeline': (event) => {
    event[
      'CodePipeline.job'
    ].data.actionConfiguration.configuration.UserParameters = jsonSafeParse(
      event['CodePipeline.job'].data.actionConfiguration.configuration
        .UserParameters
    )
  },
  'aws:config': (event) => {
    event.invokingEvent = jsonSafeParse(event.invokingEvent)
    event.ruleParameters = jsonSafeParse(event.ruleParameters)
  },
  'aws:dynamodb': (record) => {
    record.dynamodb.Keys = unmarshall(record.dynamodb.Keys)
    record.dynamodb.OldImage = unmarshall(record.dynamodb.OldImage)
    record.dynamodb.NewImage = unmarshall(record.dynamodb.NewImage)
  },
  'aws:kafka': (event) => {
    for (const record in event.records) {
      for (const topic of event.records[record]) {
        topic.value = base64Parse(topic.value)
      }
    }
  },
  // Kinesis Stream
  'aws:kinesis': (record) => {
    record.kinesis.data = base64Parse(record.kinesis.data)
  },
  // Kinesis Firehose
  'aws:lambda:events': (record) => {
    record.data = base64Parse(record.data)
  },
  'aws:s3': (record) => {
    record.s3.object.key = normalizeS3Key(record.s3.object.key)
  },
  'aws:s3:batch': (task) => {
    task.s3Key = normalizeS3Key(task.s3Key)
  },
  'aws:SelfManagedKafka': (event) => {
    events['aws:kafka'](event)
  },
  'aws:sns': (record) => {
    record.Sns.Message = jsonSafeParse(record.Sns.Message)
    parseEvent(record.Sns.Message)
  },
  'aws:sns:sqs': (record) => {
    record.Message = jsonSafeParse(record.Message)
    parseEvent(record.Message)
  },
  'aws:sqs': (record) => {
    record.body = jsonSafeParse(record.body)
    // SNS -> SQS Special Case
    if (record.body.Type === 'Notification') {
      events['aws:sns:sqs'](record.body)
    } else {
      parseEvent(record.body)
    }
  }
}
const base64Parse = (data) =>
  jsonSafeParse(Buffer.from(data, 'base64').toString('utf-8'))
const normalizeS3Key = (key) => decodeURIComponent(key.replaceAll('+', ' '))

export default eventNormalizerMiddleware
