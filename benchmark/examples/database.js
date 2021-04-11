const knex = require('knex')

const middy = require('@middy/core')
const doNotWaitForEmptyEventLoopMiddleware = require('@middy/do-not-wait-for-empty-event-loop')
const rdsSignerMiddleware = require('@middy/rds-signer')
const rdsMiddleware = require('middy-rds')

const handler = middy()
  .use(doNotWaitForEmptyEventLoopMiddleware())
  .use(rdsSignerMiddleware({
    fetchData: {
      rdsToken: {
        region: process.env.AWS_REGION,
        hostname: process.env.rdsHostname,
        username: 'iam_api',
        database: 'database',
        port: 5432
      }
    }
  }))
  .use(rdsMiddleware({
    internalData: {
      password: 'rdsToken'
    },
    client: knex,
    config: {
      client: 'pg',
      connection: {
        host: process.env.rdsHostname,
        user: 'iam_api',
        database: 'database'
      }
    }
  }))

module.exports = { handler }
