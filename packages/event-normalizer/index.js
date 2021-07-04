const { Converter: {unmarshall} } = require('aws-sdk/clients/dynamodb') // v2
// const { unmarshall } = require('@aws-sdk/util-dynamodb') // v3
const { jsonSafeParse } = require('@middy/util')

const eventNormalizerMiddleware = () => {
  const eventNormalizerMiddlewareBefore = async (request) => {
    parseEventRecords(request.event)
  }
  return {
    before: eventNormalizerMiddlewareBefore
  }
}

const normalizeS3KeyReplacePlus = /\+/g
const parseEventRecords = (event) => {
  const records = event?.Records ?? event?.records // lowercase records is for Kinesis Firehose
  if (!Array.isArray(records)) return

  for (const record of records) {
    if (record.EventSource === 'aws:sns') {
      record.Sns.Message = jsonSafeParse(record.Sns.Message)
      parseEventRecords(record.Sns.Message)
    } else if (record.eventSource === 'aws:sqs') {
      record.body = jsonSafeParse(record.body)
      parseEventRecords(record.body)
    } else if (record.eventSource === 'aws:dynamodb') {
      record.dynamodb.Keys = unmarshall(record.dynamodb.Keys)
      record.dynamodb.OldImage = unmarshall(record.dynamodb.OldImage)
      record.dynamodb.NewImage = unmarshall(record.dynamodb.NewImage)
    } else if (record.eventSource === 'aws:s3') {
      record.s3.object.key = decodeURIComponent(
        record.s3.object.key.replace(normalizeS3KeyReplacePlus, ' ')
      )
    } else if (record.eventSource === 'aws:kinesis') {
      // Kinesis Stream
      record.kinesis.data = jsonSafeParse(
        Buffer.from(record.kinesis.data, 'base64').toString('utf-8')
      )
    } else if (record.kinesisRecordMetadata) {
      // Kinesis Firehose
      record.data = jsonSafeParse(
        Buffer.from(record.data, 'base64').toString('utf-8')
      )
    }
  }
}

module.exports = eventNormalizerMiddleware
