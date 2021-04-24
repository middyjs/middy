const s3KeyNormalizerMiddleware = () => ({
  before: s3KeyNormalizerMiddlewareBefore
})

const s3KeyNormalizerMiddlewareBefore = async (request) => {
  parseEvent(request.event)
}

const parseEvent = (event) => {
  const records = event?.Records
  if (!Array.isArray(records)) return

  for (const record of records) {
    if (record.eventSource === 'aws:s3') {
      normalizeS3Key(record)
    } else if (record.EventSource === 'aws:sns') {
      parseEvent(record.Sns.Message)
    } else if (record.eventSource === 'aws:sqs') {
      parseEvent(record.body)
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
