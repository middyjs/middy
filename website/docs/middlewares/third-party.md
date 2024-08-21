---
title: Third-party middlewares
sidebar_position: 100
---

The following middlewares are created and maintained outside this project. We cannot guarantee for its functionality.
If your middleware is missing, feel free to [open a Pull Request](https://github.com/middyjs/middy/pulls).

## Version 2.x - 5.x

- [dazn-lambda-powertools](https://github.com/getndazn/dazn-lambda-powertools): A collection of middlewares, AWS clients and helper libraries that make working with lambda easier.
- [middy-ajv](https://www.npmjs.com/package/middy-ajv): AJV validator optimized for performance
- [middy-console-logger](https://github.com/serkan-ozal/middy-console-logger): Middleware for filtering logs printed over console logging methods. If the level of the console logging method is equal or bigger than configured level, the log is printed, Otherwise, it is ignored.
- [middy-event-loop-tracer](https://github.com/serkan-ozal/middy-event-loop-tracer): Middleware for dumping active tasks with their stacktraces in the event queue just before AWS Lambda function timeouts. So you can understand what was going on in the function when timeout happens.
- [middy-idempotent](https://www.npmjs.com/package/middy-idempotent): idempotency middleware for middy
- [middy-invocation](https://github.com/serkan-ozal/middy-invocation): Middleware for accessing current AWS Lambda invocation event and context from anywhere without need to passing event and context as arguments through your code.- [middy-lesslog](https://www.npmjs.com/package/middy-lesslog): Middleware for `lesslog`, a teeny-tiny and severless-ready logging utility
- [middy-jsonapi](https://www.npmjs.com/package/middy-jsonapi): JSONAPI middleware for middy
- [middy-lesslog](https://www.npmjs.com/package/middy-lesslog): Middleware for `lesslog`, a teeny-tiny and severless-ready logging utility
- [middy-profiler](https://github.com/serkan-ozal/middy-profiler): Middleware for profiling CPU on AWS Lambda during invocation and shows what methods/modules consume what percent of CPU time
- [middy-rds](https://www.npmjs.com/package/middy-rds): Creates RDS connection using `knex` or `pg`
- [middy-recaptcha](https://www.npmjs.com/package/middy-recaptcha): reCAPTCHA validation middleware
- [middy-sparks-joi](https://www.npmjs.com/package/middy-sparks-joi): Joi validator
- [middy-store](https://github.com/zirkelc/middy-store): Middleware to automatically store and load payloads from S3 in an AWS Step Functions state machine
- [@iress/middy-http-path-router](https://www.npmjs.com/package/@iress/middy-http-path-router): Routes AWS API Gateway events to handlers based on static and dynamic paths
- [@nhs/fhir-middy-error-handler](https://www.npmjs.com/package/@nhs/fhir-middy-error-handler): An error handler for use in an AWS Lambda returning FHIR compliant error messages as OperationOutcome resources. Used as part of the [Prescriptions for Patients FHIR API](https://digital.nhs.uk/developer/api-catalogue/prescriptions-for-patients).

## Version 2.x - 3.x

- [aws-lambda-powertools-typescript](https://github.com/awslabs/aws-lambda-powertools-typescript): A suite of utilities for AWS Lambda Functions that makes structured logging, creating custom metrics asynchronously and tracing with AWS X-Ray easier

  - [logger](https://awslabs.github.io/aws-lambda-powertools-typescript/latest/core/logger/#capturing-lambda-context-info): Structured logging made easier, and a middleware to enrich log items with key details of the Lambda context
  - [metrics](https://awslabs.github.io/aws-lambda-powertools-typescript/latest/core/metrics/#middy-middleware): Custom Metrics created asynchronously via CloudWatch Embedded Metric Format (EMF)
  - [parameters](https://awslabs.github.io/aws-lambda-powertools-typescript/latest/utilities/parameters/): The Parameters utility provides high-level functions to retrieve one or multiple parameter values from AWS Systems Manager Parameter Store, AWS Secrets Manager, AWS AppConfig, Amazon DynamoDB, or your own parameter store.
  - [tracer](https://awslabs.github.io/aws-lambda-powertools-typescript/latest/core/tracer/#lambda-handler): Utilities to trace Lambda function handlers, and both synchronous and asynchronous functions

## Version 1.x

- [middy-redis](https://www.npmjs.com/package/middy-redis): Redis connection middleware
- [middy-extractor](https://www.npmjs.com/package/middy-extractor): Extracts data from events using expressions
- [@keboola/middy-error-logger](https://www.npmjs.com/package/@keboola/middy-error-logger): middleware that catches thrown exceptions and rejected promises and logs them comprehensibly to the console
- [@keboola/middy-event-validator](https://www.npmjs.com/package/@keboola/middy-event-validator): Joi powered event validation middleware
- [middy-reroute](https://www.npmjs.com/package/middy-reroute): provides complex redirect, rewrite and proxying capabilities by simply placing a rules file into your S3 bucket
- [middytohof](https://www.npmjs.com/package/middytohof): Convert Middy middleware plugins to higher-order functions returning lambda handlers
- [wrap-ware](https://www.npmjs.com/package/wrap-ware): A middleware wrapper which works with promises / async
- [middy-middleware-warmup](https://www.npmjs.com/package/middy-middleware-warmup): A middy plugin to help keep your Lambdas warm during Winter
- [@sharecover-co/middy-aws-xray-tracing](https://www.npmjs.com/package/@sharecover-co/middy-aws-xray-tracing): AWS X-Ray Tracing Middleware
- [@sharecover-co/middy-http-response-serializer](https://www.npmjs.com/package/@sharecover-co/middy-http-response-serializer): This middleware serializes the response to JSON and wraps it in a 200 HTTP response
- [@seedrs/middyjs-middleware](https://www.npmjs.com/package/@seedrs/middyjs-middleware): Collection of useful middlewares
- [middy-autoproxyresponse](https://www.npmjs.com/package/middy-autoproxyresponse): A middleware that lets you return simple JavaScript objects from Lambda function handlers and converts them into LAMBDA_PROXY responses
- [jwt-auth](https://www.npmjs.com/package/middy-middleware-jwt-auth): JSON web token authorization middleware based on `express-jwt`
- [middy-mongoose-connector](https://www.npmjs.com/package/middy-mongoose-connector): MongoDB connection middleware for [mongoose.js](https://mongoosejs.com/)
- [@ematipico/middy-request-response](https://www.npmjs.com/package/@ematipico/middy-request-response): a middleware that creates a pair of request/response objects
- [@marcosantonocito/middy-cognito-permission](https://www.npmjs.com/package/@marcosantonocito/middy-cognito-permission): Authorization and roles permission management for the Middy framework that works with Amazon Cognito
- [middy-env](https://www.npmjs.com/package/middy-env): Fetch, validate and type cast environment variables
- [sqs-json-body-parser](https://github.com/Eomm/sqs-json-body-parser): Parse the SQS body to JSON
- [middy-lesslog](https://www.npmjs.com/package/middy-lesslog/v/legacy): Middleware for `lesslog`, a teeny-tiny and severless-ready logging utility
