

/**
 * Pull Secrets or Configuration details from AWS services
 */
const middy = require('@middy/core')
// const dynamodb = require('@middy/dynamodb') # See #595
// const s3 = require('@middy/s3') # See #594
const secretsManagerMiddleware = require('@middy/secrets-manager')
const ssm = require('@middy/ssm')
const sts = require('@middy/sts')

const handler = middy((event) => {
  return Promise.allSettled(event.Records.map(async (record) => record))
})
  .use(
    secretsManagerMiddleware({
      //AwsClient: SecretsManager
    })
  )
  .use(
    ssm({
      //AwsClient: SSM
    })
  )
  .use(
    sts({
      //AwsClient: STS
    })
  )

module.exports = { handler, event }
