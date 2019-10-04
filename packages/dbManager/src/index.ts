import { MiddyHandler, NextFunction, DbManagerOptions, DbManagerClient } from './types';
import knex from 'knex';

let dbInstance: DbManagerClient

export default (opts: DbManagerOptions) => {
  const defaults: DbManagerOptions = {
    client: knex,
    config: null,
    forceNewConnection: false,
    secretsPath: null, // provide path where credentials lay in context
    removeSecrets: true
  }

  const options = Object.assign({}, defaults, opts)

  function cleanup (handler: MiddyHandler, next: NextFunction) {
    if (options.forceNewConnection && (dbInstance && typeof dbInstance.destroy === 'function')) {
      dbInstance.destroy((err: any) => next(err || handler.error))
    }
    next(handler.error)
  }

  return {
    before: (handler: MiddyHandler, next: NextFunction) => {
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
