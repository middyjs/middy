import { promisify } from 'util'
import { canPrefetch, getInternal, processCache } from '../core/util.js'

const knex = require('knex')

const defaults = {
  config: {},
  fetchData: {}, // grab from context
  cacheKey: 'db',
  cacheExpiry: -1,
}

export default (opts = {}) => {
  const options = Object.assign({}, defaults, opts)
  options.disablePrefetch = 0 < Object.keys(options.fetchData).length

  const fetch = async (handler) => {
    const values = await getInternal(options.fetchData, handler)
    options.config.connection = Object.assign({}, options.config.connection, values)
    const db = knex(options.config)
    db.raw('SELECT 1')  // don't await, used to force open connection

    // cache the connection, not the credentials as they may change over time
    return db
  }

  let prefetch
  if (canPrefetch(options)) {
    prefetch = processCache(options, fetch)
  }

  const dbMiddlewareBefore = async (handler) => {
    if (canPrefetch(options)) {
      await prefetch
    }

    const cached = await processCache(options, fetch, handler)

    Object.assign(handler.context, { db: cached })
  }
  const dbMiddlewareAfter = async (handler) => {
    if (!options.cacheExpiry) {
      await promisify(handler.context.db.destroy)()
    }
  }
  const dbMiddlewareOnError = dbMiddlewareAfter

  return {
    before: dbMiddlewareBefore,
    after: dbMiddlewareAfter,
    onError: dbMiddlewareOnError
  }
}
