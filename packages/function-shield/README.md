# Middy FunctionShield middleware

<div align="center">
  <img alt="Middy logo" src="https://raw.githubusercontent.com/middyjs/middy/master/img/middy-logo.png"/>
</div>

<div align="center">
  <p><strong>FunctionShield middleware for the middy framework, the stylish Node.js middleware engine for AWS Lambda</strong></p>
</div>

<div align="center">
<p>
  <a href="http://badge.fury.io/js/%40middy%2Ffunction-shield">
    <img src="https://badge.fury.io/js/%40middy%2Ffunction-shield.svg" alt="npm version" style="max-width:100%;">
  </a>
  <a href="https://snyk.io/test/github/middyjs/middy">
    <img src="https://snyk.io/test/github/middyjs/middy/badge.svg" alt="Known Vulnerabilities" data-canonical-src="https://snyk.io/test/github/middyjs/middy" style="max-width:100%;">
  </a>
  <a href="https://standardjs.com/">
    <img src="https://img.shields.io/badge/code_style-standard-brightgreen.svg" alt="Standard Code Style"  style="max-width:100%;">
  </a>
  <a href="https://greenkeeper.io/">
    <img src="https://badges.greenkeeper.io/middyjs/middy.svg" alt="Greenkeeper badge"  style="max-width:100%;">
  </a>
  <a href="https://gitter.im/middyjs/Lobby">
    <img src="https://badges.gitter.im/gitterHQ/gitter.svg" alt="Chat on Gitter"  style="max-width:100%;">
  </a>
</p>
</div>

Hardens AWS Lambda execution environment:
* By monitoring (or blocking) outbound network traffic to public internet, you can be certain that your data is never leaked (traffic to AWS services is not affected)
* By disabling read/write operations on the /tmp/ directory, you make sure that files are not persisted across invocations. Storing data in `/tmp` is a bad practice as it may be leaked in subsequent invocations
* By disabling the ability to launch child processes, you can make sure that no rogue processes are spawned without your knowledge by potentially malicious packages
* By disabling the ability to read the function's (handler) source code through the file system, you can prevent handler source code leakage, which is oftentimes the first step in a serverless attack 

More info:
* https://www.puresec.io/function-shield
* https://www.jeremydaly.com/serverless-security-with-functionshield/

## Get a free token

Please visit: https://www.puresec.io/function-shield-token-form

### Modes

- `'block'` - Block and log to Cloudwatch Logs
- `'alert'` - Allow and log to Cloudwatch Logs
- `'allow'` - Allow

### Options


- `policy.outbound_connectivity` - `'block'/'alert'/'allow'` (default: `'block'`)
- `policy.read_write_tmp` - `'block'/'alert'/'allow'` (default: `'block'`)
- `policy.create_child_process` - `'block'/'alert'/'allow'` (default: `'block'`)
- `policy.read_handler` - `'block'/'alert'/'allow'` (default: `'block'`)
- `token` - By default looks for `FUNCTION_SHIELD_TOKEN` in `process.env` and `context`
- `disable_analytics` - Periodically, during cold starts, FunctionShield sends basic analytics information to its backend. To disable analytics module set: `true`. (default: `false`)

### Sample Usage

```javascript
'use strict';

const fs = require('fs');
const middy = require('middy');
const {ssm, functionShield} = require('middy/middlewares');

async function hello(event) {
  fs.openSync('/tmp/test', 'w');
}


const handler = middy(hello)
  .use(ssm({
    cache: true,
    setToContext: true,
    names: {
      FUNCTION_SHIELD_TOKEN: 'function_shield_token'
    }
  }))
  .use(functionShield(
    {
      policy: {
        outbound_connectivity: 'alert'
      }
    }
  ));

module.exports = {
  handler
};
```

```
START RequestId: f7b7305d-d785-11e8-baf1-9136b5c7aa75 Version: $LATEST
[TOKEN VERIFICATION] license is OK
{"function_shield":true,"policy":"read_write_tmp","details":{"path":"/tmp/test"},"mode":"block"}
2018-10-24 15:11:45.427 (+03:00)        f7b7305d-d785-11e8-baf1-9136b5c7aa75    {"errorMessage":"Unknown system error -999: Unknown system error -999, open '/tmp/test'","errorType":"Error","stackTrace":["Object.fs.openSync (fs.js:646:18)","Function.hello (/var/task/handler.js:8:6)","runMiddlewares (/var/task/node_modules/middy/src/middy.js:180:42)","runNext (/var/task/node_modules/middy/src/middy.js:85:14)","before (/var/task/node_modules/middy/src/middlewares/functionShield.js:20:5)","runNext (/var/task/node_modules/middy/src/middy.js:70:24)","<anonymous>","process._tickDomainCallback (internal/process/next_tick.js:228:7)"]}
END RequestId: f7b7305d-d785-11e8-baf1-9136b5c7aa75
REPORT RequestId: f7b7305d-d785-11e8-baf1-9136b5c7aa75  Duration: 458.65 ms     Billed Duration: 500 ms         Memory Size: 1024 MB    Max Memory Used: 38 MB  
```

## Middy documentation and examples

For more documentation and examples, refers to the main [Middy monorepo on GitHub](https://github.com/middyjs/middy) or [Middy official website](https://middy.js.org).


## Contributing

Everyone is very welcome to contribute to this repository. Feel free to [raise issues](https://github.com/middyjs/middy/issues) or to [submit Pull Requests](https://github.com/middyjs/middy/pulls).


## License

Licensed under [MIT License](LICENSE). Copyright (c) 2017-2018 Luciano Mammino and the [Middy team](https://github.com/middyjs/middy/graphs/contributors).

<a href="https://app.fossa.io/projects/git%2Bgithub.com%2Fmiddyjs%2Fmiddy?ref=badge_large">
  <img src="https://app.fossa.io/api/projects/git%2Bgithub.com%2Fmiddyjs%2Fmiddy.svg?type=large" alt="FOSSA Status"  style="max-width:100%;">
</a>
