let ssmInstance

module.exports = opts => {
  const defaults = {
    awsSdkOptions: {
      maxRetries: 6, // lowers a chance to hit service rate limits, default is 3
      retryDelayOptions: { base: 200 }
    },
    onChange: undefined,
    paths: {},
    names: {},
    getParamNameFromPath: getParamNameFromPathDefault,
    setToContext: false,
    cache: false,
    cacheExpiryInMillis: undefined,
    paramsLoaded: false,
    paramsCache: undefined,
    paramsLoadedAt: new Date(0)
  }

  const options = Object.assign({}, defaults, opts)

  return {
    before: (handler, next) => {
      if (!shouldFetchFromParamStore(options)) {
        if (options.paramsCache) {
          const targetParamsObject = getTargetObjectToAssign(handler, options)
          options.paramsCache.forEach(object => {
            Object.assign(targetParamsObject, object)
          })
        }

        return next()
      }

      ssmInstance = ssmInstance || getSSMInstance(options.awsSdkOptions)

      const ssmPromises = Object.keys(options.paths).reduce(
        (aggregator, prefix) => {
          const pathsData = options.paths[prefix]
          const paths = Array.isArray(pathsData) ? pathsData : [pathsData]
          return paths.reduce((subAggregator, path) => {
            subAggregator.push(
              getParamsByPathRecursively(path).then(ssmResponse =>
                getParamsToAssignByPath(
                  path,
                  ssmResponse,
                  prefix,
                  options.getParamNameFromPath
                )
              )
            )

            return subAggregator
          }, aggregator)
        },
        []
      )
      const ssmParamNames = getSSMParamValues(options.names)
      if (ssmParamNames.length) {
        const ssmPromise = ssmInstance
          .getParameters({ Names: ssmParamNames, WithDecryption: true })
          .promise()
          .then(handleInvalidParams)
          .then(ssmResponse =>
            getParamsToAssignByName(options.names, ssmResponse)
          )
        ssmPromises.push(ssmPromise)
      }

      return Promise.all(ssmPromises).then(objectsToMap => {
        const targetParamsObject = getTargetObjectToAssign(handler, options)
        objectsToMap.forEach(object => {
          Object.assign(targetParamsObject, object)
        })

        if (typeof options.onChange === 'function') {
          options.onChange()
        }
        options.paramsLoaded = true
        options.paramsCache = objectsToMap
        options.paramsLoadedAt = new Date()
      })
    }
  }
}

const shouldFetchFromParamStore = ({
  paramsLoaded,
  paramsLoadedAt,
  cache,
  cacheExpiryInMillis
}) => {
  // if caching is OFF, or we haven't loaded anything yet, then definitely load it from SSM
  if (!cache || !paramsLoaded) {
    return true
  }

  // if caching is ON, and cache expiration is ON, and enough time has passed, then also load it from SSM
  const now = new Date()
  const millisSinceLastLoad = now.getTime() - paramsLoadedAt.getTime()
  if (cacheExpiryInMillis && millisSinceLastLoad > cacheExpiryInMillis) {
    return true
  }

  // otherwise, don't bother
  return false
}

const getParamsByPathRecursively = (path, nextToken) => {
  return ssmInstance
    .getParametersByPath({
      Path: path,
      NextToken: nextToken,
      Recursive: true,
      WithDecryption: true
    })
    .promise()
    .then(paramsResponse => {
      const additionalParamsPromise = paramsResponse.NextToken
        ? getParamsByPathRecursively(path, paramsResponse.NextToken)
        : Promise.resolve([])

      return additionalParamsPromise.then(additionalParams => [
        ...paramsResponse.Parameters,
        ...additionalParams
      ])
    })
}

// returns full parameter name sans the path as specified, with slashes replaced with underscores and any prefix applied
// everything gets upper cased
// e.g. if path is '/dev/myApi/', the parameter '/dev/myApi/connString/default' will be returned with the name 'CONNSTRING_DEFAULT'
// see: https://docs.aws.amazon.com/systems-manager/latest/userguide/sysman-paramstore-su-organize.html
const getParamNameFromPathDefault = (path, name, prefix) => {
  const localName = name
    .split(`${path}/`)
    .join('') // replace path
    .split('/')
    .join('_') // replace remaining slashes with underscores

  const fullLocalName = prefix ? `${prefix}_${localName}` : localName

  return fullLocalName.toUpperCase()
}

const getTargetObjectToAssign = (handler, options) =>
  options.setToContext ? handler.context : process.env

const getSSMParamValues = userParamsMap =>
  [...new Set(Object.keys(userParamsMap).map(key => userParamsMap[key]))]

/**
 * Lazily load aws-sdk and initialize SSM constructor
 * to avoid performance penalties for those who doesn't use
 * this middleware. Sets ssmInstance var at the top of the module
 * or returns if it's already initialized
 * @param {Object} awsSdkOptions Options to use to initialize aws sdk constructor
 */
const getSSMInstance = awsSdkOptions => {
  // lazy load aws-sdk and SSM constructor to avoid performance
  // penalties if you don't use this middleware

  // AWS Lambda has aws-sdk included version 2.176.0
  // see https://docs.aws.amazon.com/lambda/latest/dg/current-supported-versions.html
  const { SSM } = require('aws-sdk')
  return new SSM(awsSdkOptions)
}

/**
 * Throw error if SSM returns an error because we asked for params that don't exist
 * @throws {Error} When any invalid parameters found in response
 * @param {Function} getter Function that returns a promise which resolves with the params returned from ssm
 * @return {Promise.<Object[]>} Array of SSM params from aws-sdk
 */
const handleInvalidParams = ({ Parameters, InvalidParameters }) => {
  if (InvalidParameters && InvalidParameters.length) {
    throw new Error(
      `InvalidParameters present: ${InvalidParameters.join(', ')}`
    )
  }

  return Parameters
}

/**
 * Get object of user param names as keys and SSM param values as value
 * @param {Object} userParamsMap Params object from middleware options
 * @param {Object[]} ssmParams Array of parameters from SSM returned by aws-sdk
 * @return {Object} Merged object for assignment to target object
 */
const getParamsToAssignByName = (userParamsMap, ssmParams) => {
  return Object.keys(userParamsMap).reduce((acc, key) => {
    acc[key] = ssmParams.find(param => param.Name === userParamsMap[key]).Value
    return acc
  }, {})
}

/**
 * Get object of user param names as keys and SSM param values as value
 * @param {String} userParamsPath Path string from middleware options
 * @param {Object[]} ssmParams Array of parameters from SSM returned by aws-sdk
 * @param {String} prefix String to prefix to param values from a given path
 * @param {Function} nameMapper function to build the local name for a param based on path, prefix, and name in SSM
 * @return {Object} Merged object for assignment to target object
 */
const getParamsToAssignByPath = (
  userParamsPath,
  ssmParams,
  prefix,
  nameMapper
) =>
  ssmParams.reduce((aggregator, ssmParam) => {
    aggregator[nameMapper(userParamsPath, ssmParam.Name, prefix)] =
      ssmParam.Value
    return aggregator
  }, {})
