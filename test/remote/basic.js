/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

var test = require('tap').test
var restify = require('restify')
var TestServer = require('../test_server')
var pkg = require('../../package.json')
var config = require('../../config.js')

var cfg = {
  port: 8000
}
var testServer = new TestServer(cfg)

test(
  'startup',
  function (t) {
    testServer.start(function (err) {
      t.type(testServer.server, 'object', 'test server was started')
      t.equal(err, null, 'no errors were returned')
      t.end()
    })
  }
)

var client = restify.createJsonClient({
  url: 'http://127.0.0.1:' + cfg.port
});

test(
  'top level info',
  function (t) {
    client.get('/',
      function (err, req, res, obj) {
        t.equal(res.statusCode, 200, 'returns a 200')
        t.equal(obj.version, pkg.version, 'Version reported is the same a package.json')
        t.equal(obj.patchLevel, config.patchLevel, 'Patch level is the same as the one set in config')
        t.deepEqual(obj, { version : pkg.version, patchLevel : config.patchLevel }, 'Object contains no other fields')
        t.end()
      }
    )
  }
)

test(
  'heartbeat',
  function (t) {
    client.get('/__heartbeat__',
      function (err, req, res, obj) {
        console.log('obj:', obj)
        t.deepEqual(obj, {}, 'Heartbeat contains an empty object and nothing unexpected')
        t.end()
      }
    )
  }
)

test(
  'teardown',
  function (t) {
    testServer.stop()
    t.equal(testServer.server.killed, true, 'test server has been killed')
    t.end()
  }
)
