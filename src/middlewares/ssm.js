let ssmInstance

module.exports = (opts) => {
  const defaults = {
    awsSdkOptions: {
      maxRetries: 6, // lowers a chance to hit service rate limits, default is 3
      retryDelayOptions: {base: 200}
    },
    params: {},
    setToEnv: true,
    setToContext: false
  }

  const options = Object.assign({}, defaults, opts)

  return ({
    before (handler) {
      const paramsTarget = getParamsTargetToAttach(handler, options)
      const ssmParamNames = getSSMParamNames(options.params)

      lazilyLoadSSMInstance(options.awsSdkOptions)

      return getSSMParams(ssmParamNames)
        .then(ssmResponse => {
          const paramsToAttach = getParamsToAttach(options.params, ssmResponse)

          Object.assign(paramsTarget, paramsToAttach)
        })
    }
  })
}

function getSSMParamNames (paramsMap) {
  return Object.keys(paramsMap).map(key => paramsMap[key])
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

function getParamsTargetToAttach (handler, options) {
  if (options.setToContext) {
    return handler.context
  }

  if (handler.setToEnv) {
    return process.env
  }

  return process.env
}

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

function getParamsToAttach (userParamsMap, ssmResponse) {
  const ssmToUserParamsMap = invertObject(userParamsMap)
  const targetObject = {}

  for (let {Name: ssmParamName, Value: ssmParamValue} of ssmResponse) {
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
