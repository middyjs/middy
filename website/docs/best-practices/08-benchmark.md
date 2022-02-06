---
title: Benchmark
sidebar_position: 8
---

The [`benchmark`](https://github.com/middyjs/middy/tree/main/benchmark) folder on the Middy repository contains a collection of examples and tools for running benchmarks on AWS Lambda.

## Examples

- `baseline`: Just runs `@middy/core`
- `api-gateway`: `@middy/http-*` middleware
- `rds-connection`: All middleware needed to connect to RDS securly 
- `logging`: logging middlewares
- `s3-event`: middleware for S3 events
- `sqs-event`: middleware for SQS events

## Benchmark.js Suite

```shell
npm run rollup
EXAMPLE={example} npm run test:benchmark
```

## Clinic.js

```shell
EXAMPLE={example} npm run test:doctor
EXAMPLE={example} npm run test:flame 
EXAMPLE={example} npm run test:bubbleprof
```
