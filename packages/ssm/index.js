const SSM = require('aws-sdk/clients/ssm')
const STS = require('aws-sdk/clients/sts')
const SESSION_NAME_PREFIX = 'middy-ssm-session-'
let ssmInstance
let stsInstance

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

  const assumeRoleOptionsDefaults = {
    RoleSessionName: SESSION_NAME_PREFIX + new Date().getTime()
  }

  const options = Object.assign({}, defaults, opts)

  return {
    before: async (handler, next) => {
      if (!shouldFetchFromParamStore(options)) {
        if (options.paramsCache) {
          const targetParamsObject = getTargetObjectToAssign(handler, options)
          options.paramsCache.forEach(object => {
            Object.assign(targetParamsObject, object)
          })
        }
        return next()
      }

      if (shouldAssumeRole(options)) {
        stsInstance = stsInstance || new STS(options.stsOptions.awsSdkOptions)
        const assumedRole = await stsInstance.assumeRole(
          {
            ...assumeRoleOptionsDefaults,
            ...options.stsOptions.assumeRoleOptions
          }).promise()

        ssmInstance = new SSM(
          {
            credentials: {
              accessKeyId: assumedRole.Credentials.AccessKeyId,
              secretAccessKey: assumedRole.Credentials.SecretAccessKey,
              sessionToken: assumedRole.Credentials.SessionToken
            },
            ...options.awsSdkOptions
          })
      } else {
        ssmInstance = ssmInstance || new SSM(options.awsSdkOptions)
      }

      const ssmPromises = fetchFromParamStore(ssmInstance, options)

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

const fetchFromParamStore = (ssm, options) => {
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
    const ssmPromise = ssm
      .getParameters({ Names: ssmParamNames, WithDecryption: true })
      .promise()
      .then(handleInvalidParams)
      .then(ssmResponse =>
        getParamsToAssignByName(options.names, ssmResponse)
      )
    ssmPromises.push(ssmPromise)
  }

  return ssmPromises
}

const shouldAssumeRole = ({ stsOptions }) => {
  return stsOptions && stsOptions.assumeRoleOptions
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
