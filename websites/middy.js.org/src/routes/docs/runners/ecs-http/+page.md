---
title: ecs-http
description: "Run a Middy handler as an HTTP server on AWS ECS/Fargate, with cluster-managed workers and graceful shutdown."
---

`@middy/ecs-http` is a runtime wrapper, not a middleware. It lets you take an existing Middy handler (the same one you would deploy to AWS Lambda) and serve it as a long-running HTTP server on AWS ECS/Fargate. Each request is translated into the same event shape your handler already expects (API Gateway HTTP API v2, REST v1, or ALB target group), invoked, and the return value is mapped back to an HTTP response.

The package spawns one `node:cluster` worker per CPU core by default (`availableParallelism()`). With a single worker it serves from the main process instead, which saves a process (about 57 MB) and its startup on the first request; a crash then exits the process for ECS or Lambda to replace. With more than one, it replaces workers that exit with exponential backoff (1 s, doubling to a 30 s cap, reset after 60 s without a worker exit, so a worker that dies on startup cannot crash-loop), and forwards `SIGTERM` for a clean drain when ECS stops the task.

## Lambda Web Functions

[Lambda Web Functions](https://aws.amazon.com/about-aws/whats-new/2026/10/aws-lambda-web-functions/) run your code as an HTTP server instead of calling an `(event, context)` handler, so this runner is also how you serve a Middy handler from one. The runner detects a Web Function from the `AWS_LAMBDA_HTTP_ENDPOINT` environment variable, which Lambda always sets there, and then defaults to:

- listening on the host and port in `AWS_LAMBDA_HTTP_ENDPOINT`, the only address Lambda routes to;
- `gracefulShutdownMs` of `800`, since Lambda allows 1 s after `SIGTERM`;
- the `lambda-web-request-id` header as `context.awsRequestId` and `requestContext.requestId`. Off Lambda that header is ignored, since only a client could have sent it.

Options you pass still win. Each environment has 2 vCPUs, so the default `workers` is a two-worker cluster. To stream, use Middy's standard execution mode and return a Node `Readable` or web `ReadableStream` as `body`; `executionModeStreamifyResponse` targets Lambda Event Functions and does not run here. Outside ECS there is no task metadata endpoint, so the metadata lookup is skipped and the ECS fields on `requestContext` are left unset. Pass `requestContext` to fill in anything your handler reads from them.

## Install

To install this runner you can use NPM:

```bash npm2yarn
npm install --save @middy/ecs-http
```

## Options

- `handler` (function): Your Middy handler, e.g. `middy(lambdaHandler).use(...)`. Pass this or `loadHandler`, not both.
- `loadHandler` (async function): Returns your handler, e.g. `() => import('./handler.js').then((m) => m.handler)`. It is called only in the process that serves requests, so with more than one worker the cluster primary never imports your application; see [Faster cluster start](#faster-cluster-start). It must resolve to the handler function, or startup fails with a `TypeError`.
- `port` (integer): TCP port to bind. Defaults to `80`, or the port in `AWS_LAMBDA_HTTP_ENDPOINT` on a Lambda Web Function.
- `host` (string): Address to bind. Defaults to all interfaces, or the host in `AWS_LAMBDA_HTTP_ENDPOINT` on a Lambda Web Function.
- `eventVersion` (string): One of `"2.0"` (API Gateway HTTP API), `"1.0"` (API Gateway REST), or `"alb"` (ALB target group). Defaults to `"2.0"`.
- `requestContext` (object): Static fields merged into every event's `requestContext`. Merged on top of values fetched from the ECS task metadata endpoint, so caller-provided values win.
- `workers` (integer): Number of forked worker processes. Defaults to `availableParallelism()` (matches Fargate vCPU at runtime). `1` serves from the main process with no cluster.
- `timeout` (integer, ms): Wall-clock budget exposed via `context.getRemainingTimeInMillis`. Defaults to `60000`. Abort itself is Middy's job: its early timeout (`timeoutEarlyInMillis`, 5 ms by default) answers with an error just before the budget runs out. On a server that timer has a cost; see [Early timeout](#early-timeout).
- `bodyLimit` (integer, bytes): Maximum request body size. Defaults to `10 * 1024 * 1024` (10 MB, matches the ALB default). Over-limit requests get a `413` response: a declared `Content-Length` above the limit is rejected before the body is read, and a streamed body stops buffering and gets the `413` once it passes the limit.
- `gracefulShutdownMs` (integer, ms): How long a worker drains after `SIGTERM` before force-closing the remaining connections and exiting `1`. Defaults to `25000`, or `800` on a Lambda Web Function. Keep it a few seconds below the ECS task `stopTimeout` (30 s by default), as with `@middy/ecs-batch`.
- `trustedProxies` (integer): Number of trailing `X-Forwarded-For` hops appended by proxies you control. Defaults to `1`, which is a single ALB in front of the task: the client IP is the last hop, the one the load balancer appended. Set `2` when CloudFront sits in front of the ALB, and `0` to ignore the header and use the socket address (no proxy at all).
- `contextOverride` (object, optional): Escape hatch for tests and hosts that need fixed context values. Accepts `{ awsRequestId: (headers) => string }`, called with the lowercased request headers to supply the request ID when the `X-Amzn-Trace-Id` header (`lambda-web-request-id` on a Lambda Web Function) is absent.

NOTES:

- The runner is silent. Wire request/response logging via Middy middleware (e.g. `event-logger`, `response-logger`, `error-logger`).
- Errors thrown by the handler are mapped to HTTP responses: if the error has a numeric `.statusCode` (matching `http-errors`), it is honored; otherwise a `500` is returned.
- `requestContext.requestId` is taken from the inbound `X-Amzn-Trace-Id` header (`lambda-web-request-id` on a Lambda Web Function). ALB and API Gateway always set it. If absent (typically only in local dev or behind a non-AWS load balancer) the request ID is an empty string. The runner deliberately does not mint a fallback UUID, since correlation in real deployments is provided by AWS, and per-request UUID generation is hot-path CPU that real handlers can use instead. Wire your own middleware if you need a fallback.
- Client IP (`sourceIp`) is resolved by counting `trustedProxies` hops from the end of `X-Forwarded-For`. Hops before that are whatever the client sent and are ignored, so a request carrying `X-Forwarded-For: 6.6.6.6` still resolves to the address ALB appended. When the load balancer's `routing.http.xff_client_port.enabled` attribute is on, the hop is `ip:port` or `[ipv6]:port`; the port and brackets are stripped so `sourceIp` is the address only. When the header is missing, or has fewer hops than `trustedProxies`, the socket's `remoteAddress` is used. See the [ALB X-Forwarded-For docs](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/x-forwarded-headers.html).
- `sourceIp` lands in `requestContext.http.sourceIp` (`"2.0"`) and `requestContext.identity.sourceIp` (`"1.0"`). ALB events have no identity block, so with `eventVersion: "alb"` read `X-Forwarded-For` from `event.headers` as you would on Lambda.
- Binary content types are auto-detected and base64-encoded into `event.body` (matching API Gateway behavior); text content types pass through as UTF-8.
- With `eventVersion: "2.0"`, a query parameter that repeats is combined with commas in `queryStringParameters` (`?a=1&a=2` becomes `{ a: "1,2" }`), as [API Gateway HTTP API payload format 2.0](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-develop-integrations-lambda.html) does. `rawQueryString` keeps every value. `"1.0"` events list each value in `multiValueQueryStringParameters`.
- Response `multiValueHeaders` (API Gateway REST, ALB multi-value) are sent alongside `headers`, so repeated headers such as `set-cookie` each go out as their own line. When a header is in both, its values are merged and a value present in both is sent once, as [API Gateway](https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html#api-gateway-simple-proxy-for-lambda-output-format) does.
- A response `body` should be a string, as on Lambda. A `Buffer` or `Uint8Array` is sent as-is, a Node `Readable` or web `ReadableStream` is streamed to the client with chunked encoding, and any other value (an object, a number) is sent as `JSON.stringify(body)` rather than failing the request. A stream that fails partway cuts the response off.
- A response that fails after its headers were written (the connection dropped mid-body, for example) cannot turn into an error response; the runner destroys the socket so the client sees a truncated response instead.
- The ECS task metadata endpoint (`$ECS_CONTAINER_METADATA_URI_V4`) is fetched once in the primary process; values are propagated to workers via env vars and exposed on `requestContext` (`accountId`, `region`, `taskArn`, `family`, `revision`).

## Sample usage

```javascript
import middy from '@middy/core'
import { ecsHttpRunner } from '@middy/ecs-http'
import httpErrorHandler from '@middy/http-error-handler'
import httpJsonBodyParser from '@middy/http-json-body-parser'
import httpRouter from '@middy/http-router'

const getHandler = middy()
  .handler((event) => ({
    statusCode: 200,
    body: JSON.stringify({ id: event.pathParameters.id }),
  }))

const postHandler = middy()
  .use(httpJsonBodyParser())
  .handler((event) => ({
    statusCode: 201,
    body: JSON.stringify(event.body),
  }))

const handler = middy()
  .use(httpErrorHandler())
  .handler(httpRouter([
    { method: 'GET',  path: '/user/{id}', handler: getHandler },
    { method: 'POST', path: '/user',      handler: postHandler },
  ]))

await ecsHttpRunner({
  handler,
  port: Number(process.env.PORT ?? 8080),
  eventVersion: '2.0',
  requestContext: {
    accountId: process.env.AWS_ACCOUNT_ID ?? 'local',
    apiId: process.env.API_ID ?? 'local',
  },
})
```

## Early timeout

For every request, Middy arms a timer so that `timeoutEarlyResponse` can answer before `timeout` runs out (`timeoutEarlyInMillis`, 5 ms by default). On a long-running server that timer is most of what `middy()` costs per request, roughly a tenth of the CPU of a small request, because Node builds and tears down a timer list for each one. Lambda Event Functions don't notice it, since they run one invocation at a time. Handlers that don't need the early answer should turn it off:

```javascript
const handler = middy({ timeoutEarlyInMillis: 0 })
  .use(httpErrorHandler())
  .handler(lambdaHandler)
```

With it off, the runner no longer turns a handler that overruns `timeout` into an error response: the client waits until it, or the load balancer, gives up (an ALB's idle timeout is 60 s by default), and the handler keeps running in the meantime. `context.getRemainingTimeInMillis()` still counts down for handlers that check it themselves. On a Lambda Web Function the revision's `timeoutSeconds` still bounds each request.

## Faster cluster start

In a cluster, every process runs your entry file, including the primary, which only forks workers. If the entry file imports the handler, the primary imports the whole application (middlewares, AWS SDK clients, …) before it can fork, and then every worker imports it again. Put the handler in its own module and pass `loadHandler` so only processes that serve requests import it:

```javascript
// index.js
import { ecsHttpRunner } from '@middy/ecs-http'

await ecsHttpRunner({
  loadHandler: () => import('./handler.js').then((m) => m.handler),
})
```

With an application that takes about 135 ms to import (Middy HTTP middlewares, the DynamoDB and S3 clients, and zod), a two-worker cluster answered its first request in about 350 ms instead of 500 ms and used 227 MB instead of 255 MB. The saving grows with the application's import time. With a single worker the process serves requests itself, so both forms start the same.

## Health check route

ECS-fronting load balancers (ALB, NLB with target health checks) need an endpoint that returns `2xx`. The runner does not bake one in, so add it to your routes and skip any heavy middleware on that path:

```javascript
import middy from '@middy/core'
import { ecsHttpRunner } from '@middy/ecs-http'
import httpRouter from '@middy/http-router'

const healthHandler = () => ({ statusCode: 200, body: 'ok' })

const apiHandler = middy()
  // ... your real middleware stack
  .handler((event) => ({ statusCode: 200, body: '{}' }))

const handler = middy().handler(httpRouter([
  { method: 'GET', path: '/_health', handler: healthHandler },
  { method: 'ANY', path: '/{proxy+}', handler: apiHandler },
]))

await ecsHttpRunner({ handler, port: 8080, eventVersion: '2.0' })
```

Configure your ALB target group to hit `/_health` with the default `HTTP 200` matcher. ALB sends `SIGTERM` to the task on deregistration; the runner's primary forwards it to all workers and stops replacing them, each worker stops accepting new connections, answers with `Connection: close` so keep-alive sockets close after their in-flight response, and exits `0` once they have drained, or force-closes the remaining connections and exits `1` after `gracefulShutdownMs`, and the primary exits once the last worker is gone with the highest exit code any worker reported during the drain (`0` when all drained cleanly; a worker killed by a signal counts as `1`). Only exits after `SIGTERM` count: a worker that crashed earlier was replaced with backoff and does not affect the task's exit code. With `workers: 1` there is no primary: the process drains itself the same way and exits `0` or `1`.

## Sample usage (ALB target group)

If your ECS service is registered directly to an ALB target group (no API Gateway in front), use the ALB event shape so handler and middleware see the fields ALB actually sends:

```javascript
import middy from '@middy/core'
import { ecsHttpRunner } from '@middy/ecs-http'

const handler = middy()
  .handler((event) => {
    // event.httpMethod, event.path, event.headers, event.requestContext.elb
    // No requestContext.identity: the client address is in
    // event.headers['x-forwarded-for'], as on Lambda.
    return { statusCode: 200, body: 'ok' }
  })

await ecsHttpRunner({
  handler,
  port: 8080,
  eventVersion: 'alb',
})
```
