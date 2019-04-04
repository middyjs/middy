const BusBoy = require('busboy')
const contentTypeLib = require('content-type')
const createError = require('http-errors')

module.exports = () => ({
  before: async (handler, next) => {
    const { headers } = handler.event
    if (!headers) {
      return next()
    }

    const contentType = headers['Content-Type'] || headers['content-type']
    if (contentType) {
      const { type } = contentTypeLib.parse(contentType)
      if (type === 'multipart/form-data') {
        try {
          handler.event.body = await parseMultipartData(handler.event)
        } catch (err) {
          throw new createError.UnprocessableEntity('Invalid or malformed multipart/form-data was provided.')
        }
      }
    }
  }
})

const parseMultipartData = async (event) => {
  let multipartData = {}
  let bb = BusBoy({ headers: event.headers })

  return new Promise((resolve, reject) => {
    bb
      .on('file', (fieldname, file, filename, encoding, mimetype) => {
        let attachment = {
          filename,
          mimetype,
          encoding
        }

        file.on('data', data => { attachment.content = data })
        file.on('end', () => { multipartData[fieldname] = attachment })
      })
      .on('field', (fieldname, value) => {
        multipartData[fieldname] = value
      })
      .on('finish', _ => resolve(multipartData))
      .on('error', err => reject(err))

    bb.write(event.body, event.isBase64Encoded ? 'base64' : 'binary')
    bb.end()
  })
}
