const s3KeyNormalizerMiddleware = () => ({
  before: s3KeyNormalizerMiddlewareBefore
})

const s3KeyNormalizerMiddlewareBefore = async (request) => {
  parseEvent(request.event)
}

const parseEvent = (event) => {
  if (!Array.isArray(event?.Records)) return

  for (const record of event.Records) {
    if (record.eventSource === 'aws:s3') {
      normalizeS3Key(record)
    } else if (record.eventSource === 'aws:sqs') {
      parseEvent(record.body)
    } else if (record.EventSource === 'aws:sns') {
      parseEvent(record.Sns.Message)
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
}

module.exports = s3KeyNormalizerMiddleware
