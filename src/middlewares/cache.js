const { createHash } = require('crypto')

module.exports = (opts) => {
  const defaultStorage = {}
  const defaults = {
    calculateCacheId: (event) => Promise.resolve(createHash('md5').update(JSON.stringify(event)).digest('hex')),
    getValue: (key) => Promise.resolve(defaultStorage[key]),
    setValue: (key, value) => {
      defaultStorage[key] = value
      return Promise.resolve()
    }
  }

  const options = Object.assign({}, defaults, opts)
  let currentCacheKey

  return ({
    before: (handler, next) => {
      options.calculateCacheId(handler.event)
        .then((cacheKey) => {
          currentCacheKey = cacheKey
          return options.getValue(cacheKey)
        })
        .then((cachedResponse) => {
          if (typeof cachedResponse !== 'undefined') {
            return handler.callback(null, cachedResponse)
          }

          return next()
        })
    },
    after: (handler, next) => {
      // stores the calculated response in the cache
      options.setValue(currentCacheKey, handler.response)
        .then(() => next())
        .catch(err => next(err))
    }
  })
}
