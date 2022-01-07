/**
 * Pull Secrets or Configuration details from AWS services
 */
const middy = require('@middy/core')
const { getInternal } = require('@middy/util')
const rdsSignerMiddleware = require('@middy/rds-signer')
const secretsManagerMiddleware = require('@middy/secrets-manager')
const ssmMiddleware = require('@middy/ssm')
const stsMiddleware = require('@middy/sts')

const baseHandler = (event) => {
  return Promise.allSettled(event.Records.map(async (record) => record))
}
const handler = middy(baseHandler)
  .use(
    rdsSignerMiddleware({
      fetchData: {
        rdsToken: {
          region: process.env.AWS_REGION,
          hostname: process.env.rdsHostname,
          username: 'iam_api',
          database: 'database',
          port: 5555
        }
      }
    })
  )
  .use(
    secretsManagerMiddleware({
      fetchData: {
        key: '/dev/service_name/key_name'
      }
    })
  )
  .use(
    ssmMiddleware({
      fetchData: {
        key: '/dev/service_name/key_name'
      }
    })
  )
  .use(
    stsMiddleware({
      fetchData: {
        role: {
          RoleArn: '.../role'
        }
      }
    })
  )
  .before(async (request) => {
    request.context.secrets = await getInternal(true, request)
  })

module.exports = { handler }
