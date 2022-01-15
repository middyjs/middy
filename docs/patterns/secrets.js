/**
 * Pull Secrets or Configuration details from AWS services
 */
import middy from '@middy/core'
import { getInternal } from '@middy/util'
import rdsSignerMiddleware from '@middy/rds-signer'
import secretsManagerMiddleware from '@middy/secrets-manager'
import ssmMiddleware from '@middy/ssm'
import stsMiddleware from '@middy/sts'

const lambdaHandler = (event) => {
  return Promise.allSettled(event.Records.map(async (record) => record))
}
const handler = middy(lambdaHandler)
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

export default { handler }
