const fs = require('fs');
const path = require('path');
const {
  canPrefetch,
  createPrefetchClient
} = require('@middy/util')

const S3 = require('aws-sdk/clients/s3') // v2
// const { S3 } = require('@aws-sdk/client-s3') // v3

/**
 * @type {import("./index").Options}
 */
const defaults = {
  AwsClient: S3,
  awsClientOptions: {},
  awsClientAssumeRole: undefined,
  awsClientCapture: undefined,
  disablePrefetch: false,
  directory: '/tmp',
  prefixBucketName: true
}

/**
 * 
 * @param {import("./index").Options} opts 
 * @returns {import("@middy/core").MiddlewareObj}
 */
const s3DownloadRecordsMiddleware = (opts = {}) => {
  const options = { ...defaults, ...opts }

  /**
   * @type {S3}
   */
  let client
  if (canPrefetch(options)) {
    client = createPrefetchClient(options)
  }
  /**
   * Downloads the S3 object to drive
   * @param {import("aws-lambda").S3EventRecord} record
   */
  async function download(record) {
    const obj = await client.getObject({
      Key: record.s3.object.key,
      Bucket: record.s3.bucket.name
    }).promise();
    await fs.promises.writeFile(path.join(
      ...[
        options.directory,
        options.prefixBucketName ? record.s3.bucket.name : '',
        record.s3.object.key
      ]
    // @ts-ignore
    ), obj.Body)
  }

  return {
    before: async (request) => {
      /**
       * @type {import("aws-lambda").S3Event}
       */
      await Promise.all(event.Records.map(record => {
        return download(record)
      }));
    }
  }
}
module.exports = s3DownloadRecordsMiddleware
