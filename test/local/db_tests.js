/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var crypto = require('crypto')

require('ass')
var test = require('../ptaptest')
var uuid = require('uuid')
var error = require('../../error')
var config = require('../../config')
var log = { trace: console.log }
var DB = require('../../db/mysql')(log, error)

var zeroBuffer16 = Buffer('00000000000000000000000000000000', 'hex')
var zeroBuffer32 = Buffer('0000000000000000000000000000000000000000000000000000000000000000', 'hex')

var ACCOUNT = {
  uid: uuid.v4('binary'),
  email: ('' + Math.random()).substr(2) + '@bar.com',
  emailCode: zeroBuffer16,
  emailVerified: false,
  verifierVersion: 1,
  verifyHash: zeroBuffer32,
  authSalt: zeroBuffer32,
  kA: zeroBuffer32,
  wrapWrapKb: zeroBuffer32
}

function hex(len) {
  return Buffer(crypto.randomBytes(len).toString('hex'), 'hex')
}
function hex16() { return hex(16) }
function hex32() { return hex(32) }
function hex64() { return hex(64) }
function hex96() { return hex(96) }

var SESSION_TOKEN_ID = hex32()
var SESSION_TOKEN = {
  data : hex32(),
  uid : ACCOUNT.uid,
}

var KEY_FETCH_TOKEN_ID = hex32()
var KEY_FETCH_TOKEN = {
  authKey : hex32(),
  uid : ACCOUNT.uid,
  keyBundle : hex96(),
}

var PASSWORD_FORGOT_TOKEN_ID = hex32()
var PASSWORD_FORGOT_TOKEN = {
  data : hex32(),
  uid : ACCOUNT.uid,
  passCode : hex16(),
  tries : 1,
}

var PASSWORD_CHANGE_TOKEN_ID = hex32()
var PASSWORD_CHANGE_TOKEN = {
  data : hex32(),
  uid : ACCOUNT.uid,
}

