const { unmarshall } = require('aws-sdk/lib/dynamodb/converter')
const { jsonSafeParse } = require('@middy/util')

const eventNormalizerMiddleware = (opts = {}) => {

  const eventNormalizerMiddlewareBefore = async (request) => {
    parseEventRecords(request.event)
  }
  return {
    before: eventNormalizerMiddlewareBefore
  }
}

const normalizeS3KeyReplacePlus = /\+/g
const parseEventRecords = (event) => {
  const records = event?.Records ?? event?.records
  if (!Array.isArray(records)) return

  for (const record of records) {
    if (record.EventSource === 'aws:sns') {
      record.Sns.Message = jsonSafeParse(record.Sns.Message)
      parseEventRecords(record.Sns.Message)
    } else if (record.eventSource === 'aws:sqs') {
      record.body = jsonSafeParse(record.body, options.reviver)
      parseEventRecords(record.body)
    } else if (record.eventSource === 'aws:dynamodb') {
      unmarshall(record.dynamodb.Keys)
      unmarshall(record.dynamodb.OldImage)
      unmarshall(record.dynamodb.NewImage)
    } else if (record.eventSource === 'aws:s3') {
      record.s3.object.key = decodeURIComponent(
        record.s3.object.key.replace(normalizeS3KeyReplacePlus, ' ')
      )
    } else if (record.eventSource === 'aws:kinesis') {
      record.kinesis.data = jsonSafeParse(Buffer.from(record.kinesis.data).toString())
    } else if (record.kinesisRecordMetadata) {
      // Kinesis Firehose
      record.data = jsonSafeParse(Buffer.from(record.data).toString())
    }
  }
}

module.exports = eventNormalizerMiddleware
