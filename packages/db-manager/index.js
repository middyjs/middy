const knex = require('knex')
const RDS = require('aws-sdk/clients/rds')

let dbInstance

module.exports = (opts) => {
  const defaults = {
    client: knex,
    config: null,
    rdsSigner: null,
    forceNewConnection: false,
    secretsPath: null, // provide path where credentials lay in context, default to try to get RDS authToken
    removeSecrets: true
  }

  const options = Object.assign({}, defaults, opts)

  const cleanup = (handler, next) => {
    if (options.forceNewConnection && (dbInstance && typeof dbInstance.destroy === 'function')) {
      dbInstance.destroy((err) => next(err || handler.error))
    }
    next(handler.error)
  }

  const signer = (config) => {
    if (typeof config.port === 'string') config.port = Number.parseInt(config.port)
    const signer = new RDS.Signer(config)
    return new Promise((resolve, reject) => {
      signer.getAuthToken({}, (err, token) => {
        if (err) {
          reject(err)
        }
        resolve(token)
      })
    })
  }

  return {
    before: async (handler, next) => {
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
        const secrets = {}

        if (options.rdsSigner && secretsPath) {
          secrets[secretsPath] = await signer(options.rdsSigner)
        } else if (secretsPath) {
          secrets[secretsPath] = handler.context[secretsPath]
        }
        config.connection = Object.assign({}, config.connection || {}, secrets)

        dbInstance = client(config)
      }

      Object.assign(handler.context, { db: dbInstance })
      if (secretsPath && removeSecrets) {
        delete handler.context[secretsPath]
      }
    },

    after: cleanup,
    onError: cleanup
  }
}
