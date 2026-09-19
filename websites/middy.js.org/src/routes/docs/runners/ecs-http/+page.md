---
title: ecs-http
description: "Run a Middy handler as an HTTP server on AWS ECS/Fargate, with cluster-managed workers and graceful shutdown."
---

`@middy/ecs-http` is a runtime wrapper, not a middleware. It lets you take an existing Middy handler (the same one you would deploy to AWS Lambda) and serve it as a long-running HTTP server on AWS ECS/Fargate. Each request is translated into the same event shape your handler already expects (API Gateway HTTP API v2, REST v1, or ALB target group), invoked, and the return value is mapped back to an HTTP response.

The package spawns one `node:cluster` worker per CPU core by default (`availableParallelism()`), replaces workers that exit with exponential backoff (1 s, doubling to a 30 s cap, reset after 60 s without a worker exit, so a worker that dies on startup cannot crash-loop), and forwards `SIGTERM` for a clean drain when ECS stops the task.

## Install

To install this runner you can use NPM:

```bash npm2yarn
npm install --save @middy/ecs-http
```

## Options

- `handler` (function) (required): Your Middy handler, e.g. `middy(lambdaHandler).use(...)`.
- `port` (integer): TCP port to bind. Defaults to `80`.
- `eventVersion` (string): One of `"2.0"` (API Gateway HTTP API), `"1.0"` (API Gateway REST), or `"alb"` (ALB target group). Defaults to `"2.0"`.
- `requestContext` (object): Static fields merged into every event's `requestContext`. Merged on top of values fetched from the ECS task metadata endpoint, so caller-provided values win.
- `workers` (integer): Number of forked worker processes. Defaults to `availableParallelism()` (matches Fargate vCPU at runtime).
- `timeout` (integer, ms): Wall-clock budget exposed via `context.getRemainingTimeInMillis`. Defaults to `60000`. Abort itself is Middy's job (configure `timeoutEarlyInMillis` on your handler if you need early-timeout behavior).
- `bodyLimit` (integer, bytes): Maximum request body size. Defaults to `10 * 1024 * 1024` (10 MB, matches the ALB default). Returns `413` on overflow.
- `trustedProxies` (integer): Number of trailing `X-Forwarded-For` hops appended by proxies you control. Defaults to `1`, which is a single ALB in front of the task: the client IP is the last hop, the one the load balancer appended. Set `2` when CloudFront sits in front of the ALB, and `0` to ignore the header and use the socket address (no proxy at all).
- `contextOverride` (object, optional): Escape hatch for tests and hosts that need fixed context values. Accepts `{ awsRequestId: (headers) => string }`, called with the lowercased request headers to supply the request ID when the `X-Amzn-Trace-Id` header is absent.

NOTES:

- The runner is silent. Wire request/response logging via Middy middleware (e.g. `event-logger`, `response-logger`, `error-logger`).
- Errors thrown by the handler are mapped to HTTP responses: if the error has a numeric `.statusCode` (matching `http-errors`), it is honored; otherwise a `500` is returned.
- `requestContext.requestId` is taken from the inbound `X-Amzn-Trace-Id` header. ALB and API Gateway always set it. If absent (typically only in local dev or behind a non-AWS load balancer) the request ID is an empty string. The runner deliberately does not mint a fallback UUID, since correlation in real deployments is provided by AWS, and per-request UUID generation is hot-path CPU that real handlers can use instead. Wire your own middleware if you need a fallback.
- Client IP (`sourceIp`) is resolved by counting `trustedProxies` hops from the end of `X-Forwarded-For`. Hops before that are whatever the client sent and are ignored, so a request carrying `X-Forwarded-For: 6.6.6.6` still resolves to the address ALB appended. When the load balancer's `routing.http.xff_client_port.enabled` attribute is on, the hop is `ip:port` or `[ipv6]:port`; the port and brackets are stripped so `sourceIp` is the address only. When the header is missing, or has fewer hops than `trustedProxies`, the socket's `remoteAddress` is used. See the [ALB X-Forwarded-For docs](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/x-forwarded-headers.html).
- `sourceIp` lands in `requestContext.http.sourceIp` (`"2.0"`) and `requestContext.identity.sourceIp` (`"1.0"`). ALB events have no identity block, so with `eventVersion: "alb"` read `X-Forwarded-For` from `event.headers` as you would on Lambda.
- Binary content types are auto-detected and base64-encoded into `event.body` (matching API Gateway behavior); text content types pass through as UTF-8.
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

Configure your ALB target group to hit `/_health` with the default `HTTP 200` matcher. ALB sends `SIGTERM` to the task on deregistration; the runner's primary forwards it to all workers and stops replacing them, each worker stops accepting new connections and exits once its in-flight requests have drained, and the primary exits once the last worker is gone with the highest exit code any worker reported during the drain (`0` when all drained cleanly; a worker killed by a signal counts as `1`). Only exits after `SIGTERM` count: a worker that crashed earlier was replaced with backoff and does not affect the task's exit code.

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
