
export default () => {
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
    starts[id] = new Date()
  }

  const stop = (id, desc = null) => {
    if (!durations[id]) durations[id] = 0
    const end = new Date()
    durations[id] += end - starts[id]
    if (desc) descriptions[id] = desc
  }

  const httpServerTimingsMiddlewareBefore = async (handler) => {
    init()
    start('total')
    handler.context.serverTiming = { tag, start, stop }
  }

  const httpServerTimingsMiddlewareAfter = async (handler) => {
    stop('total')
    handler.response = handler.response || {}
    handler.response.headers = handler.response.headers || {}
    handler.response.headers['Server-Timing'] =
      tags.join(', ') +
      (tags.length ? ', ' : '') +
      Object.keys(durations)
        .map(
          (id) =>
            `${id};${
              descriptions[id]
                ? `desc="${descriptions[id].replace('"', '')}";`
                : ''
            }dur=${durations[id]}`
        )
        .join(', ')
  }

  return {
    before: httpServerTimingsMiddlewareBefore,
    after: httpServerTimingsMiddlewareAfter
  }
}
