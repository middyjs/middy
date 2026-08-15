# AWS Event Source E2E Capture Harness

Status: draft for review
Location: `tests/events/`
Region: `us-east-1` (required by Lambda@Edge, CloudFront, and SES receiving; everything else is region-agnostic)

## Goal

Deploy real AWS infrastructure that invokes a capture Lambda through every documented AWS -> Lambda invocation path, trigger each service for real, and record the exact event JSON each service delivers. The captured fixtures become the ground truth for:

1. Verifying middy middlewares against real events instead of hand-copied samples ("true coverage").
2. Phase 2: authoring a JSON Schema per event kind (validated against fixtures; cross-checked against the EventBridge schema registry, `sam local generate-event`, and `@types/aws-lambda`, but the fixture wins on conflict).

Non-goals: load testing, latency testing, response-path validation beyond what each service requires to accept the invocation, IAM least-privilege hardening (this is an ephemeral test account stack).

## Middy support tags

Every event kind is tagged, derived from the middy docs (`websites/middy.js.org/src/routes/docs/events/`):

- `supported`: one or more middy packages parse/normalize/route this exact shape.
- `na`: middy docs cover the event but no transformation applies (arbitrary or pass-through payload); `@middy/core` alone is the story.
- `not-supported`: AWS documents a structured event, middy has no handling and no docs page yet. These rows are the coverage gap report.

## Architecture

```
tests/events/
  SPEC.md            this document
  README.md          runbook (deploy -> trigger -> collect -> destroy)
  template.yaml      single raw CloudFormation template, no transform, no build step
  manifest.json      contract: every kind {id, tier, middy, trigger, docs[]}
  package.json       local deps for scripts (@aws-sdk/*) + broker-writer build deps
  deploy.sh          aws cloudformation deploy wrapper (tier parameters)
  destroy.sh         teardown incl. bucket empty + Lambda@Edge caveat
  trigger.mjs        per-kind real AWS actions that make each service emit its event
  collect.mjs        pulls captures from CloudWatch Logs, sanitizes, writes fixtures/, prints coverage matrix
  selfcheck.mjs      offline gate: static template checks (refs, conditions, cycles, limits), manifest/trigger cross-checks, and sandboxed execution of every inline handler against its service response contract
  assets/source.zip  minimal CodePipeline source artifact
  fixtures/<kind>.json  committed sanitized captures (phase 2 input)
  triggers/broker-writer/ the one packaged Lambda (mongodb + kafkajs) that writes into DocumentDB and produces to MSK from inside the VPC
```

### Capture Lambda

