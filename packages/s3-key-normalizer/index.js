const s3KeyNormalizerMiddleware = () => ({
  before: s3KeyNormalizerMiddlewareBefore
})

const s3KeyNormalizerMiddlewareBefore = async (request) => {
  parseEvent(request.event)
}

const parseEvent = (event) => {
  if (!Array.isArray(event?.Records)) return

  for (const record of event.Records) {
    switch (record.eventSource) {
      case 'aws:sns':
        parseEvent(record.Sns.Message)
        break
      case 'aws:sqs':
        parseEvent(record.body)
        break
      case 'aws:s3':
        normalizeS3Key(record)
        break
    }
  }
}

const normalizeS3KeyReplacePlus = /\+/g
const normalizeS3Key = (record) => {
  const eventVersion = Number.parseFloat(record.eventVersion)
  if (record?.s3?.object?.key && eventVersion >= 2 && eventVersion < 3) {
    record.s3.object.key = decodeURIComponent(
      record.s3.object.key.replace(normalizeS3KeyReplacePlus, ' ')
    )
  }
  return record
}

module.exports = s3KeyNormalizerMiddleware
