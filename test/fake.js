/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

var crypto = require('crypto')
var uuid = require('uuid')

function hex16() { return crypto.randomBytes(16).toString('hex') }
function hex32() { return crypto.randomBytes(32).toString('hex') }
function hex64() { return crypto.randomBytes(64).toString('hex') }
function hex96() { return crypto.randomBytes(96).toString('hex') }

module.exports.newUserDataHex = function() {
  var data = {}

  // account
  data.accountId = hex16()
  data.account = {
    email: hex16() + '@example.com',
    emailCode: hex16(),
    emailVerified: false,
    verifierVersion: 1,
    verifyHash: hex32(),
    authSalt: hex32(),
    kA: hex32(),
    wrapWrapKb: hex32(),
    verifierSetAt: Date.now(),
  }

  // sessionToken
  data.sessionTokenId = hex32()
  data.sessionToken = {
    data : hex32(),
    uid : data.accountId,
    createdAt: Date.now(),
  }

  // keyFetchToken

  // passwordForgotToken

  // passwordChangeToken

  // accountResetToken

  return data
}
