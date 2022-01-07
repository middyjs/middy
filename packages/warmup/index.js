
const defaults = {
  isWarmingUp: (event) => (event?.source === 'serverless-plugin-warmup')
}

const warmupMiddleware = (opt) => {
  const options = { ...defaults, ...opt }

  const warmupMiddlewareBefore = (request) => {
    if (options.isWarmingUp(request.event)) {
      return 'warmup'
    }
  }

  return {
    before: warmupMiddlewareBefore
  }
}

export default warmupMiddleware
