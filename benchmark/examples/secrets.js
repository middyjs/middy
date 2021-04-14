process.env.rdsHostname = ''

const sinon = require('sinon')
const RDS = require('aws-sdk/clients/rds.js')
RDS.Signer.prototype.getAuthToken = sinon
  .createSandbox()
  .stub()
  .returns({
    promise: () =>
      Promise.resolve({
        SecretString: 'token'
      })
  })

const SecretsManager = require('aws-sdk/clients/secretsmanager.js')
SecretsManager.prototype.getSecretValue = sinon
  .createSandbox()
  .stub()
  .returns({
    promise: () =>
      Promise.resolve({
        SecretString: 'token'
      })
  })
const SSM = require('aws-sdk/clients/ssm.js')
SSM.prototype.getParameters = sinon
  .createSandbox()
  .stub()
  .returns({
    promise: () =>
      Promise.resolve({
        Parameters: [{ Name: '/dev/service_name/key_name', Value: 'key-value' }]
      })
  })
const STS = require('aws-sdk/clients/sts.js')
STS.prototype.assumeRole = sinon
  .createSandbox()
  .stub()
  .returns({
    promise: () =>
      Promise.resolve({
        Credentials: {
          AccessKeyId: 'accessKeyId',
          SecretAccessKey: 'secretAccessKey',
          SessionToken: 'sessionToken'
        }
      })
  })

/**
 * Pull Secrets or Configuration details from AWS services
 */
const middy = require('@middy/core')
const { getInternal } = require('@middy/util')
// const dynamodb = require('@middy/dynamodb') # See #595
const rdsSignerMiddleware = require('@middy/rds-signer')
// const s3 = require('@middy/s3') # See #594
const secretsManagerMiddleware = require('@middy/secrets-manager')
const ssm = require('@middy/ssm')
const sts = require('@middy/sts')

const handler = middy((event) => {
  return Promise.allSettled(event.Records.map(async (record) => record))
})
  .use(
    rdsSignerMiddleware({
      AwsClient: RDS.Signer,
      fetchData: {
        rdsToken: {
          region: process.env.AWS_REGION,
          hostname: process.env.rdsHostname,
          username: 'iam_api',
          database: 'database',
          port: 5432
        }
      }
    })
  )
  .use(
    secretsManagerMiddleware({
      AwsClient: SecretsManager,
      fetchData: {
        key: '/dev/service_name/key_name'
      }
    })
  )
  .use(
    ssm({
      AwsClient: SSM,
      fetchData: {
        key: '/dev/service_name/key_name'
      }
    })
  )
  .use(
    sts({
      AwsClient: STS,
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
