Firefox Accounts DB Server
==========================

[![Build Status](https://travis-ci.org/mozilla/fxa-auth-db-server.svg?branch=master)](https://travis-ci.org/mozilla/fxa-auth-db-server)

## Usage

```js
var createServer = require('fxa-auth-db-server')
var database = require('./db') // An object the implements the DB API described below

var server = createServer(db)

server.listen(8080, 'localhost')

server.on(
  'success',
  function (data) {
    console.log('+ %s %s took %dms', data.method, data.url, data.t)
  }
)

server.on(
  'failure',
  function (data) {
    console.warn('- %s %s failed with %d', data.method, data.url, data.err.code)
  }
)
```

## DB API

(todo)

## License

MPL 2.0
