import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import { terser } from 'rollup-plugin-terser'

function onwarn(warning, warn) {
  if (warning.code === 'CIRCULAR_DEPENDENCY') return
  warn(warning)
}

export default [
  {
    input: 'examples/test.js'
  },
  {
    input: 'examples/baseline.js'
  },
  {
    input: 'examples/s3-event.js'
  },
  {
    input: 'examples/sqs-event.js'
  }
].map((bundle) => ({
  input: bundle.input,
  output: {
    dir: 'examples',
    entryFileNames: '[name].min.js',
    format: 'cjs'
  },
  plugins: [
    resolve(),
    commonjs(),
    terser({
      output: {
        comments: false
      },
      compress: {
        ecma: 2020,
        keep_fargs: false,
        passes: 25
      }
    })
  ],
  onwarn
}))
