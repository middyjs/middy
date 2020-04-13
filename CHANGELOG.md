# 1.0.0

Checkout [`UPGRADE.md`](/UPGRADE.md) to see what are the main breaking changes and how to migrate to this new version if coming from `0.x`.

Main changes:

 - Publishing core and every single middleware as independent package under the `@middy` namespace ([@lmammino](https://github.com/lmammino))
 - HttpHeaderNormalizer middleware now uses lowercase names ([@miki79](https://github.com/miki79), [@lmammino](https://github.com/lmammino))
 - Various improvements and bug fixes in SSM ([@theburningmonk](https://github.com/theburningmonk), [@dbartholomae](https://github.com/dbartholomae), [@hollg](https://github.com/hollg))
 - `http-cors` middleware now supports multiple origins or possibility to configure response origin with a function ([@thejuan](https://github.com/thejuan))
 - Added `input-output-logger` middleware ([@kevinrambaud](https://github.com/kevinrambaud))
 - Added `error-logger` middleware ([@lmammino](https://github.com/lmammino))
 - Added `http-security-headers` middleware ([@willfarrell](https://github.com/willfarrell), [@ChristianMurphy](https://github.com/ChristianMurphy))
 - Added `secrets-manager` middleware ([@theburningmonk](https://github.com/theburningmonk), [@sdomagala](https://github.com/sdomagala))
 - Added `http-response-serializer` middleware ([@noetix](https://github.com/noetix), [@lmammino](https://github.com/lmammino))
 - Added `db-manager` middleware ([@sdomagala](https://github.com/sdomagala), [@lmammino](https://github.com/lmammino))
 - Added `http-urlencode-path-parser` middleware ([@willfarrell](https://github.com/willfarrell))
 - Added `http-multipart-body-parser` middleware ([@TeddyHandleman](https://github.com/TeddyHandleman), [@willfarrell](https://github.com/willfarrell))
 - `handler.use()` can now receive multiple middlewares ([@alexdebrie](https://github.com/alexdebrie), [@vladgolubev](https://github.com/vladgolubev))
 - Added support for `reviver` parameter in `http-json-body-parser` middleware ([@roni-frantchi](https://github.com/roni-frantchi))
 - Improved compatibility between `warmup` and `do-not-wait-for-empty-event-loop` middlewares ([@lbertenasco](https://github.com/lbertenasco), [@lmammino](https://github.com/lmammino))
 - Added pre-commit lint hooks ([@ChristianMurphy](https://github.com/ChristianMurphy))
 - Using v2.0 of S3 events ([@lmammino](https://github.com/lmammino), [@kenleytomlin](https://github.com/kenleytomlin))
 - Various minor bug fixes ([@shroomist](https://github.com/shroomist), [@gsingh1](https://github.com/gsingh1), [@niik](https://github.com/niik), [@lmammino](https://github.com/lmammino), [@noetix](https://github.com/noetix), [@sheepsteak](https://github.com/sheepsteak), [@duro](https://github.com/duro), [@willfarrell](https://github.com/willfarrell))
 - Various documentation improvements ([@rafaelrenanpacheco](https://github.com/rafaelrenanpacheco), [@vladgolubev](https://github.com/vladgolubev), [@lmammino](https://github.com/lmammino), [@dbartholomae](https://github.com/dbartholomae), [@ndeitch](https://github.com/ndeitch), [@CathyC93](https://github.com/CathyC93))
 - Tests are now rewritten using Async/Await ([@vladgolubev](https://github.com/vladgolubev), [@lmammino](https://github.com/lmammino))
 - Better compatibility with Wallaby for running tests in development mode ([@vladgolubev](https://github.com/vladgolubev))
 - Improved (and documented!) release process ([@lmammino](https://github.com/lmammino))
 - Removed support for Node.js 8 and earlier versions ([@willfarrell](https://github.com/willfarrell), [@lmammino](https://github.com/lmammino))
