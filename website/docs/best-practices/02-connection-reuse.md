---
title: Connection reuse
sidebar_position: 2
---

Be sure to set the following environment variable when connecting to AWS services:

```plain
AWS_NODEJS_CONNECTION_REUSE_ENABLED=1
```

This allows you to reuse the first connection established across lambda invocations.

See [Reusing Connections with Keep-Alive in Node.js](https://docs.aws.amazon.com/sdk-for-javascript/v2/developer-guide/node-reusing-connections.html)
