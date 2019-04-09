const BusBoy = require('busboy')
const contentTypeLib = require('content-type')
const createError = require('http-errors')

const middleware = () => ({
  before: (handler, next) => {
    const { headers } = handler.event
    if (!headers) {
      return next()
    }

    const contentType = headers['content-type']
    if (contentType) {
      const { type } = contentTypeLib.parse(contentType)
      if (type !== 'multipart/form-data') {
        return next()
      }

      return parseMultipartData(handler.event)
        .then(multipartData => { handler.event.body = multipartData })
        .catch(_ => {
          throw new createError.UnprocessableEntity('Invalid or malformed multipart/form-data was provided.')
        })
    } else {
      return next()
    }
  }
})

const parseMultipartData = (event) => {
  let multipartData = {}
  const bb = BusBoy({ headers: event.headers })

  return new Promise((resolve, reject) => {
    bb
      .on('file', (fieldname, file, filename, encoding, mimetype) => {
        let attachment = {
          filename,
          mimetype,
          encoding
        }

        const chunks = []
        let chunklen = 0

        file.on('data', data => {
          chunks.push(data)
          chunklen += data.length
        })
        file.on('end', () => {
          attachment.content = Buffer.concat(chunks, chunklen)
          multipartData[fieldname] = attachment
        })
      })
      .on('field', (fieldname, value) => { multipartData[fieldname] = value })
      .on('finish', () => resolve(multipartData))
      .on('error', err => reject(err))

    bb.write(event.body, event.isBase64Encoded ? 'base64' : 'binary')
    bb.end()
  })
}

module.exports = {
  middleware,
  parseMultipartData
}
