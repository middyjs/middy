// ** Not supported at this time ** //

// Mock out event
const event = {
  "Records": [
    {
      "eventID": "1",
      "eventVersion": "1.0",
      "dynamodb": {
        "Keys": {
          "Id": {
            "N": "101"
          }
        },
        "NewImage": {
          "Message": {
            "S": "New item!"
          },
          "Id": {
            "N": "101"
          }
        },
        "StreamViewType": "NEW_AND_OLD_IMAGES",
        "SequenceNumber": "111",
        "SizeBytes": 26
      },
      "awsRegion": "us-west-2",
      "eventName": "INSERT",
      "eventSourceARN": "eventsourcearn",
      "eventSource": "aws:dynamodb"
    },
    {
      "eventID": "2",
      "eventVersion": "1.0",
      "dynamodb": {
        "OldImage": {
          "Message": {
            "S": "New item!"
          },
          "Id": {
            "N": "101"
          }
        },
        "SequenceNumber": "222",
        "Keys": {
          "Id": {
            "N": "101"
          }
        },
        "SizeBytes": 59,
        "NewImage": {
          "Message": {
            "S": "This item has changed"
          },
          "Id": {
            "N": "101"
          }
        },
        "StreamViewType": "NEW_AND_OLD_IMAGES"
      },
      "awsRegion": "us-west-2",
      "eventName": "MODIFY",
      "eventSourceARN": "sourcearn",
      "eventSource": "aws:dynamodb"
    }
  ]
}

/**
 * Trigger Lambda from DynamoDB Event
 * https://docs.aws.amazon.com/lambda/latest/dg/with-ddb.html
 **/
const middy = require('@middy/core')
// const dynamodbNormalizerMiddleware = require('@middy/dynamodb-normalizer') // convert nested structure to more useful json, see s3-key-normalizer

const handler = middy(() => {})
//  .use(dynamodbNormalizerMiddleware())

module.exports = { handler, event }
