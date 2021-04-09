const normalizeKeyReplacePlus = /\+/g
const normalizeKey = (key) => decodeURIComponent(key.replace(normalizeKeyReplacePlus, ' '))

const s3KeyNormalizerMiddlewareBefore = async (request) => {
  if (request.event.Records && Array.isArray(request.event.Records)) {
    request.event.Records = request.event.Records.map((record) => {
      const eventVersion = parseFloat(record.eventVersion)
      if (
        record.s3 &&
        record.s3.object &&
        eventVersion >= 2 &&
        eventVersion < 3
      ) {
        record.s3.object.key = normalizeKey(record.s3.object.key)
      }
      return record
    })
  }
}

const s3KeyNormalizerMiddleware = () => ({
  before: s3KeyNormalizerMiddlewareBefore
})
module.exports = s3KeyNormalizerMiddleware
