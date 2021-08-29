const test = require('ava')
const sinon = require('sinon')
const rewire = require('rewire')
const middy = require('../../core/index.js')
const S3 = require('aws-sdk/clients/s3.js') // v2
// const { S3 } = require('@aws-sdk/client-s3') // v3
const s3DownloadRecord = rewire('../index.js')

/**
 * @type {sinon.SinonSandbox}
 */
const sandbox = sinon.createSandbox()

/**
 * @param {typeof S3} client
 * @param {Array<String>} responses
 */
const mockService = (client, responses) => {
  // aws-sdk v2
  const mock = sandbox.stub()
  responses.forEach((value, index) => {
    mock.onCall(index).returns({
      promise: () => Promise.resolve({
        Body: value
      })
    })
  })
  client.prototype.getObject = mock
  // aws-sdk v3
  // const mock = sandbox.stub(client.prototype, 'writeGetObjectResponse')
  // mock.onFirstCall().resolves(responseOne)
  // if (responseTwo) mock.onSecondCall().resolves(responseTwo)

  return mock
}

const mockFs = {
  promises: {
    filesWritten: {},
    async writeFile (path, data) {
      this.filesWritten[path] = data
    }
  }
}

/**
 * @type {import('aws-lambda').S3Event}
 */
const event = {
  Records: [
    {
      s3: {
        object: {
          key: 'obj1'
        },
        bucket: {
          name: 'bucket1'
        }
      }
    }
  ]
}

mockService(S3, [
  'obj1Response1'
])
s3DownloadRecord.__set__('fs', mockFs)
test.serial('It should download the first object along with default name', async (t) => {
  const handler = middy((event, context) => {
    t.true(mockFs.promises.filesWritten['/tmp/bucket1/obj1'] === 'obj1Response1')
  })

  handler.use(
    s3DownloadRecord({
      AwsClient: S3
    })
  )

  await handler(event)
})
