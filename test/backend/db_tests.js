/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

var test = require('../ptaptest')
var crypto = require('crypto')
var uuid = require('uuid')

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
  wrapWrapKb: zeroBuffer32,
  verifierSetAt: Date.now(),
  locale : 'en_US',
}

function hex(len) {
  return Buffer(crypto.randomBytes(len).toString('hex'), 'hex')
}
function hex16() { return hex(16) }
function hex32() { return hex(32) }
// function hex64() { return hex(64) }
function hex96() { return hex(96) }

var SESSION_TOKEN_ID = hex32()
var SESSION_TOKEN = {
  data : hex32(),
  uid : ACCOUNT.uid,
  createdAt: Date.now()
}

var KEY_FETCH_TOKEN_ID = hex32()
var KEY_FETCH_TOKEN = {
  authKey : hex32(),
  uid : ACCOUNT.uid,
  keyBundle : hex96(),
  createdAt: Date.now()
}

var PASSWORD_FORGOT_TOKEN_ID = hex32()
var PASSWORD_FORGOT_TOKEN = {
  data : hex32(),
  uid : ACCOUNT.uid,
  passCode : hex16(),
  tries : 1,
  createdAt: Date.now()
}

var PASSWORD_CHANGE_TOKEN_ID = hex32()
var PASSWORD_CHANGE_TOKEN = {
  data : hex32(),
  uid : ACCOUNT.uid,
  createdAt: Date.now()
}

var ACCOUNT_RESET_TOKEN_ID = hex32()
var ACCOUNT_RESET_TOKEN = {
  data : hex32(),
  uid : ACCOUNT.uid,
  createdAt: Date.now()
}

