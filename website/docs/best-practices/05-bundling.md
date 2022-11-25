---
title: Bundling Lambda packages
sidebar_position: 5
---

:::caution

This page is a work in progress. If you want to help us to make this page better, please consider contributing on GitHub.

:::

Lambda runtime already includes `aws-sdk` by default and as such you normally don't need to package it in your function.

## Compilers

### typescript

```bash
npm i -D typescript
node_modules/.bin/tsc
```

#### tsconfig.json

```json
{
  "compilerOptions": {
    "baseUrl": "./",
    "esModuleInterop": true,
    "preserveConstEnums": true,
    "strictNullChecks": true,
    "allowJs": false,
    "target": "es2021",
    "typeRoots": ["node_modules/@types"],
    "resolveJsonModule": true,
    "moduleResolution": "node"
  }
}
```

## Bundlers

### esbuild

```bash
npm i -D esbuild

# --banner:js hack from https://github.com/evanw/esbuild/pull/2067
node_modules/.bin/esbuild index.js \
    --platform=node --format=esm  --target=node18 --bundle --minify \
    --banner:js="import { createRequire } from 'module';const require = createRequire(import.meta.url);" \
    --legal-comments=external --sourcemap=external \
    --allow-overwrite --outfile=index.mjs

```

### rollup

```bash
npm i -D rollup @rollup/plugin-node-resolve @rollup/plugin-commonjs
node_modules/.bin/rollup --config
```

#### rollup.config.mjs

```javascript
import { nodeResolve } from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'

const plugins = [nodeResolve({ preferBuiltins: true }), commonjs()]

export default (input) => ({
  input: 'index.js',
  output: {
    file: 'index.bundle.rollup.mjs',
    format: 'es' // cjs, es
  },
  plugins,
  external: [
    // AWS SDK
    '@aws-sdk/client-apigatewaymanagementapi', // @middy/ws-response
    '@aws-sdk/client-rds', // @middy/rds-signer
    '@aws-sdk/client-s3', // @middy/s3-object-response
    '@aws-sdk/client-secretsmanager', // @middy/sercrets-manager
    '@aws-sdk/client-servicediscovery', // @middy/service-discovery
    '@aws-sdk/client-ssm', // @middy/ssm
    '@aws-sdk/client-sts' // @middy/sts
  ]
})
```

### swc/pack

```bash
npm i -D @swc/cli @swc/core
node_modules/.bin/spack
```

:::caution

Incomplete

:::

### webpack

```bash
npm i -D webpack-cli webpack
node_modules/.bin/webpack
```

#### webpack.config.mjs

```javascript
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default {
  mode: 'development',
  entry: './index.js',
  output: {
    filename: 'index.bundle.webpack.mjs',
    path: __dirname
  },
  experiments: {
    outputModule: true
  },
  externals: [
    // NodeJS modules
    'events', // @middy/core
    'https', // @middy/s3-object-response
    'stream', // @middy/http-content-encoding @middy/s3-object-response
    'util', // @middy/http-content-encoding
    'zlib', // @middy/http-content-encoding
    // AWS SDK
    '@aws-sdk/client-apigatewaymanagementapi', // @middy/ws-response
    '@aws-sdk/client-rds', // @middy/rds-signer
    '@aws-sdk/client-s3', // @middy/s3-object-response
    '@aws-sdk/client-secretsmanager', // @middy/sercrets-manager
    '@aws-sdk/client-servicediscovery', // @middy/service-discovery
    '@aws-sdk/client-ssm', // @middy/ssm
    '@aws-sdk/client-sts' // @middy/sts
  ]
}
```

## Transpilers

### babel

```bash
npm i -D @babel/cli @babel/core @babel/preset-env
node_modules/.bin/babel index.js --out-file index.transpile.babel.cjs
```

#### babel.config.json

```json
{
  "presets": [
    [
      "@babel/preset-env",
      {
        "targets": {
          "node": "16"
        }
      }
    ]
  ]
}
```

### esbuild

```bash
npm i -D esbuild
node_modules/.bin/esbuild --platform=node --target=node16 --format=cjs index.js --outfile=index.cjs
```

### swc

```bash
npm i -D @swc/cli @swc/core
node_modules/.bin/swc index.js --out-file index.transpile.swc.cjs
```

#### .swcrc

```json
{
  "jsc": {
    "parser": {
      "syntax": "ecmascript"
    },
    "target": "es2021"
  },
  "module": {
    "type": "commonjs"
  }
}
```
