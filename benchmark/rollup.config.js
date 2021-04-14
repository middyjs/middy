import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import json from '@rollup/plugin-json'
import { terser } from 'rollup-plugin-terser'

const onwarn = (warning, warn) => {
  if (warning.code === 'CIRCULAR_DEPENDENCY') return
  warn(warning)
}

export default [
  {
    input: 'examples/baseline.js'
  }
  // {
  //   input: 'examples/s3-event.js'
  // },
  // {
  //   input: 'examples/sqs-event.js'
  // }
].map((bundle) => ({
  input: bundle.input,
  output: {
    dir: 'examples',
    entryFileNames: '[name].min.js',
    format: 'cjs'
  },
  plugins: [
    json(),
    resolve(),
    commonjs(),
    terser({
      output: {
        comments: false
      },
      compress: {
        ecma: 2020,
        keep_fargs: false,
        passes: 5
      }
    })
  ],
  onwarn
}))
