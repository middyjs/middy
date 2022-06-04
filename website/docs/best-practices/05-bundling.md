---
title: Bundling Lambda packages
sidebar_position: 5
---

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
        - aws-sdk/clients/***.js
  esbuild: # for esbuild
    exclude: ["aws-sdk/clients/***.js"]
```
