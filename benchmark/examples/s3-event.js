// Mock out event
const event = {
  Records: [
    {
      eventVersion: '2.2',
      eventSource: 'aws:s3',
      awsRegion: 'us-west-2',
      eventTime:
        'The time, in ISO-8601 format, for example, 1970-01-01T00:00:00.000Z, when Amazon S3 finished processing the request',
      eventName: 'event-type',
      userIdentity: {
        principalId: 'Amazon-customer-ID-of-the-user-who-caused-the-event'
      },
      requestParameters: {
        sourceIPAddress: 'ip-address-where-request-came-from'
      },
      responseElements: {
        'x-amz-request-id': 'Amazon S3 generated request ID',
        'x-amz-id-2': 'Amazon S3 host that processed the request'
      },
      s3: {
        s3SchemaVersion: '1.0',
        configurationId: 'ID found in the bucket notification configuration',
        bucket: {
          name: 'bucket-name',
          ownerIdentity: {
            principalId: 'Amazon-customer-ID-of-the-bucket-owner'
          },
          arn: 'bucket-ARN'
        },
        object: {
          key: 'object-key',
          size: 'object-size',
          eTag: 'object eTag',
          versionId:
            'object version if bucket is versioning-enabled, otherwise null',
          sequencer:
            'a string representation of a hexadecimal value used to determine event sequence, only used with PUTs and DELETEs'
        }
      },
      glacierEventData: {
        restoreEventData: {
          lifecycleRestorationExpiryTime:
            'The time, in ISO-8601 format, for example, 1970-01-01T00:00:00.000Z, of Restore Expiry',
          lifecycleRestoreStorageClass: 'Source storage class for restore'
        }
      }
    }
  ]
}

/**
 * Trigger Lambda from S3 Event Notification
 * https://docs.aws.amazon.com/AmazonS3/latest/userguide/NotificationHowTo.html
 * https://docs.aws.amazon.com/lambda/latest/dg/with-s3.html
 **/
const middy = require('@middy/core')
const s3KeyNormalizerMiddleware = require('@middy/s3-key-normalizer')

const handler = middy(() => {}).use(s3KeyNormalizerMiddleware())

module.exports = { handler, event }
