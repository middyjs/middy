import { jsonSafeParse } from '@middy/util'

const defaults = {
  wrapNumbers: undefined
}

let _wrapNumbers
const eventNormalizerMiddleware = (opts = {}) => {
  const { wrapNumbers } = { ...defaults, ...opts }
  _wrapNumbers = wrapNumbers
  const eventNormalizerMiddlewareBefore = async (request) => {
    parseEvent(request.event)
  }
  return {
    before: eventNormalizerMiddlewareBefore
  }
}

const parseEvent = (event) => {
  // event.eventSource => aws:amq, aws:docdb, aws:kafka, SelfManagedKafka
  // event.deliveryStreamArn => aws:lambda:events
  let eventSource = event.eventSource ?? event.deliveryStreamArn

  // event.Records => default
  // event.records => aws:lambda:events
  // event.messages => aws:amq
  // event.tasks => aws:s3:batch
  // event.events => aws:docdb
  const records =
    event.Records ??
    event.records ??
    event.messages ??
    event.tasks ??
    event.events

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

  // record.eventSource => default
  // record.EventSource => aws:sns
  // record.s3Key => aws:s3:batch
  eventSource ??=
    records[0].eventSource ??
    records[0].EventSource ??
    (records[0].s3Key && 'aws:s3:batch')
  for (const record of records) {
    events[eventSource]?.(record)
  }
}

const normalizeS3KeyReplacePlus = /\+/g
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
  // 'aws:docdb': (record) => {},
  'aws:dynamodb': (record) => {
    record.dynamodb.Keys = unmarshall(record.dynamodb.Keys)
    record.dynamodb.NewImage = unmarshall(record.dynamodb.NewImage)
    record.dynamodb.OldImage = unmarshall(record.dynamodb.OldImage)
  },
  'aws:kafka': (event) => {
    for (const record in event.records) {
      for (const topic of event.records[record]) {
        topic.value &&= base64Parse(topic.value)
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
  SelfManagedKafka: (event) => {
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
const normalizeS3Key = (key) =>
  decodeURIComponent(key.replace(normalizeS3KeyReplacePlus, ' ')) // decodeURIComponent(key.replaceAll('+', ' '))

// Start: AWS SDK unmarshall
// Reference: https://github.com/aws/aws-sdk-js-v3/blob/v3.113.0/packages/util-dynamodb/src/convertToNative.ts
const unmarshall = (data) => convertValue.M(data ?? {})

const convertValue = {
  NULL: () => null,
  BOOL: Boolean,
  N: (value) => {
    if (_wrapNumbers) {
      return { value }
    }

    const num = Number(value)
    if (
      (Number.MAX_SAFE_INTEGER < num || num < Number.MIN_SAFE_INTEGER) &&
      num !== Number.NEGATIVE_INFINITY &&
      num !== Number.POSITIVE_INFINITY
    ) {
      try {
        return BigInt(value)
      } catch (error) {
        throw new Error(
          `${value} can't be converted to BigInt. Set options.wrapNumbers to get string value.`
        )
      }
    }
    return num
  },
  B: (value) => value,
  S: (value) => value,
  L: (value) => value.map((item) => convertToNative(item)),
  M: (value) =>
    Object.entries(value).reduce(
      (acc, [key, value]) => ({
        ...acc,
        [key]: convertToNative(value)
      }),
      {}
    ),
  NS: (value) => new Set(value.map(convertValue.N)),
  BS: (value) => new Set(value.map(convertValue.B)),
  SS: (value) => new Set(value.map(convertValue.S))
}

const convertToNative = (data) => {
  for (const [key, value] of Object.entries(data)) {
    if (!convertValue[key]) {
      throw new Error(`Unsupported type passed: ${key}`, {
        cause: { package: '@middy/event-normalizer' }
      })
    }
    if (typeof value === 'undefined') continue
    return convertValue[key](value)
  }
}
// End: AWS SDK unmarshall

export default eventNormalizerMiddleware
