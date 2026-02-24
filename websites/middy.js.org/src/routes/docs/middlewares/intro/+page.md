---
title: Official middlewares
---

Middy comes with a series of additional (opt-in) plugins that are officially maintained by the core team and kept in sync with every release of the core package.

These middleware focus on common use cases when using Lambda with other AWS services.

Each middleware should do a single task. We try to balance each to be as performant as possible while meeting the majority of developer needs.

## Misc

- [`cloudwatch-metrics`](/docs/middlewares/cloudwatch-metrics): Hydrates lambda's `context.metrics` property with an instance of AWS MetricLogger
- [`do-not-wait-for-empty-event-loop`](/docs/middlewares/do-not-wait-for-empty-event-loop): Sets callbackWaitsForEmptyEventLoop property to false
- [`error-logger`](/docs/middlewares/error-logger): Logs errors
- [`input-output-logger`](/docs/middlewares/input-output-logger): Logs request and response
- [`warmup`](/docs/middlewares/warmup): Used to pre-warm a lambda function

## Request Transformation

- [`event-normalizer`](/docs/middlewares/event-normalizer): Middleware for iterating through an AWS event records, parsing and normalizing nested events.
- [`http-content-negotiation`](/docs/middlewares/http-content-negotiation): Parses `Accept-*` headers and provides utilities for content negotiation (charset, encoding, language and media type) for HTTP requests
- [`http-event-normalizer`](/docs/middlewares/http-event-normalizer): Normalizes HTTP events by adding an empty object for `queryStringParameters`, `multiValueQueryStringParameters` or `pathParameters` if they are missing.
- [`http-header-normalizer`](/docs/middlewares/http-header-normalizer): Normalizes HTTP header names to their canonical format
- [`http-json-body-parser`](/docs/middlewares/http-json-body-parser): Automatically parses HTTP requests with JSON body and converts the body into an object. Also handles gracefully broken JSON if used in combination of
  `httpErrorHandler`.
- [`http-multipart-body-parser`](/docs/middlewares/http-multipart-body-parser): Automatically parses HTTP requests with content type `multipart/form-data` and converts the body into an object.
- [`http-urlencode-body-parser`](/docs/middlewares/http-urlencode-body-parser): Automatically parses HTTP requests with URL encoded body (typically the result of a form submit).
- [`http-urlencode-path-parser`](/docs/middlewares/http-urlencode-path-parser): Automatically parses HTTP requests with URL encoded path.
- [`validator`](/docs/middlewares/validator): Automatically validates incoming events and outgoing responses against custom schemas.
- [`ws-json-body-parser`](/docs/middlewares/ws-json-body-parser): Automatically parses WebSocket requests with JSON message and converts the message into an object.

## Response Transformation

- [`http-content-encoding`](/docs/middlewares/http-content-encoding): Sets HTTP Content-Encoding header on response and compresses response body
- [`http-cors`](/docs/middlewares/http-cors): Sets HTTP CORS headers on response
- [`http-error-handler`](/docs/middlewares/http-error-handler): Creates a proper HTTP response for errors that are created with the [http-errors](https://www.npmjs.com/package/http-errors) module and represents proper HTTP errors.
- [`http-security-headers`](/docs/middlewares/http-security-headers): Applies best practice security headers to responses. It's a simplified port of HelmetJS.
- [`http-partial-response`](/docs/middlewares/http-partial-response): Filter response objects attributes based on query string parameters.
- [`http-response-serializer`](/docs/middlewares/http-response-serializer): HTTP response serializer.
- [`sqs-partial-batch-failure`](/docs/middlewares/sqs-partial-batch-failure): Handles partially failed SQS batches.
- [`ws-response`](/docs/middlewares/ws-response): Forwards response to WebSocket endpoint.

## Fetch Data

- [`appconfig`](/docs/middlewares/appconfig): Fetch JSON configurations from AppConfig.
- [`dynamodb`](/docs/middlewares/dynamodb): Fetch configurations from DynamoDB.
- [`rds-signer`](/docs/middlewares/rds-signer): Fetches token for connecting to RDS with IAM users.
- [`s3`](/docs/middlewares/s3): Fetch JSON configurations from S3.
- [`s3-object-response`](/docs/middlewares/s3-object-response): Gets and write S3 object response.
- [`secrets-manager`](/docs/middlewares/secrets-manager): Fetches parameters from [AWS Secrets Manager](https://docs.aws.amazon.com/secretsmanager/latest/userguide/intro.html).
- [`service-discovery`](/docs/middlewares/service-discovery): Fetches Service Discovery instances to be used when connecting to other AWS services.
- [`ssm`](/docs/middlewares/ssm): Fetches parameters from [AWS Systems Manager Parameter Store](https://docs.aws.amazon.com/systems-manager/latest/userguide/systems-manager-paramstore.html).
- [`sts`](/docs/middlewares/sts): Fetches credentials to assumes IAM roles for connection to other AWS services.