DB.connect(config)
  .then(
    function (db) {

      test(
        'ping',
        function (t) {
          t.plan(1);
          return db.ping()
          .then(function(account) {
            t.pass('Got the ping ok')
          }, function(err) {
            t.fail('Should not have arrived here')
          })
        }
      )

      test(
        'account creation',
        function (t) {
          return db.createAccount(ACCOUNT.uid, ACCOUNT)
          .then(function(account) {
            t.deepEqual(account, {}, 'Returned an empty object on account creation')
            return db.accountExists(ACCOUNT.email)
          })
          .then(function(exists) {
            t.ok(exists, 'account exists for this email address')
          })
          .then(function() {
            t.pass('Retrieving account using uid')
            return db.account(ACCOUNT.uid)
          })
          .then(function(account) {
            t.deepEqual(account.uid, ACCOUNT.uid)
            t.equal(account.email, ACCOUNT.email)
            t.deepEqual(account.emailCode, ACCOUNT.emailCode)
            t.equal(account.emailVerified, ACCOUNT.emailVerified)
            t.deepEqual(account.kA, ACCOUNT.kA)
            t.deepEqual(account.wrapWrapKb, ACCOUNT.wrapWrapKb)
            t.deepEqual(account.verifyHash, ACCOUNT.verifyHash)
            t.deepEqual(account.authSalt, ACCOUNT.authSalt)
            t.equal(account.verifierVersion, ACCOUNT.verifierVersion)
            t.equal(account.verifierSetAt, account.createdAt, 'verifierSetAt has been set to the same as createdAt')
            t.ok(account.createdAt)
          })
          .then(function() {
            t.pass('Retrieving account using email')
            return db.emailRecord(ACCOUNT.email)
          })
          .then(function(account) {
            t.deepEqual(account.uid, ACCOUNT.uid)
            t.equal(account.email, ACCOUNT.email)
            t.deepEqual(account.emailCode, ACCOUNT.emailCode)
            t.equal(account.emailVerified, ACCOUNT.emailVerified)
            t.deepEqual(account.kA, ACCOUNT.kA)
            t.deepEqual(account.wrapWrapKb, ACCOUNT.wrapWrapKb)
            t.deepEqual(account.verifyHash, ACCOUNT.verifyHash)
            t.deepEqual(account.authSalt, ACCOUNT.authSalt)
            t.equal(account.verifierVersion, ACCOUNT.verifierVersion)
            t.equal(account.verifierSetAt, account.createdAt, 'verifierSetAt has been set to the same as createdAt')
            t.ok(account.createdAt)
          })
        }
      )

      test(
        'session token handling',
        function (t) {
          return db.createSessionToken(SESSION_TOKEN_ID, SESSION_TOKEN)
            .then(function(result) {
              t.deepEqual(result, {}, 'Returned an empty object on session token creation')
              return db.sessionToken(SESSION_TOKEN_ID)
            })
            .then(function(token) {
              // tokenId is not returned from db.sessionToken()
              t.deepEqual(token.tokenData, SESSION_TOKEN.data, 'token data matches')
              t.deepEqual(token.uid, ACCOUNT.uid, 'token belongs to this account')
              t.ok(token.createdAt, 'Got a createdAt')
              t.equal(token.emailVerified, ACCOUNT.emailVerified)
              t.equal(token.email, ACCOUNT.email)
              t.deepEqual(token.emailCode, ACCOUNT.emailCode)
              t.ok(token.verifierSetAt, 'verifierSetAt is set to a truthy value')
            })
            .then(function() {
              return db.deleteSessionToken(SESSION_TOKEN_ID)
            })
            .then(function(result) {
              t.deepEqual(result, {}, 'Returned an empty object on forgot key fetch token deletion')
              return db.sessionToken(SESSION_TOKEN_ID)
            })
            .then(function(token) {
              t.fail('Session Token should no longer exist')
            }, function(err) {
              t.pass('Session Token deleted successfully')
            })
        }
      )

      test(
        'key fetch token handling',
        function (t) {
          return db.createKeyFetchToken(KEY_FETCH_TOKEN_ID, KEY_FETCH_TOKEN)
            .then(function(result) {
              t.deepEqual(result, {}, 'Returned an empty object on key fetch token creation')
              return db.keyFetchToken(KEY_FETCH_TOKEN_ID)
            })
            .then(function(token) {
              // tokenId is not returned
              t.deepEqual(token.authKey, KEY_FETCH_TOKEN.authKey, 'authKey matches')
              t.deepEqual(token.uid, ACCOUNT.uid, 'token belongs to this account')
              t.ok(token.createdAt, 'Got a createdAt')
              t.equal(token.emailVerified, ACCOUNT.emailVerified)
              // email is not returned
              // emailCode is not returned
              t.ok(token.verifierSetAt, 'verifierSetAt is set to a truthy value')
            })
            .then(function() {
              return db.deleteKeyFetchToken(KEY_FETCH_TOKEN_ID)
            })
            .then(function(result) {
              t.deepEqual(result, {}, 'Returned an empty object on forgot key fetch token deletion')
              return db.keyFetchToken(KEY_FETCH_TOKEN_ID)
            })
            .then(function(token) {
              t.fail('Key Fetch Token should no longer exist')
            }, function(err) {
              t.pass('Key Fetch Token deleted successfully')
            })
        }
      )

      test(
        'forgot password token handling',
        function (t) {
          return db.createPasswordForgotToken(PASSWORD_FORGOT_TOKEN_ID, PASSWORD_FORGOT_TOKEN)
            .then(function(result) {
              t.deepEqual(result, {}, 'Returned an empty object on forgot password token creation')
              return db.passwordForgotToken(PASSWORD_FORGOT_TOKEN_ID)
            })
            .then(function(token) {
              // tokenId is not returned
              t.deepEqual(token.tokenData, PASSWORD_FORGOT_TOKEN.data, 'token data matches')
              t.deepEqual(token.uid, ACCOUNT.uid, 'token belongs to this account')
              t.ok(token.createdAt, 'Got a createdAt')
              t.deepEqual(token.passCode, PASSWORD_FORGOT_TOKEN.passCode)
              t.equal(token.tries, PASSWORD_FORGOT_TOKEN.tries, 'Tries is correct')
              t.equal(token.email, ACCOUNT.email)
              t.ok(token.verifierSetAt, 'verifierSetAt is set to a truthy value')
            })
            .then(function() {
              return db.deletePasswordForgotToken(PASSWORD_FORGOT_TOKEN_ID)
            })
            .then(function(result) {
              t.deepEqual(result, {}, 'Returned an empty object on forgot password token deletion')
              return db.passwordForgotToken(PASSWORD_FORGOT_TOKEN_ID)
            })
            .then(function(token) {
              t.fail('Password Forgot Token should no longer exist')
            }, function(err) {
              t.pass('Password Forgot Token deleted successfully')
            })
        }
      )

      test(
        'change password token handling',
        function (t) {
          return db.createPasswordChangeToken(PASSWORD_CHANGE_TOKEN_ID, PASSWORD_CHANGE_TOKEN)
            .then(function(result) {
              t.deepEqual(result, {}, 'Returned an empty object on change password token creation')
              return db.passwordChangeToken(PASSWORD_CHANGE_TOKEN_ID)
            })
            .then(function(token) {
              // tokenId is not returned
              t.deepEqual(token.tokenData, PASSWORD_CHANGE_TOKEN.data, 'token data matches')
              t.deepEqual(token.uid, ACCOUNT.uid, 'token belongs to this account')
              t.ok(token.createdAt, 'Got a createdAt')
              t.ok(token.verifierSetAt, 'verifierSetAt is set to a truthy value')
            })
            .then(function() {
              return db.deletePasswordChangeToken(PASSWORD_CHANGE_TOKEN_ID)
            })
            .then(function(result) {
              t.deepEqual(result, {}, 'Returned an empty object on forgot password change deletion')
              return db.passwordChangeToken(PASSWORD_CHANGE_TOKEN_ID)
            })
            .then(function(token) {
              t.fail('Password Change Token should no longer exist')
            }, function(err) {
              t.pass('Password Change Token deleted successfully')
            })
        }
      )

      test(
        'email verification',
        function (t) {
          return db.emailRecord(ACCOUNT.email)
          .then(function(emailRecord) {
            return db.verifyEmail(emailRecord.uid)
          })
          .then(function() {
            return db.account(ACCOUNT.uid)
          })
          .then(function(account) {
            t.ok(account.emailVerified, 'account should now be emailVerified')
          })
        }
      )

      test(
        'teardown',
        function (t) {
          return db.close()
        }
      )

    }
  )
