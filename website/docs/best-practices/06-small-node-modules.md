---
title: Small node_modules
sidebar_position: 6
---

Using a bundler is the optimal solution, but can be complex depending on your setup.

In this case you should remove excess files from your `node_modules` directory to ensure it doesn't have anything excess shipped to AWS.

We put together a `.yarnclean` file you can check out and use as part of your CI/CD process:


```git title=".yarnclean"
# -- Middy.js --

# Dependencies
**/ajv/lib
**/ajv/.runkit_examples.js
**/ajv-errors/src
**/ajv-formats/src
**/@silverbucket/ajv-formats-draft2019/.github
**/@silverbucket/ajv-formats-draft2019/.prettierrc.js
**/@silverbucket/ajv-formats-draft2019/index.test.js
**/@silverbucket/ajv-i18n/localize/.eslintrc.yml
**/json-mask/bin
**/json-mask/build
**/qs/.github
**/qs/dist
**/qs/test
**/qs/.editorconfig
**/qs/.eslintrc
**/qs/.nycrc
**/qs/CHANGELOG.md

# DevDependencies
**/@types
**/@serverless/event-mocks

## Sub[/Sub] Dependencies
**/bowser/src
**/bowser/bundled.js
**/dicer/bench
**/dicer/test
**/inherits/inherits_browser.js
**/json-schema-traverse/.github
**/json-schema-traverse/spec
**/fast-deep-equal/es6
**/fast-deep-equal/react.js
**/querystring/test
**/react-native-get-random-values/android
**/react-native-get-random-values/ios
**/react-native-get-random-values/index.web.js
**/react-native-get-random-values/react-native-get-random-values.podspec
**/setprototypeof/test
**/tslib
**/uri-js/dist/esnext
**/url/.zuul.yml
**/url/test.js
**/uuid/bin

# Builds
*.ts
tsconfig.json
*.js.map
package-lock.json
yarn.lock
.travis.yml

# Common
.bin
.cache
.editorconfig
.eslintignore
.eslintrc
.eslintrc.yml
.gitattributes
.npmignore
AUTHORS
LICENSE
*.md
*.txt
```
