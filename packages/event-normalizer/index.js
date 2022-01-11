import DynamoDB from 'aws-sdk/clients/dynamodb.js'
// import { unmarshall } from '@aws-sdk/util-dynamodb' // v3
import { jsonSafeParse } from '@middy/util' // v2
const { unmarshall } = DynamoDB.Converter

const eventNormalizerMiddleware = () => {
  const eventNormalizerMiddlewareBefore = async (request) => {
    parseEventRecords(request.event)
  }
  return {
    before: eventNormalizerMiddlewareBefore
  }
}

const parseEventRecords = (event) => {
  const records = event.Records ?? event.records // lowercase records is for Kinesis Firehose
  if (!Array.isArray(records)) return

  let eventSource
  for (const record of records) {
    // EventSource is for SNS
    // deliveryStreamArn is for Kinesis Firehose
    eventSource ??= record.eventSource ?? record.EventSource ?? event.deliveryStreamArn
    parseEvent[eventSource]?.(record)
  }
}

const normalizeS3KeyReplacePlus = /\+/g
const parseEvent = {
  'aws:dynamodb': (record) => {
    record.dynamodb.Keys = unmarshall(record.dynamodb.Keys)
    record.dynamodb.OldImage = unmarshall(record.dynamodb.OldImage)
    record.dynamodb.NewImage = unmarshall(record.dynamodb.NewImage)
  },
  // Kinesis Stream
  'aws:kinesis': (record) => {
    record.kinesis.data = jsonSafeParse(Buffer.from(record.kinesis.data, 'base64').toString('utf-8'))
  },
  // Kinesis Firehose
  'aws:lambda:events': (record) => {
    record.data = jsonSafeParse(Buffer.from(record.data, 'base64').toString('utf-8'))
  },
  'aws:s3': (record) => {
    record.s3.object.key = decodeURIComponent(record.s3.object.key.replace(normalizeS3KeyReplacePlus, ' '))
  },
  'aws:sns': (record) => {
    record.Sns.Message = jsonSafeParse(record.Sns.Message)
    parseEventRecords(record.Sns.Message)
  },
  'aws:sqs': (record) => {
    record.body = jsonSafeParse(record.body)
    parseEventRecords(record.body)
  }
}

export default eventNormalizerMiddleware
