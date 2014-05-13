/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

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
            t.ok(account.createdAt)
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
