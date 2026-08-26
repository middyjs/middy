---
title: Upgrade 7.x -> 8.x
description: "Migrate from Middy 7.x to 8.x."
---

aka "Lambda goes _____"

Version 8.x of Middy no longer supports Node.js versions 22.x. You are highly encouraged to move to Node.js 26.x.

## Notable changes

- Deprecation of `callbackWaitsForEmptyEventLoop`
- `executionModeDurablecontext` now skips onError middlewares

## Core

- `executionModeDurablecontext` now skips `onError` middlewares **Breaking Change**
- Deprecation of `originalError` on internal error object **Breaking Change**
- Deprecation of `callbackWaitsForEmptyEventLoop`

## Util

## Middleware

### [appconfig](/docs/middlewares/appconfig)

No change

### [appconfig-extension](/docs/middlewares/appconfig-extension)

No change

### [cloudformation-response](/docs/middlewares/cloudformation-response)

No change

### [cloudformation-router](/docs/middlewares/cloudformation-router)

No change

### [cloudwatch-metrics](/docs/middlewares/cloudwatch-metrics)

No change

### [do-not-wait-for-empty-event-loop](/docs/middlewares/do-not-wait-for-empty-event-loop)

- Deprecated, callbacks are no longer supported in Lambda **Breaking Change**

### [dsql](/docs/middlewares/dsql)

No change

### [dsql-signer](/docs/middlewares/dsql-signer)

No change

### [dynamodb](/docs/middlewares/dynamodb)

No change

### [ecs-batch](/docs/middlewares/ecs-batch)

No change

### [ecs-http](/docs/middlewares/ecs-http)

No change

### [ecs-task](/docs/middlewares/ecs-task)

No change

### [error-logger](/docs/middlewares/error-logger)

No change

### [event-batch-handler](/docs/middlewares/event-batch-handler)

No change

### [event-batch-parser](/docs/middlewares/event-batch-parser)

No change

### [event-batch-response](/docs/middlewares/event-batch-response)

No change

### [event-normalizer](/docs/middlewares/event-normalizer)

No change

### [glue-schema-registry](/docs/middlewares/glue-schema-registry)

No change

### [http-content-encoding](/docs/middlewares/http-content-encoding)

No change

### [http-content-negotiation](/docs/middlewares/http-content-negotiation)

No change

### [http-cors](/docs/middlewares/http-cors)

No change

### [http-dpop](/docs/middlewares/http-dpop)

No change

### [http-error-handler](/docs/middlewares/http-error-handler)

- logger not takes `request` object instead of `error` **Breaking Change**

### [http-event-normalizer](/docs/middlewares/http-event-normalizer)

No change

### [http-header-normalizer](/docs/middlewares/http-header-normalizer)

No change

### [http-json-body-parser](/docs/middlewares/http-json-body-parser)

No change

### [http-jwt](/docs/middlewares/http-jwt)

No change

### [http-multipart-body-parser](/docs/middlewares/http-multipart-body-parser)

No change

### [http-partial-response](/docs/middlewares/http-partial-response)

No change

### [http-paseto](/docs/middlewares/http-paseto)

No change

### [http-response-serializer](/docs/middlewares/http-response-serializer)

No change

### [http-router](/docs/routers/http-router)

No change

### [http-security-headers](/docs/middlewares/http-security-headers)

No change

### [http-urlencode-body-parser](/docs/middlewares/http-urlencode-body-parser)

No change

### [http-urlencode-path-parser](/docs/middlewares/http-urlencode-path-parser)

No change

### [http-x402](/docs/middlewares/http-x402)

No change

### [input-output-logger](/docs/middlewares/input-output-logger)

No change

### [kms](/docs/middlewares/kms)

No change

### [rds](/docs/middlewares/rds)

No change

### [rds-signer](/docs/middlewares/rds-signer)

No change

### [s3](/docs/middlewares/s3)

No change

### [s3-object-response](/docs/middlewares/s3-object-response)

No change

### [secrets-manager](/docs/middlewares/secrets-manager)

No change

### [secrets-manager-extension](/docs/middlewares/secrets-manager-extension)

No change

### [service-discovery](/docs/middlewares/service-discovery)

No change

### [sqs-partial-batch-failure](/docs/middlewares/sqs-partial-batch-failure)

No change

### [ssm](/docs/middlewares/ssm)

No change

### [ssm-extension](/docs/middlewares/ssm-extension)

No change

### [sts](/docs/middlewares/sts)

- `RoleSessionName` is now `@middy-sts-{randomUUID}` to prevent collisions **Breaking Change**

### [validator](/docs/middlewares/validator)

No change

### [warmup](/docs/middlewares/warmup)

No change

### [ws-json-body-parser](/docs/middlewares/ws-json-body-parser)

No change

### [ws-response](/docs/middlewares/ws-response)

No change

### [ws-router](/docs/routers/ws-router)

No change

## Notes

None
