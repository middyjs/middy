---
title: Official middlewares
sidebar_position: 0
---

Middy comes with a series of additional (opt-in) plugins that are officially maintained by the core team and kept in sync with every release of the core package.

These middleware focus on common use cases when using Lambda with other AWS services.

Each middleware should do a single task. We try to balance each to be as performant as possible while meeting the majority of developer needs.


## Misc

- [`error-logger`](https://middy.js.org/docs/middlewares/error-logger): Logs errors
- [`input-output-logger`](https://middy.js.org/docs/middlewares/input-output-logger): Logs request and response
- [`do-not-wait-for-empty-event-loop`](https://middy.js.org/docs/middlewares/do-not-wait-for-empty-event-loop): Sets callbackWaitsForEmptyEventLoop property to false
- [`cloudwatch-metrics`](https://middy.js.org/docs/middlewares/cloudwatch-metrics): Hydrates lambda's `context.metrics` property with an instance of AWS MetricLogger
- [`warmup`](https://middy.js.org/docs/middlewares/warmup): Used to pre-warm a lambda function


## Request Transformation

- [`http-content-negotiation`](https://middy.js.org/docs/middlewares/http-content-negotiation): Parses `Accept-*` headers and provides utilities for content negotiation (charset, encoding, language and media type) for HTTP requests
- [`http-header-normalizer`](https://middy.js.org/docs/middlewares/http-header-normalizer): Normalizes HTTP header names to their canonical format
- [`http-json-body-parser`](https://middy.js.org/docs/middlewares/http-json-body-parser): Automatically parses HTTP requests with JSON body and converts the body into an object. Also handles gracefully broken JSON if used in combination of
  `httpErrorHandler`.
- [`http-multipart-body-parser`](https://middy.js.org/docs/middlewares/http-multipart-body-parser): Automatically parses HTTP requests with content type `multipart/form-data` and converts the body into an object.
- [`http-urlencode-body-parser`](https://middy.js.org/docs/middlewares/http-urlencode-body-parser): Automatically parses HTTP requests with URL encoded body (typically the result of a form submit).
- [`http-urlencode-path-parser`](https://middy.js.org/docs/middlewares/http-urlencode-path-parser): Automatically parses HTTP requests with URL encoded path.
- [`s3-key-normalizer`](https://middy.js.org/docs/middlewares/s3-key-normalizer): Normalizes key names in s3 events.
- [`sqs-json-body-parser`](https://middy.js.org/docs/middlewares/sqs-json-body-parser): Parse body from SQS events
- [`validator`](https://middy.js.org/docs/middlewares/validator): Automatically validates incoming events and outgoing responses against custom schemas


## Response Transformation

- [`http-cors`](https://middy.js.org/docs/middlewares/http-cors): Sets HTTP CORS headers on response
- [`http-error-handler`](https://middy.js.org/docs/middlewares/http-error-handler): Creates a proper HTTP response for errors that are created with the [http-errors](https://www.npmjs.com/package/http-errors) module and represents proper HTTP errors.
- [`http-event-normalizer`](https://middy.js.org/docs/middlewares/http-event-normalizer): Normalizes HTTP events by adding an empty object for `queryStringParameters`, `multiValueQueryStringParameters` or `pathParameters` if they are missing.
- [`http-security-headers`](https://middy.js.org/docs/middlewares/http-security-headers): Applies best practice security headers to responses. It's a simplified port of HelmetJS.
- [`http-partial-response`](https://middy.js.org/docs/middlewares/http-partial-response): Filter response objects attributes based on query string parameters.
- [`http-response-serializer`](https://middy.js.org/docs/middlewares/http-response-serializer): HTTP response serializer.
- [`sqs-partial-batch-failure`](https://middy.js.org/docs/middlewares/sqs-partial-batch-failure): handles partially failed SQS batches.


## Fetch Data

- [`rds-signer`](https://middy.js.org/docs/middlewares/rds-signer): Fetches token for connecting to RDS with IAM users.
- [`s3-object-response`](https://middy.js.org/docs/middlewares/s3-object-response): Gets and write S3 object response.
- [`secrets-manager`](https://middy.js.org/docs/middlewares/secrets-manager): Fetches parameters from [AWS Secrets Manager](https://docs.aws.amazon.com/secretsmanager/latest/userguide/intro.html).
- [`ssm`](https://middy.js.org/docs/middlewares/ssm): Fetches parameters from [AWS Systems Manager Parameter Store](https://docs.aws.amazon.com/systems-manager/latest/userguide/systems-manager-paramstore.html).
- [`sts`](https://middy.js.org/docs/middlewares/sts): Fetches credentials to assumes IAM roles for connection to other AWS services.