// To run these tests from a new backend, pass the config and an already created
// DB API for them to be run against.
module.exports = function(config, DB) {
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
            t.plan(32)
            var emailBuffer = Buffer(ACCOUNT.email)
            return db.accountExists(emailBuffer)
            .then(function(exists) {
              t.fail('account should not yet exist for this email address')
            }, function(err) {
              t.pass('ok, account could not be found')
            })
            .then(function() {
              return db.createAccount(ACCOUNT.uid, ACCOUNT)
            })
            .then(function(account) {
              t.deepEqual(account, {}, 'Returned an empty object on account creation')
              var emailBuffer = Buffer(ACCOUNT.email)
              return db.accountExists(emailBuffer)
            })
            .then(function(exists) {
              t.ok(exists, 'account exists for this email address')
            })
            .then(function() {
              t.pass('Retrieving account using uid')
              return db.account(ACCOUNT.uid)
            })
            .then(function(account) {
              t.deepEqual(account.uid, ACCOUNT.uid, 'uid')
              t.equal(account.email, ACCOUNT.email, 'email')
              t.deepEqual(account.emailCode, ACCOUNT.emailCode, 'emailCode')
              t.equal(!!account.emailVerified, ACCOUNT.emailVerified, 'emailVerified')
              t.deepEqual(account.kA, ACCOUNT.kA, 'kA')
              t.deepEqual(account.wrapWrapKb, ACCOUNT.wrapWrapKb, 'wrapWrapKb')
              t.deepEqual(account.verifyHash, ACCOUNT.verifyHash, 'verifyHash')
              t.deepEqual(account.authSalt, ACCOUNT.authSalt, 'authSalt')
              t.equal(account.verifierVersion, ACCOUNT.verifierVersion, 'verifierVersion')
              t.ok(account.createdAt, 'createdAt has been set (to something)')
              t.equal(account.verifierSetAt, account.createdAt, 'verifierSetAt has been set to the same as createdAt')
              t.equal(account.locale, ACCOUNT.locale, 'locale')
            })
            .then(function() {
              t.pass('Retrieving account using email')
              var emailBuffer = Buffer(ACCOUNT.email)
              return db.emailRecord(emailBuffer)
            })
            .then(function(account) {
              t.deepEqual(account.uid, ACCOUNT.uid, 'uid')
              t.equal(account.email, ACCOUNT.email, 'email')
              t.deepEqual(account.emailCode, ACCOUNT.emailCode, 'emailCode')
              t.equal(!!account.emailVerified, ACCOUNT.emailVerified, 'emailVerified')
              t.deepEqual(account.kA, ACCOUNT.kA, 'kA')
              t.deepEqual(account.wrapWrapKb, ACCOUNT.wrapWrapKb, 'wrapWrapKb')
              t.deepEqual(account.verifyHash, ACCOUNT.verifyHash, 'verifyHash')
              t.deepEqual(account.authSalt, ACCOUNT.authSalt, 'authSalt')
              t.equal(account.verifierVersion, ACCOUNT.verifierVersion, 'verifierVersion')
              t.ok(account.verifierSetAt, 'verifierSetAt is set to a truthy value')
              // locale not returned with .emailRecord() (unlike .account() when it is)
            })
            // and we piggyback some duplicate query error handling here...
            .then(function() {
              return db.createAccount(ACCOUNT.uid, ACCOUNT)
            })
            .then(
              function() {
                t.fail('this should have resulted in a duplicate account error')
              },
              function(err) {
                t.ok(err, 'trying to create the same account produces an error')
                t.equal(err.code, 409, 'error code')
                t.equal(err.errno, 101, 'error errno')
                t.equal(err.message, 'Record already exists', 'message')
                t.equal(err.error, 'Conflict', 'error')
              }
            )
          }
        )

        test(
          'session token handling',
          function (t) {
            t.plan(10)
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
                t.equal(!!token.emailVerified, ACCOUNT.emailVerified, 'token emailVerified is same as account emailVerified')
                t.equal(token.email, ACCOUNT.email, 'token email same as account email')
                t.deepEqual(token.emailCode, ACCOUNT.emailCode, 'token emailCode same as account emailCode')
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
            t.plan(8)
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
                t.equal(!!token.emailVerified, ACCOUNT.emailVerified)
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
            t.plan(25)

            var token
            var THROWAWAY_PASSWORD_FORGOT_TOKEN_ID = hex32()
            var THROWAWAY_PASSWORD_FORGOT_TOKEN = {
              data : hex32(),
              uid : ACCOUNT.uid, // same account uid
              passCode : hex16(),
              tries : 1,
              createdAt: Date.now()
            }

            return db.createPasswordForgotToken(PASSWORD_FORGOT_TOKEN_ID, PASSWORD_FORGOT_TOKEN)
              .then(function(result) {
                t.deepEqual(result, {}, 'Returned an empty object on forgot password token creation')
                return db.passwordForgotToken(PASSWORD_FORGOT_TOKEN_ID)
              })
              .then(function(newToken) {
                token = newToken
                // tokenId is not returned
                t.deepEqual(token.tokenData, PASSWORD_FORGOT_TOKEN.data, 'token data matches')
                t.deepEqual(token.uid, ACCOUNT.uid, 'token belongs to this account')
                t.ok(token.createdAt, 'Got a createdAt')
                t.deepEqual(token.passCode, PASSWORD_FORGOT_TOKEN.passCode, 'token passCode same')
                t.equal(token.tries, PASSWORD_FORGOT_TOKEN.tries, 'Tries is correct')
                t.equal(token.email, ACCOUNT.email, 'token email same as account email')
                t.ok(token.verifierSetAt, 'verifierSetAt is set to a truthy value')
              })
              .then(function() {
                return db.passwordForgotToken(PASSWORD_FORGOT_TOKEN_ID)
              })
              .then(function(newToken) {
                token = newToken
                // tokenId is not returned
                t.deepEqual(token.tokenData, PASSWORD_FORGOT_TOKEN.data, 'token data matches')
                t.deepEqual(token.uid, ACCOUNT.uid, 'token belongs to this account')
                t.ok(token.createdAt, 'Got a createdAt')
                t.deepEqual(token.passCode, PASSWORD_FORGOT_TOKEN.passCode, 'token passCode same')
                t.equal(token.tries, PASSWORD_FORGOT_TOKEN.tries, 'Tries is correct')
                t.equal(token.email, ACCOUNT.email, 'token email same as account email')
                t.ok(token.verifierSetAt, 'verifierSetAt is set to a truthy value')
              })
              .then(function() {
                // just update the tries
                token.tries = 9
                return db.updatePasswordForgotToken(PASSWORD_FORGOT_TOKEN_ID, token)
              })
              .then(function(result) {
                t.deepEqual(result, {}, 'The returned object from the token update is empty')
                // re-fetch the updated token
                return db.passwordForgotToken(PASSWORD_FORGOT_TOKEN_ID)
              })
              .then(function(newToken) {
                t.deepEqual(newToken.uid, ACCOUNT.uid, 'token belongs to this account')
                t.equal(newToken.tries, 9, 'token now has had 9 tries')
                return db.deletePasswordForgotToken(PASSWORD_FORGOT_TOKEN_ID)
              })
              .then(function(result) {
                t.deepEqual(result, {}, 'Returned an empty object on forgot password token deletion')
                return db.passwordForgotToken(PASSWORD_FORGOT_TOKEN_ID)
              })
              .then(function(newToken /* unused */) {
                t.fail('Password Forgot Token should no longer exist')
              }, function(err) {
                t.pass('Password Forgot Token deleted successfully')
              })
              .then(function() {
                // insert a throwaway token
                return db.createPasswordForgotToken(THROWAWAY_PASSWORD_FORGOT_TOKEN_ID, THROWAWAY_PASSWORD_FORGOT_TOKEN)
              })
              .then(function(result) {
                t.deepEqual(result, {}, 'Returned an empty object on forgot password token creation')
                // and we should be able to retrieve it as usual
                return db.passwordForgotToken(THROWAWAY_PASSWORD_FORGOT_TOKEN_ID)
              })
              .then(function(token) {
                // just check that the tokenData is what we expect (complete tests are above)
                t.deepEqual(token.tokenData, THROWAWAY_PASSWORD_FORGOT_TOKEN.data, 'token data matches')
                // now, let's insert a different passwordForgotToken with the same uid
                return db.createPasswordForgotToken(PASSWORD_FORGOT_TOKEN_ID, PASSWORD_FORGOT_TOKEN)
              })
              .then(function(result) {
                t.deepEqual(result, {}, 'Returned an empty object on forgot password token creation (when overwriting another)')
                // if we retrieve the throwaway one, we should fail
                return db.passwordForgotToken(THROWAWAY_PASSWORD_FORGOT_TOKEN_ID)
              })
              .then(function(newToken /* unused */) {
                t.fail('Throwaway Password Forgot Token should no longer exist')
              }, function(err) {
                t.pass('Throwaway Password Forgot Token deleted successfully')
                // but the new one is still there
                return db.passwordForgotToken(PASSWORD_FORGOT_TOKEN_ID)
              })
              .then(function(token) {
                // just check that the tokenData is what we expect (complete tests are above)
                t.deepEqual(token.tokenData, PASSWORD_FORGOT_TOKEN.data, 'token data matches')
              }, function(err) {
                t.fail('We should have been able to retrieve the new password forgot token')
              })
          }
        )

        test(
          'change password token handling',
          function (t) {
            t.plan(12)

            var THROWAWAY_PASSWORD_CHANGE_TOKEN_ID = hex32()
            var THROWAWAY_PASSWORD_CHANGE_TOKEN = {
              data : hex32(),
              uid : ACCOUNT.uid, // same account uid
              createdAt: Date.now()
            }

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
              .then(function() {
                // insert a throwaway token
                return db.createPasswordChangeToken(THROWAWAY_PASSWORD_CHANGE_TOKEN_ID, THROWAWAY_PASSWORD_CHANGE_TOKEN)
              })
              .then(function(result) {
                t.deepEqual(result, {}, 'Returned an empty object on change password token creation')
                // and we should be able to retrieve it as usual
                return db.passwordChangeToken(THROWAWAY_PASSWORD_CHANGE_TOKEN_ID)
              })
              .then(function(token) {
                // just check that the tokenData is what we expect (complete tests are above)
                t.deepEqual(token.tokenData, THROWAWAY_PASSWORD_CHANGE_TOKEN.data, 'token data matches')
                // now, let's insert a different passwordChangeToken with the same uid
                return db.createPasswordChangeToken(PASSWORD_CHANGE_TOKEN_ID, PASSWORD_CHANGE_TOKEN)
              })
              .then(function(result) {
                t.deepEqual(result, {}, 'Returned an empty object on change password token creation (when overwriting another)')
                // if we retrieve the throwaway one, we should fail
                return db.passwordChangeToken(THROWAWAY_PASSWORD_CHANGE_TOKEN_ID)
              })
              .then(function(newToken /* unused */) {
                t.fail('Throwaway Password Change Token should no longer exist')
              }, function(err) {
                t.pass('Throwaway Password Change Token deleted successfully')
                // but the new one is still there
                return db.passwordChangeToken(PASSWORD_CHANGE_TOKEN_ID)
              })
              .then(function(token) {
                // just check that the tokenData is what we expect (complete tests are above)
                t.deepEqual(token.tokenData, PASSWORD_CHANGE_TOKEN.data, 'token data matches')
              }, function(err) {
                t.fail('We should have been able to retrieve the new password change token')
              })
          }
        )

        test(
          'email verification and locale change',
          function (t) {
            t.plan(6)

            var emailBuffer = Buffer(ACCOUNT.email)
            return db.emailRecord(emailBuffer)
            .then(function(emailRecord) {
              return db.verifyEmail(emailRecord.uid)
            })
            .then(function(result) {
              t.deepEqual(result, {}, 'Returned an empty object email verification')
              return db.account(ACCOUNT.uid)
            })
            .then(function(account) {
              t.ok(account.emailVerified, 'account should now be emailVerified (truthy)')
              t.equal(account.emailVerified, 1, 'account should now be emailVerified (1)')

              account.locale = 'en_NZ'
              return db.updateLocale(ACCOUNT.uid, account)
            })
            .then(function(result) {
              t.deepEqual(result, {}, 'Returned an empty object for updateLocale')
              return db.account(ACCOUNT.uid)
            })
            .then(function(account) {
              t.equal(account.locale, 'en_NZ', 'account should now have new locale')

              // test verifyEmail for a non-existant account
              return db.verifyEmail(uuid.v4('binary'))
            })
            .then(function(res) {
              t.deepEqual(res, {}, 'No matter what happens, we get an empty object back')
            }, function(err) {
              t.fail('We should not have failed this .verifyEmail() request')
            })
          }
        )

        test(
          'account reset token handling',
          function (t) {
            t.plan(14)

            // create a second accountResetToken
            var accountResetTokenId = hex32()
            var accountResetToken = {
              data : hex32(),
              uid : ACCOUNT.uid,
              createdAt: Date.now()
            }

            return db.createAccountResetToken(ACCOUNT_RESET_TOKEN_ID, ACCOUNT_RESET_TOKEN)
              .then(function(result) {
                t.deepEqual(result, {}, 'Returned an empty object on account reset token creation')
                return db.accountResetToken(ACCOUNT_RESET_TOKEN_ID)
              })
              .then(function(token) {
                // tokenId is not returned
                t.deepEqual(token.uid, ACCOUNT.uid, 'token belongs to this account')
                t.deepEqual(token.tokenData, ACCOUNT_RESET_TOKEN.data, 'token data matches')
                t.ok(token.createdAt, 'Got a createdAt')
                t.ok(token.verifierSetAt, 'verifierSetAt is set to a truthy value')
              })
              .then(function() {
                return db.deleteAccountResetToken(ACCOUNT_RESET_TOKEN_ID)
              })
              .then(function(result) {
                t.deepEqual(result, {}, 'Returned an empty object on account reset deletion')
                return db.accountResetToken(ACCOUNT_RESET_TOKEN_ID)
              })
              .then(function(token) {
                t.fail('Account Reset Token should no longer exist')
              }, function(err) {
                t.pass('Account Reset Token deleted successfully')
              })
              .then(function() {
                // Now add back in the original token
                return db.createAccountResetToken(ACCOUNT_RESET_TOKEN_ID, ACCOUNT_RESET_TOKEN)
              })
              .then(function(result) {
                t.deepEqual(result, {}, 'Returned an empty object on account reset token creation (for the 2nd time)')
                // get this back out
                return db.accountResetToken(ACCOUNT_RESET_TOKEN_ID)
              })
              .then(function(token) {
                // tokenId is not returned
                t.deepEqual(token.uid, ACCOUNT.uid, 'token belongs to this account')
                t.deepEqual(token.tokenData, ACCOUNT_RESET_TOKEN.data, 'token data matches')
                // replace this token with a new one
                return db.createAccountResetToken(accountResetTokenId, accountResetToken)
              })
              .then(function(result) {
                t.deepEqual(result, {}, 'Returned an empty object on second account reset token creation')
                // now retrieve this one
                return db.accountResetToken(accountResetTokenId)
              })
              .then(function(token) {
                // check a couple of fields
                t.deepEqual(token.uid, ACCOUNT.uid, 'token belongs to this account')
                t.deepEqual(token.tokenData, accountResetToken.data, 'token data matches')
                // now check that the original token no longer exists
                return db.accountResetToken(ACCOUNT_RESET_TOKEN_ID)
              })
              .then(function(token) {
                t.fail('Original Account Reset Token should no longer exist')
              }, function(err) {
                t.pass('Original Account Reset Token is no longer there')
              })
          }
        )

        test(
          'db.forgotPasswordVerified',
          function (t) {
            t.plan(16)
            // for this test, we are creating a new account with a different email address
            // so that we can check that emailVerified turns from false to true (since
            // we already set it to true earlier)
            var ACCOUNT = {
              uid: uuid.v4('binary'),
              email: ('' + Math.random()).substr(2) + '@bar.com',
              emailCode: zeroBuffer16,
              emailVerified: false,
              verifierVersion: 1,
              verifyHash: zeroBuffer32,
              authSalt: zeroBuffer32,
              kA: zeroBuffer32,
              wrapWrapKb: zeroBuffer32,
              verifierSetAt: Date.now(),
              locale: 'en_GB',
            }
            var PASSWORD_FORGOT_TOKEN_ID = hex32()
            var PASSWORD_FORGOT_TOKEN = {
              data : hex32(),
              uid : ACCOUNT.uid,
              passCode : hex16(),
              tries : 1,
              createdAt: Date.now(),
            }
            var ACCOUNT_RESET_TOKEN_ID = hex32()
            var ACCOUNT_RESET_TOKEN = {
              tokenId : ACCOUNT_RESET_TOKEN_ID,
              data : hex32(),
              uid : ACCOUNT.uid,
              createdAt: Date.now(),
            }
            var THROWAWAY_ACCOUNT_RESET_TOKEN_ID = hex32()
            var THROWAWAY_ACCOUNT_RESET_TOKEN = {
              tokenId : ACCOUNT_RESET_TOKEN_ID,
              data : hex32(),
              uid : ACCOUNT.uid,
              createdAt: Date.now(),
            }

            return db.createAccount(ACCOUNT.uid, ACCOUNT)
              .then(function() {
                // let's add a throwaway accountResetToken, which should be overwritten when
                // we call passwordForgotToken() later.
                return db.createAccountResetToken(THROWAWAY_ACCOUNT_RESET_TOKEN_ID, THROWAWAY_ACCOUNT_RESET_TOKEN)
              })
              .then(function(result) {
                t.deepEqual(result, {}, 'Returned an empty object on account reset token creation (the throwaway one)')
                // let's get it back out to make sure it is there
                return db.accountResetToken(THROWAWAY_ACCOUNT_RESET_TOKEN_ID)
              })
              .then(function(token) {
                // check a couple of fields
                t.deepEqual(token.uid, ACCOUNT.uid, 'token belongs to this account')
                t.deepEqual(token.tokenData, THROWAWAY_ACCOUNT_RESET_TOKEN.data, 'token data matches')
                // get this account out using emailRecord
                var emailBuffer = Buffer(ACCOUNT.email)
                return db.emailRecord(emailBuffer)
              })
              .then(function(result) {
                t.pass('.emailRecord() did not error')
                return db.createPasswordForgotToken(PASSWORD_FORGOT_TOKEN_ID, PASSWORD_FORGOT_TOKEN)
              })
              .then(function(passwordForgotToken) {
                t.pass('.createPasswordForgotToken() did not error')
                return db.forgotPasswordVerified(PASSWORD_FORGOT_TOKEN_ID, ACCOUNT_RESET_TOKEN)
              })
              .then(function() {
                t.pass('.forgotPasswordVerified() did not error')
                // let's try and get the throwaway accountResetToken (shouldn't exist any longer)
                return db.accountResetToken(THROWAWAY_ACCOUNT_RESET_TOKEN_ID)
              })
              .then(function(token) {
                t.fail('Throwaway Account Reset Token should no longer exist')
              }, function(err) {
                t.pass('Throwaway Account Reset Token deleted during forgotPasswordVerified')
                // retrieve passwordForgotToken (shouldn't exist now)
                return db.passwordForgotToken(PASSWORD_FORGOT_TOKEN_ID)
              })
              .then(function(token) {
                t.fail('Password Forgot Token should no longer exist')
              }, function(err) {
                t.pass('Password Forgot Token deleted successfully')
              })
              .then(function() {
                return db.accountResetToken(ACCOUNT_RESET_TOKEN_ID)
              })
              .then(function(accountResetToken) {
                t.pass('.accountResetToken() did not error')
                // tokenId is not returned
                t.deepEqual(accountResetToken.uid, ACCOUNT.uid, 'token belongs to this account')
                t.deepEqual(accountResetToken.tokenData, ACCOUNT_RESET_TOKEN.data, 'token data matches')
                t.ok(accountResetToken.verifierSetAt, 'verifierSetAt is set to a truthy value')
              })
              .then(function() {
                return db.account(ACCOUNT.uid)
              })
              .then(function(account) {
                t.ok(account.emailVerified, 'account should now be emailVerified (truthy)')
                t.equal(account.emailVerified, 1, 'account should now be emailVerified (1)')
              })
              .then(function() {
                return db.deleteAccountResetToken(ACCOUNT_RESET_TOKEN_ID)
              })
              .then(function(result) {
                t.deepEqual(result, {}, 'Returned an empty object on account reset deletion')
                return db.accountResetToken(ACCOUNT_RESET_TOKEN_ID)
              })
              .then(function(token) {
                t.fail('Account Reset Token should no longer exist')
              }, function(err) {
                t.pass('Account Reset Token deleted successfully')
              })
          }
        )

        test(
          'db.accountDevices',
          function (t) {
            t.plan(3)
            var anotherSessionTokenId = hex32()
            var anotherSessionToken = {
              data : hex32(),
              uid : ACCOUNT.uid,
              createdAt: Date.now(),
            }
            db.createSessionToken(SESSION_TOKEN_ID, SESSION_TOKEN)
              .then(function(sessionToken) {
                return db.createSessionToken(anotherSessionTokenId, anotherSessionToken)
              })
              .then(function() {
                return db.accountDevices(ACCOUNT.uid)
              })
              .then(function(devices) {
                t.equal(devices.length, 2, 'Account devices should be two')
                return devices[0]
              })
              .then(function(sessionToken) {
                return db.deleteSessionToken(SESSION_TOKEN_ID)
              })
              .then(function(sessionToken) {
                return db.accountDevices(ACCOUNT.uid)
              })
              .then(function(devices) {
                t.equal(devices.length, 1, 'Account devices should be one')
                return devices[0]
              })
              .then(function(sessionToken) {
                return db.deleteSessionToken(anotherSessionTokenId)
              })
              .then(function(sessionToken) {
                return db.accountDevices(ACCOUNT.uid)
              })
              .then(function(devices) {
                t.equal(devices.length, 0, 'Account devices should be zero')
              })
          }
        )

        test(
          'db.resetAccount',
          function (t) {
            t.plan(6)
            return db.createSessionToken(SESSION_TOKEN_ID, SESSION_TOKEN)
              .then(function(sessionToken) {
                t.pass('.createSessionToken() did not error')
                return db.createAccountResetToken(ACCOUNT_RESET_TOKEN_ID, ACCOUNT_RESET_TOKEN)
              })
              .then(function() {
                t.pass('.createAccountResetToken() did not error')
                return db.resetAccount(ACCOUNT.uid, ACCOUNT)
              })
              .then(function(sessionToken) {
                t.pass('.resetAccount() did not error')
                return db.accountDevices(ACCOUNT.uid)
              })
              .then(function(devices) {
                t.pass('.accountDevices() did not error')
                t.equal(devices.length, 0, 'The devices length should be zero')
              })
              .then(function() {
                // account should STILL exist for this email address
                var emailBuffer = Buffer(ACCOUNT.email)
                return db.accountExists(emailBuffer)
              })
              .then(function(exists) {
                t.ok(exists, 'account still exists ok')
              }, function(err) {
                t.fail('the account for this email address should still exist')
              })
          }
        )

        test(
          'account deletion',
          function (t) {
            t.plan(1)
            // account should no longer exist for this email address
            return db.deleteAccount(ACCOUNT.uid)
              .then(function() {
                var emailBuffer = Buffer(ACCOUNT.email)
                return db.accountExists(emailBuffer)
              })
              .then(function(exists) {
                t.fail('account should no longer exist for this email address')
              }, function(err) {
                t.pass('account no longer exists for this email address')
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
}
