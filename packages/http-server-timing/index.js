const defaults = {
  setToContext: false
}
export default (opts = {}) => {
  const options = Object.assign({}, defaults, opts)

  let tags
  let starts
  let durations
  let descriptions

  const init = () => {
    tags = []
    starts = {}
    durations = {}
    descriptions = {}
  }

  const tag = (id) => {
    tags.push(id)
  }

  const start = (id) => {
    starts[id] = Date.now()
  }

  const stop = (id, desc = null) => {
    if (!durations[id]) dur(id, 0)
    const end = Date.now()
    dur(id, durations[id] + end - starts[id])
    descriptions[id] = desc ? `desc="${desc.replace(/"/g, '')}";` : ''
  }

  const dur = (id, ms) => {
    durations[id] = ms
  }

  const httpServerTimingsMiddlewareBefore = async (handler) => {
    init()
    start('total')
    const serverTiming = { tag, start, stop }
    Object.assign(handler.internal, { serverTiming })
    if (options.setToContext) Object.assign(handler.context, { serverTiming })
  }

  const httpServerTimingsMiddlewareAfter = async (handler) => {
    stop('total')
    handler.response = handler.response || {}
    handler.response.headers = handler.response.headers || {}
    handler.response.headers['Server-Timing'] =
      tags.join(', ') +
      (tags.length ? ', ' : '') +
      Object.keys(durations)
        .map((id) => {
          return `${id};${descriptions[id]}dur=${durations[id]}`
        })
        .join(', ')
  }

  return {
    before: httpServerTimingsMiddlewareBefore,
    after: httpServerTimingsMiddlewareAfter,
    // Allow hooks outside of context (ie profiler)
    start,
    stop,
    dur
  }
}
