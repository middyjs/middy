import { compile, ftl } from 'ajv-cmd'

const ajvDefaults = {
  strict: true,
  coerceTypes: 'array', // important for query string params
  allErrors: true,
  useDefaults: 'empty',
  messages: true // needs to be true to allow multi-locale errorMessage to work
}

// This is pulled out due to it's performance cost (50-100ms on cold start)
// Precompile your schema during a build step is recommended.
export const transpileSchema = (schema, ajvOptions) => {
  const options = { ...ajvDefaults, ...ajvOptions }
  return compile(schema, options)
}

export const transpileLocale = ftl
