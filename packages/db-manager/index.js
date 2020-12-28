const knex = require('knex')
const RDS = require('aws-sdk/clients/rds')

let dbInstance

export default (opts = {}) => {
  const defaults = {
    client: knex,
    config: null,
    forceNewConnection: false,
    rdsSigner: null,
    removeSecrets: true,
    secretsParam: 'password', // if `secretsPath` returns an object, ignore value
    secretsPath: null // provide path where credentials lay in context, default to try to get RDS authToken
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
    before: async (handler) => {
      const {
        client,
        config,
        forceNewConnection,
        rdsSigner,
        removeSecrets,
        secretsParam,
        secretsPath
      } = options

      if (!config) {
        throw new Error('Config is required in dbManager')
      }

      if (!dbInstance || forceNewConnection) {
        let secrets = {}

        if (rdsSigner) {
          secrets[secretsParam] = await signer(rdsSigner)
        } else if (secretsPath) {
          // catch Secrets Manager response
          if (typeof handler.context[secretsPath] === 'object') {
            secrets = handler.context[secretsPath]
          } else {
            secrets[secretsParam] = handler.context[secretsPath]
          }
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
