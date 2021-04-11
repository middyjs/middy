// ** Not supported at this time. See #648 ** //

// Mock out event
const event = {
  Records: [
    {
      kinesis: {
        kinesisSchemaVersion: '1.0',
        partitionKey: '1',
        sequenceNumber: '49590338271490256608559692538361571095921575989136588898',
        data: 'SGVsbG8sIHRoaXMgaXMgYSB0ZXN0Lg==',
        approximateArrivalTimestamp: 1545084650.987
      },
      eventSource: 'aws:kinesis',
      eventVersion: '1.0',
      eventID: 'shardId-000000000006:49590338271490256608559692538361571095921575989136588898',
      eventName: 'aws:kinesis:record',
      invokeIdentityArn: 'arn:aws:iam::123456789012:role/lambda-role',
      awsRegion: 'us-east-2',
      eventSourceARN: 'arn:aws:kinesis:us-east-2:123456789012:stream/lambda-stream'
    },
    {
      kinesis: {
        kinesisSchemaVersion: '1.0',
        partitionKey: '1',
        sequenceNumber: '49590338271490256608559692540925702759324208523137515618',
        data: 'VGhpcyBpcyBvbmx5IGEgdGVzdC4=',
        approximateArrivalTimestamp: 1545084711.166
      },
      eventSource: 'aws:kinesis',
      eventVersion: '1.0',
      eventID: 'shardId-000000000006:49590338271490256608559692540925702759324208523137515618',
      eventName: 'aws:kinesis:record',
      invokeIdentityArn: 'arn:aws:iam::123456789012:role/lambda-role',
      awsRegion: 'us-east-2',
      eventSourceARN: 'arn:aws:kinesis:us-east-2:123456789012:stream/lambda-stream'
    }
  ]
}

/**
 * Trigger Lambda from Kinesis Stream
 * https://docs.aws.amazon.com/lambda/latest/dg/with-kinesis.html
 **/
const middy = require('@middy/core')
// const kinesisStreamJsonDataParserMiddleware = require('@middy/kinesis-stream-json-data-parser')

const handler = middy(() => {})
//  .use(kinesisStreamJsonDataParserMiddleware())

module.exports = { handler, event }
