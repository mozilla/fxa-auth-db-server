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

function hex32() {
  return Buffer(crypto.randomBytes(32).toString('hex'), 'hex')
}

function hex64() {
  return Buffer(crypto.randomBytes(64).toString('hex'), 'hex')
}

var SESSION_TOKEN_ID = hex32();
var SESSION_TOKEN = {
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
            .then(function(sessionToken) {
              // tokenId is not returned from db.sessionToken()
              t.deepEqual(sessionToken.tokenData, SESSION_TOKEN.data, 'token data matches')
              t.deepEqual(sessionToken.uid, ACCOUNT.uid)
              t.ok(sessionToken.createdAt, 'Got a createdAt')
              t.equal(sessionToken.emailVerified, ACCOUNT.emailVerified)
              t.equal(sessionToken.email, ACCOUNT.email)
              t.deepEqual(sessionToken.emailCode, ACCOUNT.emailCode)
              t.ok(sessionToken.verifierSetAt, 'verifierSetAt is set to a truthy value')
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
