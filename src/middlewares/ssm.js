let ssmInstance

module.exports = opts => {
  const defaults = {
    awsSdkOptions: {
      maxRetries: 6, // lowers a chance to hit service rate limits, default is 3
      retryDelayOptions: { base: 200 }
    },
    params: {},
    usePaths: false,
    getParamNameFromPath: getParamNameFromPathDefault,
    setToContext: false,
    cache: false
  }

  const options = Object.assign({}, defaults, opts)

  return {
    before: (handler, next) => {
      const targetParamsObject = getTargetObjectToAssign(handler, options)
      const stillCached = areParamsStillCached(options, targetParamsObject)

      if (stillCached) return next()

      lazilyLoadSSMInstance(options.awsSdkOptions)

      const ssmParamValues = getSSMParamValues(options.params)

      if (!ssmParamValues.length) return Promise.resolve()

      if (!options.usePaths) {
        return ssmInstance
          .getParameters({ Names: ssmParamValues, WithDecryption: true })
          .promise()
          .then(getSSMParams)
          .then(ssmResponse => getParamsToAssignByName(options.params, ssmResponse))
          .then(paramsToAssign => Object.assign(targetParamsObject, paramsToAssign))
      }

      const paramArrays = Object.keys(options.params).map(prefix => {
        const path = options.params[prefix]
        return ssmInstance
          .getParametersByPath({ Path: path, Recursive: true, WithDecryption: true })
          .promise()
          .then(getSSMParams)
          .then(ssmResponse => getParamsToAssignByPath(path, ssmResponse, prefix, options.getParamNameFromPath))
          .then(paramsToAssign => Object.assign(targetParamsObject, paramsToAssign))
      })

      return Promise.all(paramArrays).then(() => {})
    }
  }
}

// returns full parameter name sans the path as specified, with slashes replaced with underscores
// e.g. if path is '/dev/myApi/', the parameter '/dev/myApi/connString/default' will be returned with the name 'conString_default'
// see: https://docs.aws.amazon.com/systems-manager/latest/userguide/sysman-paramstore-su-organize.html
function getParamNameFromPathDefault (path, name, prefix) {
  const localName = name
    .split(`${path}/`)
    .join(``) // replace path
    .split(`/`)
    .join(`_`) // replace remaining slashes with underscores

  const fullLocalName = prefix
    ? `${prefix}_${localName}`
    : localName

  return fullLocalName.toUpperCase()
}

function getTargetObjectToAssign (handler, options) {
  if (options.setToContext) return handler.context

  return process.env
}

function areParamsStillCached (options, targetParamsObject) {
  if (!options.cache) return false

  return !Object.keys(options.params).some(p => typeof targetParamsObject[p] === 'undefined')
}

function getSSMParamValues (userParamsMap) {
  return Object.keys(userParamsMap).map(key => userParamsMap[key])
}

/**
 * Lazily load aws-sdk and initialize SSM constructor
 * to avoid performance penalties for those who doesn't use
 * this middleware. Sets ssmInstance var at the top of the module
 * or returns if it's already initialized
 * @param {Object} awsSdkOptions Options to use to initialize aws sdk constructor
 */
function lazilyLoadSSMInstance (awsSdkOptions) {
  // lazy load aws-sdk and SSM constructor to avoid performance
  // penalties if you don't use this middleware

  if (ssmInstance) return ssmInstance

  // AWS Lambda has aws-sdk included version 2.176.0
  // see https://docs.aws.amazon.com/lambda/latest/dg/current-supported-versions.html
  const { SSM } = require('aws-sdk')
  ssmInstance = new SSM(awsSdkOptions)
}

/**
 * Get array of SSM params using aws-sdk
 * @throws {Error} When any invalid parameters found in response
 * @param {Function} getter Function that returns a promise which resolves with the params returned from ssm
 * @return {Promise.<Object[]>} Array of SSM params from aws-sdk
 */
function getSSMParams ({ Parameters, InvalidParameters }) {
  if (InvalidParameters && InvalidParameters.length) {
    throw new Error(`InvalidParameters present: ${InvalidParameters.join(', ')}`)
  }

  return Parameters
}

/**
 * Get object of user param names as keys and SSM param values as value
 * @param {Object} userParamsMap Params object from middleware options
 * @param {Object[]} ssmParams Array of parameters from SSM returned by aws-sdk
 * @return {Object} Merged object for assignment to target object
 */
function getParamsToAssignByName (userParamsMap, ssmParams) {
  const ssmToUserParamsMap = invertObject(userParamsMap)

  return ssmParams.reduce((aggregator, ssmParam) => {
    aggregator[ssmToUserParamsMap[ssmParam.Name]] = ssmParam.Value
    return aggregator
  }, {})
}

/**
 * Get object of user param names as keys and SSM param values as value
 * @param {String} userParamsPath Path string from middleware options
 * @param {Object[]} ssmParams Array of parameters from SSM returned by aws-sdk
 * @return {Object} Merged object for assignment to target object
 */
function getParamsToAssignByPath (userParamsPath, ssmParams, prefix, nameMapper) {
  return ssmParams.reduce((aggregator, ssmParam) => {
    aggregator[nameMapper(userParamsPath, ssmParam.Name, prefix)] = ssmParam.Value
    return aggregator
  }, {})
}

function invertObject (obj) {
  return Object.keys(obj).reduce((aggregator, key) => {
    aggregator[obj[key]] = key
    return aggregator
  }, {})
}
