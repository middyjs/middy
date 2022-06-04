---
title: Bundling Lambda packages
sidebar_position: 5
---

:::caution

This page is a work in progress. If you want to help us to make this page better, please consider contributing on GitHub.

:::

## Transpilers
### babel
```bash
npm i -D @babel/cli @babel/core @babel/preset-env
node_modules/.bin/babel index.js --out-file index.babel.cjs
```

#### babel.config.json
```json
{
  "presets": [
    [
      "@babel/preset-env",
      {
        "targets": {
          "node": "14"
        }
      }
    ]
  ]
}
```

### esbuild
```bash
npm i -D esbuild
node_modules/.bin/esbuild --platform=node --target=es2020 index.js --outfile=index.esbuild.cjs
```

### swc
```bash
npm i -D @swc/cli @swc/core
node_modules/.bin/swc --config-file swc.config.json index.js --out-file index.swc.cjs
```

#### swc.config.json
```json
{
  "jsc": {
    "parser": {
      "syntax": "ecmascript"
    },
    "target": "es2020"
  },
  "module": {
    "type": "commonjs"
  }
}
```

## Bundlers
### esbuild
```bash
npm i -D esbuild
node_modules/.bin/esbuild --platform=node --target=es2020 index.js --bundle --outfile=index.esbuild.cjs
```

### rollup
```bash
npm i -D rollup
```

#### rollup.config.js
```javascript
import { readdirSync } from 'node:fs'

const handlers = readdirSync('./handlers')
  .filter((dir) => !dir.match(/\.zip$/))
  .filter((dir) => dir !== '.DS_Store')

const plugins = []

export default handlers.map((input) => ({
  input: 'handlers/' + input + '/index.js',
  output: {
    file: 'handlers/' + input + '/index.cjs',
    format: 'cjs' // cjs, es
  },
  plugins,
  external: [
    'aws-sdk/clients/cloudfront.js',
    'aws-sdk/clients/ssm.js',
    'aws-sdk/clients/sts.js',
    'aws-sdk/clients/dynamodb.js',
    'aws-sdk/clients/rds.js'
  ]
}))
```

### swc/pack
```bash
npm i -D @swc/cli @swc/core
node_modules/.bin/swc --config-file swc.config.json index.js --out-file index.swc.cjs
```

#### spack.config.js
```javascript
import { config } from '@swc/core/spack'

export default config({
  mode: 'production',
  entry: {
    'web': __dirname + '/index.js',
  },
  output: {
    path: __dirname
  },
  module: {
    type: 'commonjs'
  },
}, {
  "jsc": {
    "parser": {
      "syntax": "ecmascript"
    },
    "target": "es2020"
  },
  "module": {
    "type": "commonjs"
  }
})
```

### webpack
```bash
npm i -D webpack-cli webpack
node_modules/.bin/webpack --config webpack.config.js && node index.webpack.cjs
```

#### webpack.config.js
```javascript
module.exports = {
  "mode": "production",
  "entry": "./index.js",
  "output": {
    "filename": "index.webpack.cjs",
    "path": __dirname
  }
}
```

## Exclude `aws-sdk`
Lambda runtime already includes `aws-sdk` by default and as such you normally don't need to package it in your function. 
If you are using Webpack and Serverless Framework to package your code you'd want to add `aws-sdk` to Webpack `externals` and to `forceExclude` of Serverless Framework Webpack configuration.

1. Tell Webpack not to bundle `aws-sdk` into the output (e.g. handler.js):
```
# webpack.config.js
var nodeExternals = require("webpack-node-externals");
module.exports = {
  externals: ["aws-sdk/clients/***.js"],
};
```

2. Tell Serverless Framework not to include `aws-sdk` located in `node_modules` (because it was not bundled by Webpack):
```
# serverless.yml
custom:
  webpack: # for webpack
    includeModules:
      forceExclude:
        - aws-sdk/clients/*.js
  esbuild: # for esbuild
    exclude: ["aws-sdk/clients/__client_name__.js"]
```
