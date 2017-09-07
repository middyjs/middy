const normalizeKey = (key) => decodeURIComponent(key.replace(/\+/g, ' '))

module.exports = () => ({
  before: (handler, next) => {
    if (handler.event.Records && Array.isArray(handler.event.Records)) {
      handler.event.Records = handler.event.Records.map((record) => {
        if (record.s3 && record.eventVersion === '2.0') {
          record.s3.key = normalizeKey(record.s3.key)
        }
        return record
      })
    }
    next()
  }
})
