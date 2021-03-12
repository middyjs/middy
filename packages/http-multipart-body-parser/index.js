const BusBoy = require('busboy')
const contentTypeLib = require('content-type')
const createError = require('http-errors')

const httpMultipartBodyParserMiddleware = (opts = {}) => {
  const defaults = {
    // busboy options as per documentation: https://www.npmjs.com/package/busboy#busboy-methods
    busboy: {}
  }

  const options = { ...defaults, ...opts }

  const httpMultipartBodyParserMiddlewareBefore = async (request) => {
    const { headers } = request.event
    if (!headers) {
      return
    }

    const contentType = headers?.['Content-Type'] ?? headers?.['content-type']
    if (contentType) {
      const { type } = contentTypeLib.parse(contentType)
      if (type !== 'multipart/form-data') {
        return
      }

      return parseMultipartData(request.event, options.busboy)
        .then((multipartData) => {
          request.event.body = multipartData
        })
        .catch((_) => {
          throw new createError.UnprocessableEntity(
            'Invalid or malformed multipart/form-data was provided'
          )
        })
    }
  }

  return {
    before: httpMultipartBodyParserMiddlewareBefore
  }
}

const parseMultipartData = (event, options) => {
  const multipartData = {}
  const bb = BusBoy({ ...options, headers: event.headers })

  return new Promise((resolve, reject) => {
    bb.on('file', (fieldname, file, filename, encoding, mimetype) => {
      const attachment = {
        filename,
        mimetype,
        encoding
      }

      const chunks = []

      file.on('data', (data) => {
        chunks.push(data)
      })
      file.on('end', () => {
        attachment.truncated = file.truncated
        attachment.content = Buffer.concat(chunks)
        multipartData[fieldname] = attachment
      })
    })
      .on('field', (fieldname, value) => {
        const matches = fieldname.match(/(.+)\[(.*)]$/)
        if (!matches) {
          multipartData[fieldname] = value
        } else {
          if (!multipartData[matches[1]]) {
            multipartData[matches[1]] = []
          }
          multipartData[matches[1]].push(value)
        }
      })
      .on('finish', () => resolve(multipartData))
      .on('error', (err) => reject(err))

    bb.write(event.body, event.isBase64Encoded ? 'base64' : 'binary')
    bb.end()
  })
}
module.exports = httpMultipartBodyParserMiddleware
