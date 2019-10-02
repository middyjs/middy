
const knex = require('knex')

let dbInstance

module.exports = (opts) => {
  const defaults = {
    client: knex,
    config: null,
    forceNewConnection: false,
    secretsPath: null, // provide path where credentials lay in context
    removeSecrets: true
  }

  const options = Object.assign({}, defaults, opts)

  function cleanup (handler, next) {
    if (options.forceNewConnection && (dbInstance && dbInstance.destroy instanceof Function)) {
      dbInstance.destroy((err, data) => {
        dbInstance = null
        next(err || handler.error, data)
      })
    }
    next(handler.error)
  }

  return {
    before: (handler, next) => {
      const {
        client,
        config,
        forceNewConnection,
        secretsPath,
        removeSecrets
      } = options

      if (!config) {
        throw new Error('Config is required in dbManager')
      }
      if (!dbInstance || forceNewConnection) {
        if (secretsPath) {
          config.connection = Object.assign({}, config.connection || {}, handler.context[secretsPath])
        }
        dbInstance = client(config)
      }

      Object.assign(handler.context, { db: dbInstance })
      if (secretsPath && removeSecrets) {
        delete handler.context[secretsPath]
      }
      return next()
    },

    after: cleanup,
    onError: cleanup
  }
}
