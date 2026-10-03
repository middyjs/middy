---
title: IoT Events
description: "Use Middy with AWS IoT Events Lambda action events."
---

<script>
import Callout from '@design-system/components/Callout.svelte'
</script>

<Callout data-theme="warn">This page is a work in progress. If you want to help us to make this page better, please consider contributing on GitHub.
</Callout>

<Callout data-theme="warn">
AWS ended support for AWS IoT Events on May 20, 2026. The console and IoT Events resources are no longer accessible. Move detector logic to <a href="https://docs.aws.amazon.com/iot/latest/developerguide/iot-rules.html">AWS IoT Core rules</a>. See <a href="https://docs.aws.amazon.com/iotevents/latest/developerguide/doc-history.html">AWS IoT Events document history</a>.
</Callout>

## AWS Documentation
- [Using AWS Lambda with AWS IoT Events](https://docs.aws.amazon.com/lambda/latest/dg/services-iotevents.html)

## Example
```javascript
import middy from '@middy/core'

export const handler = middy()
  .handler((event, context, {signal}) => {
    // ...
  })
```
