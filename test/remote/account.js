/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

var uuid = require('uuid')
var restify = require('restify')
var test = require('tap').test

var fake = require('../fake.js')
var TestServer = require('../test_server')
var pkg = require('../../package.json')
var config = require('../../config.js')
var clientThen = require('../client-then.js')

var cfg = {
  port: 8000
}
var testServer = new TestServer(cfg)
var client = clientThen({ url : 'http://127.0.0.1:' + cfg.port })

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

function respOk(t, r) {
  t.equal(r.res.statusCode, 200, 'returns a 200')
  t.equal(r.res.headers['content-type'], 'application/json', 'json is returned')
}

function respOkEmpty(t, r) {
  t.equal(r.res.statusCode, 200, 'returns a 200')
  t.equal(r.res.headers['content-type'], 'application/json', 'json is returned')
  t.deepEqual(r.obj, {}, 'Returned object is empty')
}

function testNotFound(t, err) {
  t.equal(err.statusCode, 404, 'returns a 404')
  t.deepEqual(err.body, { message : 'Not Found' }, 'Object contains no other fields')
}

test(
  'account not found',
  function (t) {
    t.plan(2)
    client.getThen('/account/hello-world')
      .then(function(r) {
        t.fail('This request should have failed (instead it suceeded)')
        t.end()
      }, function(err) {
        testNotFound(t, err)
        t.end()
      })
  }
)

test(
  'add account, retrieve it, delete it',
  function (t) {
    t.plan(31)
    var user = fake.newUserDataHex()
    client.putThen('/account/' + user.accountId, user.account)
      .then(function(r) {
        respOkEmpty(t, r)
        return client.getThen('/account/' + user.accountId)
      })
      .then(function(r) {
        respOk(t, r)

        var account = r.obj
        var fields = 'accountId,email,emailCode,kA,verifierVersion,verifyHash,authSalt'.split(',')
        fields.forEach(function(f) {
          t.equal(user.account[f], account[f], 'Both Fields ' + f + ' are the same')
        })
        t.equal(user.account.emailVerified, !!account.emailVerified, 'Both fields emailVerified are the same')
      }, function(err) {
        t.fail('Error for some reason:' + err)
      })
      .then(function() {
        return client.headThen('/emailRecord/' + Buffer(user.account.email).toString('hex'))
      })
      .then(function(r) {
        respOkEmpty(t, r)
        return client.getThen('/emailRecord/' + Buffer(user.account.email).toString('hex'))
      })
      .then(function(r) {
        respOk(t, r)
        var account = r.obj
        var fields = 'accountId,email,emailCode,kA,verifierVersion,verifyHash,authSalt'.split(',')
        fields.forEach(function(f) {
          t.equal(user.account[f], account[f], 'Both Fields ' + f + ' are the same')
        })
        t.equal(user.account.emailVerified, !!account.emailVerified, 'Both fields emailVerified are the same')
      })
      .then(function() {
        return client.delThen('/account/' + user.accountId)
      })
      .then(function(r) {
        respOk(t, r)
        // now make sure this record no longer exists
        return client.headThen('/emailRecord/' + Buffer(user.account.email).toString('hex'))
      })
      .then(function(r) {
        t.fail('Should not be here, since this account no longer exists')
      }, function(err) {
        t.equal(err.toString(), 'NotFoundError', 'Account not found (no body due to being a HEAD request')
        t.deepEqual(err.body, {}, 'Body contains nothing since this is a HEAD request')
        t.deepEqual(err.statusCode, 404, 'Status Code is 404')
      })
      .done(function() {
        t.end()
      }, function(err) {
        t.fail(err)
        t.end()
      })
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
