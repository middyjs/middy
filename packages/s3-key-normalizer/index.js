const normalizeKey = (key) => decodeURIComponent(key.replace(/\+/g, ' '))

module.exports = () => ({
  before: (handler, next) => {
    if (handler.event.Records && Array.isArray(handler.event.Records)) {
      handler.event.Records = handler.event.Records.map((record) => {
        const eventVersion = parseFloat(record.eventVersion)
        if (record.s3 && record.s3.object && eventVersion >= 2 && eventVersion < 3) {
          record.s3.object.key = normalizeKey(record.s3.object.key)
        }
        return record
      })
    }
    next()
  }
})
