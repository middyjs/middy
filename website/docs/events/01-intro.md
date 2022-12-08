---
title: All AWS Events
position: 1
---

Middy is built to help with all AWS Events that can connect with AWS Lambda.

## Middlewares that can benefit any Lambda

```javascript
import middy from '@middy/core'
import cloudWatchMetricsMiddleware from '@middy/cloudwatch-metrics'
import errorLoggerMiddleware from '@middy/error-logger'
import inputOutputLoggerMiddleware from '@middy/input-output-logger'
import validatorMiddleware from 'validator'
import warmupMiddleware from 'warmup'

import eventSchema from './eventSchema.json' assert { type: 'json' }
import responseSchema from './responseSchema.json' assert { type: 'json' }

const handler = middy()
  .use(warmupMiddleware())
  .use(cloudWatchMetricsMiddleware())
  .use(inputOutputLoggerMiddleware())
  .use(errorLoggerMiddleware())
  .use(validatorMiddleware({ eventSchema, responseSchema }))
  .handler(async (event, context, { signal }) => {
    // ...
  })
```

## Need secrets? We have you covered there too

```javascript
import middy from '@middy/core'
import { getInternal } from '@middy/util'
import rdsSignerMiddleware from '@middy/rds-signer'
import secretsManagerMiddleware from '@middy/secrets-manager'
import ssmMiddleware from '@middy/ssm'
import stsMiddleware from '@middy/sts'

export const handler = middy()
  .use(
    rdsSignerMiddleware({
      fetchData: {
        rdsSigner: {
          region: process.env.AWS_REGION,
          hostname: process.env.RDS_HOSTNAME,
          username: 'iam_role',
          database: 'database',
          port: 5555
        }
      }
    })
  )
  .use(
    secretsManagerMiddleware({
      fetchData: {
        secretsManager: '/dev/service_name/key_name'
      }
    })
  )
  .use(
    ssmMiddleware({
      fetchData: {
        ssm: '/dev/service_name/key_name'
      }
    })
  )
  .use(
    stsMiddleware({
      fetchData: {
        sts: {
          RoleArn: '.../role'
        }
      }
    })
  )
  .before(async (request) => {
    request.context.secrets = await getInternal(true, request)
  })
  .handler(async (event, context, { signal }) => {
    // context.secrets = { rdsSigner, secretsManager, ssm, sts }
  })
```

## Need configs? We have you covered there as well

```javascript
import middy from '@middy/core'
import { getInternal } from '@middy/util'
import appConfigMiddleware from '@middy/appconfig'
import ssmMiddleware from '@middy/ssm'

export const handler = middy()
  .use(
    ssmMiddleware({
      fetchData: {
        ssm: '/dev/service_name/key_name'
      }
    })
  )
  .before(async (request) => {
    request.context.configs = await getInternal(true, request)
  })
  .handler(async (event, context, { signal }) => {
    // context.configs = { appConfig, ssm }
  })
```
