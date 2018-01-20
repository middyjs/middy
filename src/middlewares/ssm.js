let ssmInstance

module.exports = (opts) => {
  const defaults = {
    awsSdkOptions: {
      maxRetries: 6, // lowers a chance to hit service rate limits, default is 3
      retryDelayOptions: {base: 200}
    },
    params: {},
    setToContext: false
  }

  const options = Object.assign({}, defaults, opts)

  return ({
    before (handler) {
      const targetParamsObject = getTargetObjectToAssign(handler, options)
      const ssmParamNames = getSSMParamNames(options.params)

      lazilyLoadSSMInstance(options.awsSdkOptions)

      return getSSMParams(ssmParamNames)
        .then(ssmResponse => {
          assignSSMParamsToTarget(targetParamsObject, options.params, ssmResponse)
        })
    }
  })
}

function getTargetObjectToAssign (handler, options) {
  if (options.setToContext) {
    return handler.context
  }

  return process.env
}

function getSSMParamNames (userParamsMap) {
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

  if (ssmInstance) {
    return ssmInstance
  }

  // AWS Lambda has aws-sdk included version 2.176.0
  // see https://docs.aws.amazon.com/lambda/latest/dg/current-supported-versions.html
  const {SSM} = require('aws-sdk')
  ssmInstance = new SSM(awsSdkOptions)
}

/**
 * Get array of SSM params using aws-sdk
 * @throws {Error} When any invalid parameters found in response
 * @param {String[]} ssmParamNames Array of param names to fetch
 * @return {Promise.<Object[]>} Array of SSM params from aws-sdk
 */
function getSSMParams (ssmParamNames) {
  // prevents throwing error from aws-sdk when empty params passed
  if (!ssmParamNames.length) {
    return Promise.resolve([])
  }

  return ssmInstance.getParameters({Names: ssmParamNames, WithDecryption: true})
    .promise()
    .then(({Parameters, InvalidParameters}) => {
      if (InvalidParameters && InvalidParameters.length) {
        throw new Error(`InvalidParameters present: ${InvalidParameters.join(', ')}`)
      }

      return Parameters
    })
}

/**
 * Assigns params from SSM response to target object using names from middleware options
 * @param {Object} paramsTarget Target object to assign params to
 * @param {Object} userParamsMap Options from middleware defining param names
 * @param {Object[]} ssmResponse Array of params returned from SSM by aws-sdk
 */
function assignSSMParamsToTarget (paramsTarget, userParamsMap, ssmResponse) {
  const paramsToAttach = getParamsToAssign(userParamsMap, ssmResponse)

  Object.assign(paramsTarget, paramsToAttach)
}

/**
 * Get object of user param names as keys and SSM param values as value
 * @param {Object} userParamsMap Params object from middleware options
 * @param {Object[]} ssmParams Array of parameters from SSM returned by aws-sdk
 * @return {Object} Merged object for assignment to target object
 */
function getParamsToAssign (userParamsMap, ssmParams) {
  const ssmToUserParamsMap = invertObject(userParamsMap)
  const targetObject = {}

  for (let {Name: ssmParamName, Value: ssmParamValue} of ssmParams) {
    const userParamName = ssmToUserParamsMap[ssmParamName]

    targetObject[userParamName] = ssmParamValue
  }

  return targetObject
}

function invertObject (obj) {
  const invertedObject = {}

  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      invertedObject[obj[key]] = key
    }
  }

  return invertedObject
}