One `AWS::Lambda::Function` per event kind (unambiguous kind -> event mapping, no interleaving). Shared inline handler (CloudFormation `ZipFile`, CommonJS, `nodejs22.x`; the AWS SDK for JavaScript v3 is preinstalled in the managed runtime, see [Lambda runtimes](https://docs.aws.amazon.com/lambda/latest/dg/lambda-runtimes.html)):

```js
console.log("MIDDY_CAPTURE " + process.env.KIND + " " + JSON.stringify(event))
```

then a per-kind response tail, because many sources reject the invocation without a contract-correct response:

| response mode | kinds | contract |
| --- | --- | --- |
| `none` | async/poll sources (S3, SNS, SQS, streams, EventBridge, logs, ...) | return `{}` |
| `http` | API GW v1/v2, Function URL, ALB, Lattice | `{statusCode, headers, body, isBase64Encoded}` |
| `authorizer-iam` | REST/WS authorizers | IAM policy document + `context` |
| `authorizer-simple` | HTTP API authorizer (2.0 simple) | `{isAuthorized: true, context}` |
| `passthrough` | Cognito triggers | return the (possibly amended) `event` |
| `cfn` | CloudFormation custom resource | HTTPS PUT to `event.ResponseURL` (via global `fetch`) |
| `firehose` | Firehose transform | `{records: [{recordId, result: "Ok", data}]}` |
| `s3batch` | S3 Batch | `{invocationSchemaVersion, treatMissingKeysAs, invocationId, results[]}` |
| `s3object` | S3 Object Lambda | `WriteGetObjectResponse` via `@aws-sdk/client-s3` |
| `cloudfront` | Lambda@Edge | return `event.Records[0].cf.request` / `.response` |
| `lex` | Lex V2 hooks | `{sessionState: {dialogAction: {type: "Close"}, intent: {..., state: "Fulfilled"}}}` |
| `bedrock` | Bedrock agent action group | `{messageVersion: "1.0", response: {...}}` |
| `ses` | SES receipt rule | `{disposition: "CONTINUE"}` |
| `iot-authorizer` | IoT custom authorizer | `{isAuthenticated, principalId, policyDocuments[]}` |
| `macro` | CloudFormation macro | `{requestId, status: "success", fragment}` |
| `transfer` | Transfer Family custom IdP | `{Role, HomeDirectory}` |

Each function gets an explicit `AWS::Logs::LogGroup` (`RetentionInDays: 1`, deleted with the stack) so ephemeral runs leave nothing behind and `collect.mjs` has deterministic group names.

Capture transport is CloudWatch Logs by decision (no S3 SDK in the hot path, zero extra infra). Known ceiling: CloudWatch truncates log events at 256 KB, so `trigger.mjs` keeps payloads small; if a kind ever needs >256 KB bodies, switch that kind to an S3 `PutObject` capture.

### Trigger mechanism

`trigger.mjs <kind|all>` runs locally with your AWS credentials and performs the real service action per kind (`PutObject`, `SendMessage`, `Publish`, `PutItem`, `PutRecord`, `PutEvents`, HTTPS/WebSocket calls to deployed endpoints, Cognito auth flows, `SetAlarmState`, `RotateSecret`, `StartExecution`, `CreateJob`, ...). Services that are only reachable from inside the VPC (Lattice, ActiveMQ/RabbitMQ management APIs, DocumentDB) are triggered through a small in-VPC proxy Lambda that `trigger.mjs` invokes with instructions. After firing, the script polls the capture log groups until every expected kind reports or a timeout hits.

Trigger latency notes: Firehose transform waits for the buffering interval (60 s minimum). DynamoDB/Kinesis tumbling-window kinds emit after the window closes (30-60 s configured). Config evaluations can take minutes. CloudTrail-via-EventBridge can take up to 15 minutes. The poll loop accounts for per-kind timeouts from `manifest.json`.

### Collection, sanitization, coverage

`collect.mjs`:

1. `FilterLogEvents` on each capture log group for `MIDDY_CAPTURE `.
2. Parse `<kind> <json>`, keep the newest capture per kind.
3. Sanitize: account id -> `123456789012`, ARNs/domain names/IPs/request ids/UUIDs/temporal fields -> stable placeholders, base64 bodies preserved verbatim (they are part of the shape). Sanitization is structural only; keys are never added or removed.
4. Write `fixtures/<kind>.json`.
5. Print the coverage matrix: every `manifest.json` kind x {captured, missing, skipped (tier disabled), documented-only}. "True coverage" = zero unexplained `missing`.

### Tiers (CloudFormation Parameters + Conditions, single template)

| tier | condition | contents | cost profile |
| --- | --- | --- | --- |
| 0 core | always on | everything pay-per-use and fast to create | ~free idle; cents per run (Kinesis shard + Lex + API calls are the only hourly/metered items, pennies for an ephemeral run) |
| 1 vpc | `EnableVpc` | VPC (2 public subnets, IGW, no NAT), ALB x2 target groups, VPC Lattice, in-VPC trigger proxy | ALB billed hourly while deployed |
| 2 brokers | `EnableBrokers` | MSK provisioned (3.9.x, smallest brokers, SASL/SCRAM + IAM), Amazon MQ ActiveMQ + RabbitMQ (micro), DocumentDB (1 x t3.medium), plus 3 PrivateLink endpoints (lambda, sts, secretsmanager) that on-demand Kafka/MQ/DocumentDB pollers require in a NAT-less VPC | all billed hourly (brokers + endpoints); MSK takes 20-35 min to create |
| 3 edge | `EnableEdge` | CloudFront distribution (origin = the tier-0 Function URL) + 4 Lambda@Edge functions | pay-per-use, but stack delete stalls until edge replicas purge (retry delete after a few hours) |
| 4 domain | `SesRuleSetDomain` + `HostedZoneId` params | SES receiving (verified domain identity, MX record, receipt rule) | pay-per-use; requires a Route 53 hosted zone you own |
| transfer | `EnableTransfer` | Transfer Family SFTP server with Lambda custom identity provider | server billed hourly while deployed |
| gated singletons | `EnableConfig`, `EnableCloudTrail`, `EnableCodeCommit`, `EnableBedrock` | see per-service notes: account-level singletons, closed services, or model-access prerequisites | Config recorder + trail are metered per item recorded |

Lifecycle: ephemeral. `deploy.sh` -> `trigger.mjs all` -> `collect.mjs` -> `destroy.sh`, run manually by a maintainer. Nothing in this folder deploys from CI.

---

## Event source matrix

Format per kind: manifest id, then infra / trigger / structure-changing permutations / AWS docs. Tags per the rules above. Only permutations that change the delivered event structure are listed; settings that change batching, filtering, retry, or the response contract (e.g. `ReportBatchItemFailures`) are noted but not separate kinds.

Master reference: [Invoking Lambda with events from other AWS services](https://docs.aws.amazon.com/lambda/latest/dg/lambda-services.html), [Event source mappings](https://docs.aws.amazon.com/lambda/latest/dg/invocation-eventsourcemapping.html), [Async invocation](https://docs.aws.amazon.com/lambda/latest/dg/invocation-async.html).

### SQS - `supported` (`@middy/event-normalizer`, `@middy/sqs-partial-batch-failure`, `@middy/event-batch-*`) - tier 0

- `sqs.standard`: standard queue + ESM. Trigger: `SendMessage` with JSON body + message attributes (attributes add `messageAttributes` entries and `md5OfMessageAttributes`).
- `sqs.fifo`: FIFO queue + ESM. Adds `attributes.MessageGroupId`, `attributes.MessageDeduplicationId`, `attributes.SequenceNumber`.
- `sqs.sns`: SNS topic -> SQS subscription (default envelope). Body is the JSON SNS `Notification` envelope; event-normalizer's `aws:sns:sqs` path.
- `sqs.sns-raw`: same subscription with `RawMessageDelivery: true`; body is the bare message (structure change: no envelope).
- `sqs.s3`: S3 notification -> SQS -> ESM. Body is the S3 records envelope; the `S3 -> SQS -> Lambda` walk.
- Notes, not kinds: partial batch response changes only the function response; DLQ redrive re-delivers the same shape; Lambda-async-DLQ messages arrive on a plain queue with `RequestID`/`ErrorCode` message attributes (captured under `lambda.dlq` below).
- Docs: [with-sqs](https://docs.aws.amazon.com/lambda/latest/dg/with-sqs.html), [SQS message attributes](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-message-metadata.html), [SNS raw message delivery](https://docs.aws.amazon.com/sns/latest/dg/sns-large-payload-raw-message-delivery.html)

### SNS - `supported` (`@middy/event-normalizer`) - tier 0

- `sns.standard`: topic -> Lambda subscription. Trigger: `Publish` with message attributes (adds `Sns.MessageAttributes`).
- Note: SNS FIFO topics cannot target Lambda (only SQS); documented so nobody chases that fixture. Subscription filter policies do not change the delivered shape.
- Docs: [with-sns](https://docs.aws.amazon.com/lambda/latest/dg/with-sns.html), [SNS FIFO delivery protocols](https://docs.aws.amazon.com/sns/latest/dg/fifo-topic-code-examples.html)

### S3 notifications - `supported` (`@middy/event-normalizer`, `@middy/s3`) - tier 0

- `s3.put`: direct notification, `s3:ObjectCreated:*`. Trigger: `PutObject` with a key containing spaces + unicode (proves the URL-encoded `s3.object.key` contract middy decodes).
- `s3.delete`: `s3:ObjectRemoved:Delete`.
- `s3.delete-marker`: versioned bucket, delete without version id -> `ObjectRemoved:DeleteMarkerCreated`; records gain `s3.object.versionId`.
- `s3.sns`: notification -> SNS -> Lambda (S3 records nested in SNS envelope).
- `s3.sns-sqs`: notification -> SNS -> SQS -> Lambda: the full three-level walk event-normalizer documents (S3 records inside an SNS `Notification` envelope inside an SQS body); fired by the same `sns/`-prefix upload.
- `s3.sqs`: notification -> SQS -> Lambda (same as `sqs.s3`, captured once, listed under both for the matrix).
- `s3.eventbridge`: bucket with `EventBridgeConfiguration` -> EventBridge rule -> Lambda. Entirely different envelope (EventBridge `detail` schema, not `Records[]`).
- Deferred permutations (documented, not automated): `ObjectRestore:*` (requires Glacier restore wait), Replication, Lifecycle, Intelligent-Tiering events.
- Docs: [with-s3](https://docs.aws.amazon.com/lambda/latest/dg/with-s3.html), [Notification event structure](https://docs.aws.amazon.com/AmazonS3/latest/userguide/notification-content-structure.html), [S3 EventBridge notifications](https://docs.aws.amazon.com/AmazonS3/latest/userguide/EventBridge.html)

### S3 Batch Operations - `supported` (`@middy/event-normalizer`, `@middy/event-batch-*`) - tier 0

- `s3batch.v1`: `LambdaInvoke` batch job. Trigger: upload CSV manifest, `s3control CreateJob` with `--no-confirmation-required`. Event: `invocationSchemaVersion`, `job.id`, `tasks[].{taskId, s3Key, s3VersionId, s3BucketArn}`.
- Permutation note: `invocationSchemaVersion: "2.0"` (user arguments / directive support) changes the task shape; deferred until captured v1 is committed.
- Docs: [services-s3-batch](https://docs.aws.amazon.com/lambda/latest/dg/services-s3-batch.html), [Invoke Lambda from S3 Batch Operations](https://docs.aws.amazon.com/AmazonS3/latest/userguide/batch-ops-invoke-lambda.html)

### S3 Object Lambda - `supported` (`@middy/s3-object-response`) - tier 0

- `s3object.get`: supporting access point + Object Lambda access point. Trigger: `GetObject` against the OLAP ARN. Event: `getObjectContext.{inputS3Url, outputRoute, outputToken}`, `userRequest`, `configuration`. Response via `WriteGetObjectResponse`.
- Permutation note: Head/List transformations produce sibling shapes (`listObjectsV2Context` etc.); deferred.
- Docs: [Writing Lambda functions for S3 Object Lambda](https://docs.aws.amazon.com/AmazonS3/latest/userguide/olap-writing-lambda.html)

### DynamoDB Streams - `supported` (`@middy/event-normalizer` unmarshall, `@middy/event-batch-*`) - tier 0

One on-demand table per view type (view type is immutable per stream), items exercising every attribute type (S, N incl. > MAX_SAFE_INTEGER, B, BOOL, NULL, L, M, SS, NS, BS) to feed the unmarshall paths:

- `ddb.keys-only`, `ddb.new-image`, `ddb.old-image`, `ddb.new-and-old`: `StreamViewType` x4; each captures INSERT + MODIFY + REMOVE (`dynamodb.{Keys, NewImage, OldImage}` presence varies by view type and eventName).
- `ddb.windowed`: ESM with `TumblingWindowInSeconds` on a fifth table; event gains `window`, `state`, `shardId`, `isFinalInvokeForWindow`, `isWindowTerminatedEarly`.
- Docs: [with-ddb](https://docs.aws.amazon.com/lambda/latest/dg/with-ddb.html), [Streams record views](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Streams.html)

### Kinesis Data Streams - `supported` (`@middy/event-normalizer`, `@middy/event-batch-*`) - tier 0

- `kinesis.standard`: 1-shard provisioned stream + ESM. Trigger: `PutRecord` (JSON and non-JSON payloads; data stays base64).
- `kinesis.efo`: `AWS::Kinesis::StreamConsumer` + ESM against the consumer ARN (enhanced fan-out); captured to prove whether `eventSourceARN` reflects the consumer.
- `kinesis.windowed`: second ESM with `TumblingWindowInSeconds`; adds the window/state fields as with DynamoDB.
- Deferred permutation: KPL aggregated records (protobuf aggregation format inside `kinesis.data`); requires emitting the KPL binary format from the trigger script.
- Note, not a kind: DynamoDB's Kinesis Data Streams destination delivers DDB change records inside the standard Kinesis envelope (`kinesis.data` decodes to a DDB stream-style record); the envelope is covered by `kinesis.standard`.
- Docs: [with-kinesis](https://docs.aws.amazon.com/lambda/latest/dg/with-kinesis.html)

### Kinesis Data Firehose transform - `supported` (`@middy/event-normalizer` `aws:lambda:events`, `@middy/event-batch-*`) - tier 0

- `firehose.transform`: delivery stream (S3 destination) with processing configuration. Trigger: `PutRecord`; invocation after buffer interval (60 s min). Event: `invocationId`, `deliveryStreamArn`, `records[].{recordId, approximateArrivalTimestamp, data}`.
- Docs: [Firehose data transformation](https://docs.aws.amazon.com/firehose/latest/dev/data-transformation.html)

### CloudWatch Logs subscription - `supported` (`@middy/event-normalizer` gunzip) - tier 0

- `cwlogs.subscription`: feeder log group + subscription filter -> Lambda. Trigger: `PutLogEvents`. Event: `awslogs.data` (gzip + base64 of `{messageType, owner, logGroup, logStream, subscriptionFilters, logEvents[]}`).
- Docs: [Subscription filters with Lambda](https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/SubscriptionFilters.html#LambdaFunctionExample)

### CloudWatch alarm direct action - `na` (docs page `cloud-watch-alarm`, no middleware) - tier 0

- `cwalarm.direct`: metric alarm on a namespaced custom metric with the capture Lambda as alarm action. Trigger: `SetAlarmState` (no metric wait). Event: `source: "aws.cloudwatch"`, `alarmArn`, `accountId`, `time`, `region`, `alarmData.{alarmName, state, previousState, configuration}`; fixture confirms exact keys.
- Docs: [Invoke a Lambda function from an alarm](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/alarms-and-actions-Lambda.html)

### EventBridge - `supported` (docs page `event-bridge`; `@middy/event-normalizer` noted for nested payloads, `@middy/validator`) - tier 0

- `eventbridge.schedule-rule`: `ScheduleExpression` rule -> Lambda. Classic scheduled event: `source: "aws.events"`, `detail-type: "Scheduled Event"`, `detail: {}`.
- `eventbridge.custom`: pattern rule on a custom bus. Trigger: `PutEvents` with nested JSON detail.
- `eventbridge.ec2-state` (covers the middy `ec2` docs page): default-bus rule on `aws.ec2` `EC2 Instance State-change Notification`. Automated only when something in the account changes instance state; the trigger script starts/stops nothing by default, so this kind reports `manual` unless `--ec2-instance-id` is passed.
- `eventbridge.cloudtrail` (covers the middy `cloud-trail` docs page): rule on `detail-type: "AWS API Call via CloudTrail"` (e.g. `s3.amazonaws.com`). Gated by `EnableCloudTrail` (creates a management-events trail). Delivery lag up to ~15 min.
- `eventbridge.scheduler`: EventBridge Scheduler one-time schedule with `Input` containing the context placeholders `<aws.scheduler.schedule-arn>`, `<aws.scheduler.scheduled-time>`, `<aws.scheduler.execution-id>`, `<aws.scheduler.attempt-number>`. Scheduler delivers the `Input` verbatim (no envelope): payload is arbitrary, kind exists to document exactly that.
- `eventbridge.pipe-sqs`: SQS queue -> EventBridge Pipe -> Lambda target; captures the pipe-delivered batch shape vs the native SQS ESM shape. Note: Lambda can also sit in the pipe's enrichment slot; it receives the same batch shape and its response replaces the payload.
- Note, not a kind: rule `InputTransformer` / `Input` overrides replace the payload with arbitrary JSON.
- Docs: [What is EventBridge](https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-what-is.html), [Scheduler templated targets](https://docs.aws.amazon.com/scheduler/latest/UserGuide/managing-targets-templated.html), [Scheduler context attributes](https://docs.aws.amazon.com/scheduler/latest/UserGuide/managing-schedule-context-attributes.html), [EventBridge Pipes](https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-pipes.html), [EC2 state change events](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/monitoring-instance-state-changes.html)

### API Gateway REST (payload v1) - `supported` (http middleware family, `@middy/http-router`) - tier 0

- `apigw.rest.proxy`: `AWS_PROXY` integration, `ANY /echo/{proxy+}`. Trigger: GET with duplicate query params + POST JSON (exercises `multiValueHeaders`, `multiValueQueryStringParameters`, `pathParameters`, `stageVariables`).
- `apigw.rest.binary`: second RestApi with `BinaryMediaTypes: ["*/*"]`; POST binary body -> `isBase64Encoded: true`.
- `apigw.rest.authorized`: route behind a REQUEST authorizer; `requestContext.authorizer` carries the authorizer `context` map (values stringified).
- `apigw.rest.cognito`: route behind a `COGNITO_USER_POOLS` authorizer; `requestContext.authorizer.claims` carries the raw token claims (a different shape from Lambda-authorizer `context`).
- `apigw.rest.iam`: route with `AuthorizationType: AWS_IAM`; `requestContext.identity` fully populated (caller ARNs, access key). Trigger: SigV4-signed GET (`execute-api`).
- `apigw.authorizer.rest-token`: the TOKEN authorizer's own input event (`type: "TOKEN"`, `authorizationToken`, `methodArn`).
- `apigw.authorizer.rest-request`: REQUEST authorizer input (full request materialized: headers, query, `requestContext`).
- Note, not a kind: non-proxy (custom integration) events are mapping-template output, arbitrary by definition.
- Docs: [services-apigateway](https://docs.aws.amazon.com/lambda/latest/dg/services-apigateway.html), [Proxy integration input format](https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html), [Lambda authorizer input](https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-lambda-authorizer-input.html), [Cognito user pool authorizers](https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-integrate-with-cognito.html)

### API Gateway HTTP API (payload v1.0 / v2.0) - `supported` (http middleware family) - tier 0

- `apigw.http.v1`: route with `PayloadFormatVersion: "1.0"` (v1-like shape, HTTP-API flavored).
- `apigw.http.v2`: `PayloadFormatVersion: "2.0"` (`rawPath`, `rawQueryString`, `cookies[]`, comma-joined multi-headers).
- `apigw.http.v2-jwt`: route behind a JWT authorizer (issuer = the tier-0 Cognito user pool); `requestContext.authorizer.jwt.{claims, scopes}`.
- `apigw.http.v2-authorized`: route behind a Lambda authorizer with simple responses; `requestContext.authorizer.lambda` carries the context object (not stringified: v2 difference).
- `apigw.authorizer.http-simple`: the HTTP API authorizer's own input (`version: "2.0"`, `type: "REQUEST"`, `routeArn`, `identitySource[]`).
- `apigw.http.v2-iam`: route with `AuthorizationType: AWS_IAM`; `requestContext.authorizer.iam` block (userArn, accountId, principalOrgId). Trigger: SigV4-signed GET.
- Docs: [HTTP API Lambda integrations, payload 1.0 vs 2.0](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-develop-integrations-lambda.html), [HTTP API Lambda authorizers](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-lambda-authorizer.html), [HTTP API IAM authorization](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-access-control-iam.html)

### API Gateway WebSocket - `supported` (`@middy/ws-router`, `@middy/ws-json-body-parser`, `@middy/ws-response`) - tier 0

- `apigw.ws.connect`, `apigw.ws.message` (custom route + `$default`), `apigw.ws.disconnect`: WebSocket API, route selection `$request.body.action`. Trigger: Node `WebSocket` client connects, sends, closes. Events: `requestContext.{routeKey, connectionId, eventType, messageId}`; `body` only on messages.
- `apigw.authorizer.ws`: REQUEST authorizer on `$connect` (its own input event).
- Docs: [About WebSocket APIs](https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-websocket-api-overview.html)

### Lambda Function URLs - `supported` (http middleware family; docs page `function-url`) - tier 0

- `functionurl.none`: `AuthType: NONE`, GET + POST. Always payload v2.0 shape with Function-URL `requestContext`.
- `functionurl.iam`: `AuthType: AWS_IAM`, SigV4 GET; `requestContext.authorizer.iam` populated.
- Note: response streaming changes the response API, not the event.
- Docs: [Function URL invocation](https://docs.aws.amazon.com/lambda/latest/dg/urls-invocation.html)

### Application Load Balancer - `supported` (http middleware family) - tier 1 (vpc)

- `alb.single`: default target group; single-value `headers`/`queryStringParameters`.
- `alb.multi`: target group with `lambda.multi_value_headers.enabled: true`; keys switch to `multiValueHeaders`/`multiValueQueryStringParameters` (mutually exclusive shapes).
- Note: OIDC-authenticated listeners add `x-amzn-oidc-*` headers; requires an IdP, documented only. If target-group health checks are enabled, the function also receives synthetic requests with an `elb-health-checker` user-agent.
- Docs: [services-alb](https://docs.aws.amazon.com/lambda/latest/dg/services-alb.html), [Lambda as ALB target](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/lambda-functions.html)

### VPC Lattice - `supported` (http middleware family; docs page `vpc-lattice`) - tier 1 (vpc)

- `lattice.v1`: target group with event structure `V1` (snake_case: `raw_path`, `is_base64_encoded`, last-value-wins query params).
- `lattice.v2`: `V2` (`version: "2.0"`, list-valued headers/query params, `requestContext.identity`).
- Trigger: in-VPC proxy Lambda fetches the Lattice service DNS (Lattice is only reachable from associated VPCs).
- Docs: [Lambda functions as Lattice targets, V1/V2 event structures](https://docs.aws.amazon.com/vpc-lattice/latest/ug/lambda-functions.html)

### CloudFront Lambda@Edge - `na` (docs page `cloud-front`, no middleware) - tier 3 (edge)

- `cloudfront.viewer-request`, `cloudfront.origin-request`, `cloudfront.origin-response`, `cloudfront.viewer-response`: one distribution (origin = tier-0 Function URL), four versioned us-east-1 functions. Trigger: HTTPS GET on the distribution domain.
- `cloudfront.viewer-request-body`: viewer-request with `IncludeBody: true`; adds `Records[0].cf.request.body.{data, encoding, inputTruncated}`.
- Edge functions log in the region nearest the viewer: `collect.mjs` scans `us-east-1` plus the caller's region for edge log groups.
- Teardown caveat: replicated functions cannot be deleted until CloudFront purges replicas (hours); `destroy.sh` documents the retry.
- Docs: [Lambda@Edge event structure](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/lambda-event-structure.html) (includes the `body` object delivered when the include-body option is enabled)

### Cognito user pool triggers - `na` (docs page `cognito`, no middleware) - tier 0

User pool + client (`USER_PASSWORD_AUTH` + `CUSTOM_AUTH` flows), all triggers pointed at per-kind capture functions with `passthrough` response mode (each trigger returns the event unchanged so flows proceed):

- `cognito.pre-signup` (trigger: `SignUp`; capture also sets `autoConfirmUser` so the flow continues)
- `cognito.post-confirmation` (confirmed via the pre-signup auto-confirm)
- `cognito.pre-auth`, `cognito.post-auth` (trigger: `InitiateAuth` USER_PASSWORD_AUTH)
- `cognito.pre-token` (`PreTokenGeneration`, default V1_0 shape). Permutation: `V2_0`/`V3_0` trigger versions need advanced security / feature plans; gated off by default, shapes documented.
- `cognito.custom-message` (fires on sign-up verification message; the pool uses `COGNITO_DEFAULT` email so no SES setup)
- `cognito.define-auth`, `cognito.create-auth`, `cognito.verify-auth` (trigger: `InitiateAuth` CUSTOM_AUTH; challenge answered by the trigger script)
- `cognito.user-migration` (trigger: `InitiateAuth` with an unknown username; capture returns a synthetic user)
- Documented only: `CustomEmailSender`/`CustomSMSSender` (KMS key + real message delivery), `PostAuthentication` vs `PostConfirmation` for federated users.
- Docs: [User pool Lambda triggers](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools-working-with-lambda-triggers.html), [Pre token generation trigger versions](https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-lambda-pre-token-generation.html)

### AppSync direct Lambda resolver - `na` (docs page `appsync`, no middleware) - tier 0

- `appsync.resolver`: GraphQL API (API key auth), one query field with a direct Lambda resolver (no VTL). Trigger: HTTPS POST GraphQL query. Event: the AppSync Context object (`arguments`, `identity`, `source`, `request`, `info`, `stash`).
- Permutation note: `maxBatchSize > 0` delivers an array of Context objects (batch invoke); captured as a second invocation of the same kind when enabled.
- Docs: [Direct Lambda resolver reference](https://docs.aws.amazon.com/appsync/latest/devguide/direct-lambda-reference.html)

### Lex V2 code hooks - `na` (docs page `lex`, no middleware) - tier 0

- `lex.dialog`, `lex.fulfillment`: minimal bot (one intent, one utterance), dialog + fulfillment code hooks on the same capture function, bot built by CFN. Trigger: `RecognizeText`. Event: `messageVersion: "1.0"`, `invocationSource: "DialogCodeHook" | "FulfillmentCodeHook"`, `sessionState`, `interpretations`.
- Docs: [Lex V2 Lambda integration](https://docs.aws.amazon.com/lexv2/latest/dg/lambda.html)

### Bedrock agent action groups - `not-supported` (no docs page) - tier 0, gated `EnableBedrock`

- `bedrock.agent-api`: agent + action group defined by OpenAPI schema; input has `apiPath`, `httpMethod`, `requestBody`.
- `bedrock.agent-function`: action group defined by function details; input has `function` + `parameters` (sibling format).
- Trigger: `InvokeAgent` with a prompt that forces the action. Prerequisite: model access enabled in the account; the agent's model choice makes this the only non-deterministic trigger (retry logic in the script).
- Docs: [Bedrock agent action group Lambda events](https://docs.aws.amazon.com/bedrock/latest/userguide/agents-lambda.html)

### SES receiving - `supported` (`@middy/event-normalizer` pass-through; docs page `ses`) - tier 4 (domain)

- `ses.receipt`: verified domain identity + MX record (Route 53 params) + active receipt rule set with a Lambda action (`Event` invocation). Trigger: `SendEmail` from the domain to `test@<domain>`. Event: `Records[].ses.{mail, receipt}` including verdicts.
- Note: SES sending events (bounce/complaint/delivery) arrive via SNS, covered by the SNS kind; notification content documented separately.
- Docs: [Lambda action for receipt rules](https://docs.aws.amazon.com/ses/latest/dg/receiving-email-action-lambda.html), [Receiving notification contents](https://docs.aws.amazon.com/ses/latest/dg/receiving-email-notifications-contents.html)

### MSK - `supported` (`@middy/event-batch-*`, `@middy/glue-schema-registry`) - tier 2 (brokers)

- `msk.standard`: provisioned cluster (smallest instance class, 2 brokers), SASL/SCRAM secret (`AmazonMSK_` prefix) + IAM auth enabled, ESM on one topic. Trigger: in-VPC producer Lambda (packaged, `kafkajs`) publishes JSON, plain text, and binary values with headers. Event: `eventSource: "aws:kafka"`, `records` keyed by `topic-partition`, base64 key/value, `headers[]` as byte arrays.
- Deferred permutation: ESM schema-registry config (Glue/Confluent) changes payload delivery for Avro/Protobuf; requires a registry-aware producer. Documented for phase 2 (`@middy/glue-schema-registry` is the consumer).
- Networking: on-demand Kafka ESMs invoke the function through the customer VPC; without a NAT gateway the tier's PrivateLink endpoints (lambda, sts, secretsmanager) are required.
- Docs: [with-msk](https://docs.aws.amazon.com/lambda/latest/dg/with-msk.html), [MSK cluster and VPC network configuration](https://docs.aws.amazon.com/lambda/latest/dg/with-msk-cluster-network.html)

### Self-managed Apache Kafka - `supported` (same packages) - tier 2 (brokers)

- `kafka.self-managed`: second ESM of type `SelfManagedEventSource` pointing at the same MSK cluster's SASL/SCRAM bootstrap brokers (no separate cluster to run). Event differs from MSK: `eventSource: "SelfManagedKafka"`, `bootstrapServers` string instead of `eventSourceArn`.
- Docs: [with-kafka](https://docs.aws.amazon.com/lambda/latest/dg/with-kafka.html)

### Amazon MQ - `supported` (`@middy/event-normalizer`: `aws:amq`, `aws:rmq`) - tier 2 (brokers)

- `mq.activemq`: single-instance micro ActiveMQ broker + ESM. Trigger: in-VPC proxy POSTs to the ActiveMQ web console REST API (`/api/message`). Event: `eventSource: "aws:amq"`, `messages[].{messageID, messageType, data (base64), destination}`.
- `mq.rabbitmq`: single-instance micro RabbitMQ broker + ESM (virtual host + queue). Trigger: in-VPC proxy POSTs to the RabbitMQ management API (`/api/exchanges/.../publish`). Event: `eventSource: "aws:rmq"`, `rmqMessagesByQueue` keyed `queue::vhost`, base64 `data`, `basicProperties`.
- Docs: [with-mq](https://docs.aws.amazon.com/lambda/latest/dg/with-mq.html)

### DocumentDB change streams - `supported` (`@middy/event-normalizer` pass-through; docs page `documentdb`) - tier 2 (brokers)

- `docdb.insert`: cluster (1 x t3.medium) with change streams enabled on a collection, Secrets Manager auth, ESM. Trigger: the one packaged writer Lambda (`triggers/broker-writer/`, mongodb driver) inserts/updates/deletes; kinds captured per `operationType` from the same ESM (`docdb.insert` primary; update/delete recorded as permutations in the fixture set). Event: `eventSource: "aws:docdb"`, `events[].event` carrying the change stream document.
- Docs: [with-documentdb](https://docs.aws.amazon.com/lambda/latest/dg/with-documentdb.html)

### Step Functions - `na` (no transformation possible; payload is state-defined) - tier 0

- `sfn.task`: state machine with a `lambda:invoke` Task, `Payload.$: "$"` plus injected context (`$$.Execution.Id`, `$$.State.EnteredTime`). Trigger: `StartExecution`. Payload is template-defined; kind documents the mechanism and the context object fields.
- `sfn.task-token`: `lambda:invoke.waitForTaskToken` with `Token.$: "$$.Task.Token"` in the payload; captures a real task token format. Capture calls `SendTaskSuccess` so the execution completes.
- Docs: [Invoke Lambda from Step Functions](https://docs.aws.amazon.com/step-functions/latest/dg/connect-lambda.html), [Context object](https://docs.aws.amazon.com/step-functions/latest/dg/input-output-contextobject.html)

### CloudFormation custom resources - `supported` (`@middy/cloudformation-response`, `@middy/cloudformation-router`) - tier 0

- `cfn.custom-resource`: the harness stack itself contains a `Custom::MiddyCapture` resource pointing at the capture function (self-triggering): `Create` fires on deploy, `Update` when the `CaptureSerial` parameter changes, `Delete` on teardown. Capture PUTs success to `ResponseURL`. Event: `RequestType`, `ServiceToken`, `ResponseURL`, `StackId`, `RequestId`, `LogicalResourceId`, `ResourceType`, `ResourceProperties` (+ `OldResourceProperties` and `PhysicalResourceId` on Update).
- `cfn.macro` (`not-supported`): Lambda-backed template macro. Trigger: trigger.mjs creates and deletes a probe stack (`Transform: <macroname>`, one `WaitConditionHandle`, `CAPABILITY_AUTO_EXPAND`). Event: `{region, accountId, fragment, transformId, params, requestId, templateParameterValues}`; response `{requestId, status, fragment}`.
- Documented only: Lambda-backed CloudFormation hooks (proactive resource validation) use the hooks framework and a registry registration flow.
- Docs: [services-cloudformation](https://docs.aws.amazon.com/lambda/latest/dg/services-cloudformation.html), [Custom resource provider request/response reference](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/crpg-ref.html), [Custom resources](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/template-custom-resources.html), [Template macros](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/template-macros.html), [Lambda hooks](https://docs.aws.amazon.com/cloudformation-cli/latest/hooks-userguide/lambda-hooks.html)

### Lambda async destinations + DLQ - `not-supported` (no docs page) - tier 0

- `lambda.dest-success`: helper function (async-invoked, returns) with `OnSuccess` destination = capture Lambda. Destination event: `{version, timestamp, requestContext.{requestId, functionArn, condition, approximateInvokeCount}, requestPayload, responseContext, responsePayload}`.
- `lambda.dest-failure`: helper that throws, `OnFailure` destination; `responsePayload` carries the error object.
- `lambda.dlq`: helper that throws with an SQS DLQ; message body = original event, attributes `RequestID`/`ErrorCode`/`ErrorMessage`; delivered through the SQS ESM capture.
- Trigger: `Invoke` with `InvocationType: "Event"`; destinations fire after retries are exhausted (2 retries, ~minutes for failure kinds; script uses `MaximumRetryAttempts: 0` on the helpers to make it immediate).
- Docs: [Async invocation, destinations and DLQs](https://docs.aws.amazon.com/lambda/latest/dg/invocation-async.html)

### Secrets Manager rotation - `na` (docs page `secrets-manager`, no middleware) - tier 0

- `secrets.rotation`: throwaway secret with the capture function as rotation Lambda. Trigger: `RotateSecret`. Event: `{Step: "createSecret", SecretId, ClientRequestToken}` (first step only; rotation is then abandoned and the secret force-deleted on teardown).
- Docs: [Rotate secrets with Lambda](https://docs.aws.amazon.com/secretsmanager/latest/userguide/rotate-secrets_lambda.html)

### IoT Core rules - `na` (docs page `iot`, no middleware) - tier 0

- `iot.rule`: topic rule `SELECT * FROM 'middy/capture'` -> Lambda. Trigger: `iot-data Publish` (JSON payload). Payload = the SQL projection of the message: arbitrary by construction; a `SELECT *` fixture plus the note that any SQL clause reshapes it.
- `iot.custom-authorizer` (`not-supported`): custom authorizer with `SigningDisabled: true`. Trigger: `TestInvokeAuthorizer` with an MQTT context (no MQTT client or device cert needed). Event: `protocolData.mqtt.{username, password, clientId}`, `protocols[]`, `signatureVerified`, `connectionMetadata`. Response is the IoT auth result (`isAuthenticated`, `policyDocuments[]`).
- Documented only: the fleet provisioning pre-provisioning hook (distinct `{claimCertificateId, parameters}` event) needs a claim-certificate device flow.
- Docs: [services-iot](https://docs.aws.amazon.com/lambda/latest/dg/services-iot.html), [IoT rule actions](https://docs.aws.amazon.com/iot/latest/developerguide/iot-rule-actions.html), [Custom authentication](https://docs.aws.amazon.com/iot/latest/developerguide/config-custom-auth.html), [Pre-provisioning hooks](https://docs.aws.amazon.com/iot/latest/developerguide/pre-provisioning-hook.html)

### AWS Config custom rules - `supported` (`@middy/event-normalizer` parses `invokingEvent`/`ruleParameters`) - tier 0, gated `EnableConfig`

- `config.rule`: custom Config rule (change-triggered on a tag-bearing resource in the stack) + `StartConfigRulesEvaluation`. Event: `invokingEvent` (JSON string: configuration item), `ruleParameters` (JSON string), `resultToken`, `eventLeftScope`. Gated because the configuration recorder is an account-level singleton; enabling in an account that already records will fail (use the existing recorder and set only the rule in that case, see README).
- Permutation note: oversized configuration items deliver `configurationItemSummary` instead; periodic rules deliver a different `invokingEvent.messageType`.
- Docs: [governance-config](https://docs.aws.amazon.com/lambda/latest/dg/governance-config.html), [Custom Config rules](https://docs.aws.amazon.com/config/latest/developerguide/evaluate-config_develop-rules.html)

### CodeCommit triggers - `supported` (`@middy/event-normalizer` pass-through; docs page `code-commit`) - tier 0, gated `EnableCodeCommit`

- `codecommit.push`: repository + trigger on `updateReference`. Trigger: `PutFile`. Event: `Records[].{codecommit.references[], eventSource: "aws:codecommit", ...}`. Gated because CodeCommit is closed to accounts that never used it (AWS stopped onboarding new customers in 2024); kind reports `skipped` where unavailable.
- Docs: [Trigger Lambda from CodeCommit](https://docs.aws.amazon.com/codecommit/latest/userguide/how-to-notify-lambda-cc.html)

### CodePipeline invoke action - `supported` (`@middy/event-normalizer` parses `UserParameters`) - tier 0

- `codepipeline.job`: V2 pipeline (S3 source -> Invoke action with `UserParameters` JSON). Trigger: upload source zip, `StartPipelineExecution`. Event: `CodePipeline.job.{id, accountId, data.actionConfiguration.configuration.UserParameters, inputArtifacts[], artifactCredentials}`. Capture calls `PutJobSuccessResult` so the pipeline completes.
- Docs: [Invoke a Lambda function in a pipeline](https://docs.aws.amazon.com/codepipeline/latest/userguide/actions-invoke-lambda-function.html)

### AWS Transfer Family - `not-supported` (no docs page) - gated `EnableTransfer`

- `transfer.custom-idp`: SFTP server with `IdentityProviderType: AWS_LAMBDA`. Trigger: `TestIdentityProvider` (fires the Lambda for real, no SFTP client). Event: `{username, password, protocol, serverId, sourceIp}`; response `{Role, HomeDirectory}` (or `HomeDirectoryDetails`/`PublicKeys`).
- Documented only: managed workflow custom steps (`{token, serviceMetadata.{executionDetails, transferDetails}}` + `SendWorkflowStepState` callback) need a real file transfer to fire.
- Docs: [Lambda custom identity provider](https://docs.aws.amazon.com/transfer/latest/userguide/custom-lambda-idp.html), [Workflow custom step details](https://docs.aws.amazon.com/transfer/latest/userguide/custom-step-details.html)

### Documented-only rows (no infra; excluded with reasons)

| source | middy tag | why excluded | docs |
| --- | --- | --- | --- |
| Direct `Invoke` / test console | `na` | arbitrary payload; it is the trigger mechanism itself | [Invoke API](https://docs.aws.amazon.com/lambda/latest/api/API_Invoke.html) |
| Alexa Skills Kit | `na` (docs page `alexa`) | requires an external Amazon developer account + skill; not CloudFormation-provisionable | [Host a custom skill as Lambda](https://developer.amazon.com/en-US/docs/alexa/custom-skills/host-a-custom-skill-as-an-aws-lambda-function.html) |
| Amazon Connect contact flows | `na` (docs page `connect`) | instance + contact flow provisioning is heavy; automatable later via `StartChatContact` if wanted | [Connect Lambda functions](https://docs.aws.amazon.com/connect/latest/adminguide/connect-lambda-functions.html) |
| Amazon WorkMail message flows | `na` (docs page `workmail`) | requires a WorkMail org + domain; niche | [WorkMail Lambda integration](https://docs.aws.amazon.com/workmail/latest/adminguide/lambda.html) |
| Amazon Chime SDK (SIP media apps, messaging channel flows) | `not-supported` | SIP needs provisioned phone numbers; channel flows need a messaging app | [Chime SDK developer guide](https://docs.aws.amazon.com/chime-sdk/latest/dg/what-is-chime-sdk.html), [Channel flows](https://docs.aws.amazon.com/chime-sdk/latest/dg/using-channel-flows.html) |
| Amazon Pinpoint custom channels | `not-supported` | Pinpoint is end-of-life October 2026; AWS has pruned the deep-link docs | [Pinpoint developer guide](https://docs.aws.amazon.com/pinpoint/latest/developerguide/welcome.html) |
| Amazon Kendra custom document enrichment | `not-supported` | requires a Kendra index (expensive) | [Custom document enrichment](https://docs.aws.amazon.com/kendra/latest/dg/custom-document-enrichment.html) |
| Athena Lambda UDFs / federated queries | `not-supported` | Athena Query Federation SDK protocol, not a plain JSON event | [Athena UDFs](https://docs.aws.amazon.com/athena/latest/ug/querying-udf.html) |
| Redshift Lambda UDFs | `not-supported` | requires a Redshift cluster/workgroup | [Redshift Lambda UDFs](https://docs.aws.amazon.com/redshift/latest/dg/udf-creating-a-lambda-sql-udf.html) |
| Amazon SWF Lambda tasks | `not-supported` | legacy service; Step Functions is the successor | [SWF Lambda tasks](https://docs.aws.amazon.com/amazonswf/latest/developerguide/lambda-task.html) |
| Aurora native Lambda invocation | `na` (docs page `rds`) | payload is SQL-author-defined; needs an Aurora cluster | [Aurora PostgreSQL Lambda](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/PostgreSQL-Lambda.html) |
| RDS event notifications | `na` (docs page `rds`) | delivered via SNS (covered by `sns.standard` envelope); needs an RDS instance to emit | [RDS events](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_Events.html) |
| AWS IoT Events actions | `na` (docs page `iot-events`) | service closed to new customers (2025) and AWS has retired the entire IoT Events developer guide (all URLs 404); no citable reference remains | none (verified removed 2026-07) |
| Lambda@Edge for CloudFront Functions | n/a | CloudFront Functions are not Lambda | [CloudFront Functions](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/cloudfront-functions.html) |
| Transfer Family workflow custom steps | `not-supported` | needs a real SFTP file transfer to fire | [Workflow custom steps](https://docs.aws.amazon.com/transfer/latest/userguide/custom-step-details.html) |
| IoT fleet provisioning pre-provisioning hook | `not-supported` | needs a claim-certificate device provisioning flow | [Pre-provisioning hooks](https://docs.aws.amazon.com/iot/latest/developerguide/pre-provisioning-hook.html) |
| CloudFormation Lambda-backed hooks | `not-supported` | hooks framework + registry registration, heavyweight | [Lambda hooks](https://docs.aws.amazon.com/cloudformation-cli/latest/hooks-userguide/lambda-hooks.html) |
| CodeDeploy lifecycle hooks | `not-supported` | needs a full CodeDeploy deployment (ECS/Lambda blue-green) per event | [AppSpec hooks](https://docs.aws.amazon.com/codedeploy/latest/userguide/reference-appspec-file-structure-hooks.html) |
| AppSync Events API Lambda handlers | `not-supported` | WebSocket pub/sub Events API; promote to auto once its Lambda data-source path is exercised | [AppSync Events](https://docs.aws.amazon.com/appsync/latest/eventapi/event-api-welcome.html) |
| AppConfig custom extension action points | `not-supported` | `PRE_CREATE_HOSTED_CONFIGURATION_VERSION` etc.; adjacent to `@middy/appconfig` but a niche authoring-time event | [Custom extension Lambda](https://docs.aws.amazon.com/appconfig/latest/userguide/working-with-appconfig-extensions-creating-custom-lambda.html) |
| Bedrock Knowledge Base custom transformations | `not-supported` | needs a KB + vector store per ingestion event | [KB custom transformation](https://docs.aws.amazon.com/bedrock/latest/userguide/kb-custom-transformation.html) |
| SSM Automation `aws:invokeLambdaFunction` | `na` | payload is runbook-author-defined | [Automation action reference](https://docs.aws.amazon.com/systems-manager/latest/userguide/automation-action-lamb.html) |
| SageMaker Pipelines Lambda step | `na` | payload is pipeline-author-defined | [Pipeline steps](https://docs.aws.amazon.com/sagemaker/latest/dg/build-and-manage-steps.html) |
| IoT Greengrass local Lambdas | `na` | Lambda runs on-device; not a cloud event delivery path | [Run Lambda on Greengrass](https://docs.aws.amazon.com/greengrass/v2/developerguide/run-lambda-functions.html) |

## Coverage accounting

`manifest.json` is the contract. Every kind above appears with `trigger: "auto" | "manual" | "documented"`, its tier, tag, and doc links. A run is green when every `auto` kind in an enabled tier has a fixture. `documented` rows are the explicit, justified exclusions; anything not in the manifest at all is a spec bug.

Current totals (auto kinds): SQS 5, SNS 1, S3 7, S3 Batch 1, S3 Object Lambda 1, DynamoDB 5, Kinesis 3, Firehose 1, CW Logs 1, CW Alarm 1, EventBridge 6, API GW REST 7, HTTP API 6, WebSocket 4, Function URL 2, ALB 2, Lattice 2, CloudFront 5, Cognito 10, AppSync 1, Lex 2, Bedrock 2, SES 1, MSK 1, self-managed Kafka 1, MQ 2, DocumentDB 1, Step Functions 2, CFN 2, destinations/DLQ 3, Secrets 1, IoT 2, Config 1, CodeCommit 1, CodePipeline 1, Transfer 1 = 94 kinds.

## Phase 2 hook (JSON Schemas)

For each fixture, author `schemas/<kind>.json` (JSON Schema draft 2020-12). Inputs, in priority order: the captured fixture (ground truth), the AWS doc page linked in the manifest, the EventBridge schema registry (`aws.events`, retrievable via the aws-serverless MCP `get_lambda_event_schemas`), and `@types/aws-lambda` as a community cross-check. Divergences between docs and fixtures get recorded in the schema `description`. Schemas then back `@middy/validator` presets and the per-middleware type tests.
