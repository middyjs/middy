---
title: ecs-task
description: "Run a Middy handler as a single-shot ECS/Fargate task, triggered by Step Functions, EventBridge Scheduler, EventBridge rules, or direct RunTask calls."
---

`@middy/ecs-task` is a runtime wrapper, not a middleware. It lets you take an existing Middy handler (the same one you would deploy to AWS Lambda) and run it as a one-shot container in AWS ECS/Fargate. The runner reads the invocation payload from environment variables (or `process.argv`), builds a Lambda-shape `event` and `context`, invokes the handler once, and exits with `0` on success or `1` on failure — matching Step Functions `.sync` task semantics.

Unlike `@middy/ecs-http`, there is no HTTP server, no cluster, and no long-lived loop. One invocation per task.

## Triggers

ECS tasks can be launched by:

- **Step Functions** (`.sync` integration, or `.waitForTaskToken` for async callback)
- **EventBridge Scheduler** (replaces ECS Scheduled Tasks)
- **EventBridge rules** (event-driven, e.g. on S3 PutObject)
- **AWS Lambda** calling `RunTask` directly via the SDK
- **Manual / CI** (`aws ecs run-task ...`)

In every case, AWS delivers your input to the container through `containerOverrides` on the `RunTask` call — either as environment variables or as a `command` (argv) override. There is no other channel.

## Install

```bash npm2yarn
npm install --save @middy/ecs-task
```

## Options

- `handler` (function) (required): Your Middy handler, e.g. `middy(lambdaHandler).use(...)`.
- `eventEnv` (string): Environment variable to read the JSON payload from. Defaults to `"MIDDY_ECS_TASK_EVENT"`.
- `eventArg` (boolean): When `true` (default), `process.argv[2]` is parsed first and takes precedence over the env var. Set `false` to ignore argv.
- `timeout` (integer, ms): Wall-clock budget exposed via `context.getRemainingTimeInMillis`. Defaults to `60000`. Abort itself is Middy's job (configure `timeoutEarlyInMillis` on your handler if you need early-timeout behaviour).
- `stopTimeout` (integer, ms): On `SIGTERM`, the runner waits up to this many milliseconds before forcing `process.exit(124)`. Defaults to `30000` — match this to (or set just below) the ECS task's configured `stopTimeout`.
- `onSuccess(result, context)` (async function, optional): Called after the handler resolves, before `process.exit(0)`. Use it to post results — `SendTaskSuccess` for Step Functions `.waitForTaskToken`, write to S3, etc.
- `onFailure(error, context)` (async function, optional): Called when the handler throws, before `process.exit(1)`. Use for `SendTaskFailure` or error reporting. Errors thrown inside `onFailure` are swallowed; the original handler error still drives the exit code.

## Input resolution

Priority order:

1. `process.argv[2]` (if `eventArg !== false`) — JSON-parsed; raw string if not valid JSON.
2. `process.env[eventEnv]` — same parse rule.
3. Empty object `{}`.

This matches AWS precedence: `containerOverrides.command` overrides the container `CMD`, and `containerOverrides.environment` is the standard channel. Note the combined `containerOverrides` payload has an 8 KiB hard limit. For larger payloads, pass an S3 pointer in the env var and have the handler fetch it.

## Context

The runner builds a Lambda-compatible `context`:

- `awsRequestId`: ECS task ID (from the task ARN), else a `crypto.randomUUID()`.
- `invokedFunctionArn`: the ECS task ARN, when available from the metadata endpoint.
- `getRemainingTimeInMillis()`: clamped countdown of `timeout` from task start.
- `callbackWaitsForEmptyEventLoop: false`.
- ECS metadata fields (`accountId`, `region`, `taskArn`, `family`, `revision`) merged in.

The ECS task metadata endpoint (`$ECS_CONTAINER_METADATA_URI_V4`) is fetched once on startup and cached on the process env (`MIDDY_ECS_*`).

## Sample usage

### Step Functions `.sync` (fire-and-forget, exit code is the result)

```javascript
import middy from '@middy/core'
import { ecsTaskRunner } from '@middy/ecs-task'

const handler = middy()
  .handler(async (event) => {
    // event is whatever Step Functions passed via containerOverrides
    await doWork(event)
  })

await ecsTaskRunner({ handler })
```

Configure your Step Functions task state to map input into `containerOverrides[].environment[].MIDDY_ECS_TASK_EVENT` — `States.JsonToString($)` is a common idiom.

### Step Functions `.waitForTaskToken` (return a result payload)

```javascript
import middy from '@middy/core'
import { ecsTaskRunner } from '@middy/ecs-task'
import { SFNClient, SendTaskSuccessCommand, SendTaskFailureCommand } from '@aws-sdk/client-sfn'

const sfn = new SFNClient()
const taskToken = process.env.MIDDY_ECS_TASK_TOKEN

const handler = middy()
  .handler(async (event) => ({ summary: await summarise(event) }))

await ecsTaskRunner({
  handler,
  onSuccess: async (result) => {
    if (!taskToken) return
    await sfn.send(new SendTaskSuccessCommand({
      taskToken,
      output: JSON.stringify(result),
    }))
  },
  onFailure: async (error) => {
    if (!taskToken) return
    await sfn.send(new SendTaskFailureCommand({
      taskToken,
      error: error.name ?? 'Error',
      cause: error.message ?? String(error),
    }))
  },
})
```

Pass the task token from the state machine into a `containerOverrides[].environment[].MIDDY_ECS_TASK_TOKEN` entry alongside the payload env var.

### Large payloads via S3 pointer

```javascript
import middy from '@middy/core'
import { ecsTaskRunner } from '@middy/ecs-task'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'

const s3 = new S3Client()

const handler = middy()
  .handler(async (event) => {
    if (event.s3 != null) {
      const obj = await s3.send(new GetObjectCommand(event.s3))
      event = JSON.parse(await obj.Body.transformToString())
    }
    return process(event)
  })

await ecsTaskRunner({ handler })
```

## SIGTERM &amp; Fargate Spot

ECS sends `SIGTERM` to the container when stopping a task — including when a Fargate Spot task is interrupted. The runner installs a `SIGTERM` listener that schedules a forced `process.exit(124)` after `stopTimeout` ms.

The runner does **not** abort the in-flight handler. If you need handler-aware cancellation:

- Configure Middy's `timeoutEarlyInMillis` on your handler to fire before the ECS-level `stopTimeout`. Middy's own `AbortController` will then signal middlewares.
- Set the ECS task's `stopTimeout` (in the task definition) to give your handler enough headroom. Default is 30s; max is 120s.

The 2-minute Spot interruption warning is delivered via EventBridge only — it is not readable from inside the container. If you need it, consume the `aws.ecs` `ECS Task State Change` event in a separate consumer.

## Notes

- The runner is silent. Wire logging via Middy middleware (e.g. `input-output-logger`, `error-logger`).
- `onSuccess` / `onFailure` errors do not change the exit code — the handler's outcome wins.
- The runner resolves before calling `process.exit`, so any pending I/O initiated synchronously in the hooks should be `await`ed there.
