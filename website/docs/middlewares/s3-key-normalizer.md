---
title: s3-key-normalizer
---

Normalizes key names in s3 events.

S3 events like S3 PUT and S3 DELETE will contain in the event a list of the files
that were affected by the change.

In this list the file keys are encoded [in a very peculiar way](http://docs.aws.amazon.com/AmazonS3/latest/dev/notification-content-structure.html) (urlencoded and
space characters replaced by a `+`). Very often you will use the
key directly to perform operations on the file using the AWS S3 SDK, in which case it's very easy to forget to decode the key correctly.

This middleware, once attached, makes sure that every S3 event has the file keys
properly normalized.


## Install

To install this middleware you can use NPM:

```bash
npm install --save @middy/s3-key-normalizer
```


## Options

This middleware does not have any option


## Sample usage

```javascript
import middy from '@middy/core'
import s3KeyNormalizer from '@middy/s3-key-normalizer'

const handler = middy((event, context) => {
  // use the event key directly without decoding it
  console.log(event.Records[0].s3.object.key)

  // return all the keys
  return event.Records.map(record => record.s3.object.key)
})

handler
  .use(s3KeyNormalizer())
```
