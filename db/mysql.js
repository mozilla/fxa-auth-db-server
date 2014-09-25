/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var mysql = require('mysql')
var P = require('../promise')

var patch = require('./patch')

// http://dev.mysql.com/doc/refman/5.5/en/error-messages-server.html
const ER_TOO_MANY_CONNECTIONS = 1040
const ER_DUP_ENTRY = 1062
const ER_LOCK_WAIT_TIMEOUT = 1205
const ER_LOCK_TABLE_FULL = 1206
const ER_LOCK_DEADLOCK = 1213
const ER_LOCK_ABORTED = 1689

module.exports = function (log, error) {

  var LOCK_ERRNOS = [
    ER_LOCK_WAIT_TIMEOUT,
    ER_LOCK_TABLE_FULL,
    ER_LOCK_DEADLOCK,
    ER_LOCK_ABORTED
  ]

  // make a pool of connections that we can draw from
  function MySql(options) {
    this.options = options

    this.patchLevel = 0
    // poolCluster will remove the pool after `removeNodeErrorCount` errors.
    // We don't ever want to remove a pool because we only have one pool
    // for writing and reading each. Connection errors are mostly out of our
    // control for automatic recovery so monitoring of 503s is critical.
    // Since `removeNodeErrorCount` is Infinity `canRetry` must be false
    // to prevent inifinite retry attempts.
    this.poolCluster = mysql.createPoolCluster(
      {
        removeNodeErrorCount: Infinity,
        canRetry: false
      }
    )

    // Use separate pools for master and slave connections.
    this.poolCluster.add('MASTER', options.master)
    this.poolCluster.add('SLAVE', options.slave)
    this.getClusterConnection = P.promisify(this.poolCluster.getConnection, this.poolCluster)


    this.statInterval = setInterval(
      reportStats.bind(this),
      options.statInterval || 15000
    )
    this.statInterval.unref()

    // prune tokens every so often
    function prune() {
      this.pruneTokens().done(
        function() {
          log.info({ op: 'db.pruneTokens', msg: 'Finished' })
        },
        function(err) {
          log.error({ op: 'db.pruneTokens', err: err })
        }
      )

      var pruneIn = options.pruneEvery/2 + Math.floor(Math.random() * options.pruneEvery)
      setTimeout(prune.bind(this), pruneIn).unref();
    }
    // start the pruning off, but only if enabled in config
    if ( options.enablePruning ) {
      prune.bind(this)()
    }
  }

  function reportStats() {
    var nodes = Object.keys(this.poolCluster._nodes).map(
      function (name) {
        return this.poolCluster._nodes[name]
      }.bind(this)
    )
    var stats = nodes.reduce(
      function (totals, node) {
        totals.errors += node.errorCount
        totals.connections += node.pool._allConnections.length
        totals.queue += node.pool._connectionQueue.length
        totals.free += node.pool._freeConnections.length
        return totals
      },
      {
        stat: 'mysql',
        errors: 0,
        connections: 0,
        queue: 0,
        free: 0
      }
    )
    log.stat(stats)
  }

  // this will be called from outside this file
  MySql.connect = function(options) {
    // check that the database patch level is what we expect (or one above)
    var mysql = new MySql(options)

    return mysql.readOneFromMultipleResults("CALL dbMetadata_1(?)", options.patchKey)
      .then(
        function (result) {
          mysql.patchLevel = +result.value

          log.info({
            op: 'MySql.connect',
            patchLevel: mysql.patchLevel,
            patchLevelRequired: patch.level
          })

          if (
            mysql.patchLevel === patch.level ||
            mysql.patchLevel === patch.level + 1
          ) {
            return mysql
          }

          throw new Error('dbIncorrectPatchLevel')
        }
      )
  }

  MySql.prototype.close = function () {
    this.poolCluster.end()
    clearInterval(this.statInterval)
    return P.resolve()
  }

  MySql.prototype.ping = function () {
    return this.getConnection('MASTER')
      .then(
        function(connection) {
          var d = P.defer()
          connection.ping(
            function (err) {
              connection.release()
              return err ? d.reject(err) : d.resolve()
            }
          )
          return d.promise
        }
      )
  }

  // CREATE
  var CREATE_ACCOUNT = 'CALL createAccount_1(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'

  MySql.prototype.createAccount = function (uid, data) {
    data.normalizedEmail = data.email
    data.createdAt = data.verifierSetAt = Date.now()

    return this.write(
      CREATE_ACCOUNT,
      [
        uid,
        data.normalizedEmail,
        data.email,
        data.emailCode,
        data.emailVerified,
        data.kA,
        data.wrapWrapKb,
        data.authSalt,
        data.verifierVersion,
        data.verifyHash,
        data.verifierSetAt,
        data.createdAt,
        data.locale
      ]
    )
  }

  var CREATE_SESSION_TOKEN = 'CALL createSessionToken_1(?, ?, ?, ?)'

  MySql.prototype.createSessionToken = function (tokenId, sessionToken) {
    return this.write(
      CREATE_SESSION_TOKEN,
      [
        tokenId,
        sessionToken.data,
        sessionToken.uid,
        sessionToken.createdAt
      ]
    )
  }

  var CREATE_KEY_FETCH_TOKEN = 'CALL createKeyFetchToken_1(?, ?, ?, ?, ?)'

  MySql.prototype.createKeyFetchToken = function (tokenId, keyFetchToken) {
    return this.write(
      CREATE_KEY_FETCH_TOKEN,
      [
        tokenId,
        keyFetchToken.authKey,
        keyFetchToken.uid,
        keyFetchToken.keyBundle,
        keyFetchToken.createdAt
      ]
    )
  }

  var CREATE_ACCOUNT_RESET_TOKEN = 'CALL createAccountResetToken_1(?, ?, ?, ?)'

  MySql.prototype.createAccountResetToken = function (tokenId, accountResetToken) {
    return this.write(
      CREATE_ACCOUNT_RESET_TOKEN,
      [
        tokenId,
        accountResetToken.data,
        accountResetToken.uid,
        accountResetToken.createdAt
      ]
    )
  }

  var CREATE_PASSWORD_FORGOT_TOKEN = 'CALL createPasswordForgotToken_1(?, ?, ?, ?, ?, ?)'

  MySql.prototype.createPasswordForgotToken = function (tokenId, passwordForgotToken) {
    return this.write(
      CREATE_PASSWORD_FORGOT_TOKEN,
      [
        tokenId,
        passwordForgotToken.data,
        passwordForgotToken.uid,
        passwordForgotToken.passCode,
        passwordForgotToken.createdAt,
        passwordForgotToken.tries
      ]
    )
  }

  var CREATE_PASSWORD_CHANGE_TOKEN = 'CALL createPasswordChangeToken_1(?, ?, ?, ?)'

  MySql.prototype.createPasswordChangeToken = function (tokenId, passwordChangeToken) {
    return this.write(
      CREATE_PASSWORD_CHANGE_TOKEN,
      [
        tokenId,
        passwordChangeToken.data,
        passwordChangeToken.uid,
        passwordChangeToken.createdAt
      ]
    )
  }

  // READ

  var ACCOUNT_EXISTS = 'CALL accountExists_1(?)'

  MySql.prototype.accountExists = function (emailBuffer) {
    return this.readOneFromMultipleResults(ACCOUNT_EXISTS, emailBuffer.toString('utf8'))
  }

  var ACCOUNT_DEVICES = 'CALL accountDevices_1(?)'

  MySql.prototype.accountDevices = function (uid) {
    return this.readFirstFromMultipleResults(ACCOUNT_DEVICES, uid)
  }

  var SESSION_TOKEN = 'CALL sessionToken_1(?)'

  MySql.prototype.sessionToken = function (id) {
    return this.readOneFromMultipleResults(SESSION_TOKEN, id)
  }

  var KEY_FETCH_TOKEN = 'CALL keyFetchToken_1(?)'

  MySql.prototype.keyFetchToken = function (id) {
    return this.readOneFromMultipleResults(KEY_FETCH_TOKEN, id)
  }

  var ACCOUNT_RESET_TOKEN = 'CALL accountResetToken_1(?)'

  MySql.prototype.accountResetToken = function (id) {
    return this.readOneFromMultipleResults(ACCOUNT_RESET_TOKEN, id)
  }

  var PASSWORD_FORGOT_TOKEN = 'CALL passwordForgotToken_1(?)'

  MySql.prototype.passwordForgotToken = function (id) {
    return this.readOneFromMultipleResults(PASSWORD_FORGOT_TOKEN, id)
  }

  var PASSWORD_CHANGE_TOKEN = 'CALL passwordChangeToken_1(?)'

  MySql.prototype.passwordChangeToken = function (id) {
    return this.readOneFromMultipleResults(PASSWORD_CHANGE_TOKEN, id)
  }

  var EMAIL_RECORD = 'CALL emailRecord_1(?)'

  MySql.prototype.emailRecord = function (emailBuffer) {
    return this.readOneFromMultipleResults(EMAIL_RECORD, emailBuffer.toString('utf8'))
  }

  var ACCOUNT = 'CALL account_1(?)'

  MySql.prototype.account = function (uid) {
    return this.readOneFromMultipleResults(ACCOUNT, uid)
  }

  // UPDATE

  var UPDATE_PASSWORD_FORGOT_TOKEN = 'CALL updatePasswordForgotToken_1(?, ?)'

  MySql.prototype.updatePasswordForgotToken = function (tokenId, token) {
    return this.write(UPDATE_PASSWORD_FORGOT_TOKEN, [token.tries, tokenId])
  }

  // DELETE

  var DELETE_ACCOUNT = 'CALL deleteAccount_1(?)'

  MySql.prototype.deleteAccount = function (uid) {
    return this.write(DELETE_ACCOUNT, [uid])
  }

  var DELETE_SESSION_TOKEN = 'CALL deleteSessionToken_1(?)'

  MySql.prototype.deleteSessionToken = function (tokenId) {
    return this.write(DELETE_SESSION_TOKEN, [tokenId])
  }

  var DELETE_KEY_FETCH_TOKEN = 'CALL deleteKeyFetchToken_1(?)'

  MySql.prototype.deleteKeyFetchToken = function (tokenId) {
    return this.write(DELETE_KEY_FETCH_TOKEN, [tokenId])
  }

  var DELETE_ACCOUNT_RESET_TOKEN = 'CALL deleteAccountResetToken_1(?)'

  MySql.prototype.deleteAccountResetToken = function (tokenId) {
    return this.write(DELETE_ACCOUNT_RESET_TOKEN, [tokenId])
  }

  var DELETE_PASSWORD_FORGOT_TOKEN = 'CALL deletePasswordForgotToken_1(?)'

  MySql.prototype.deletePasswordForgotToken = function (tokenId) {
    return this.write(DELETE_PASSWORD_FORGOT_TOKEN, [tokenId])
  }

  var DELETE_PASSWORD_CHANGE_TOKEN = 'CALL deletePasswordChangeToken_1(?)'

  MySql.prototype.deletePasswordChangeToken = function (tokenId) {
    return this.write(DELETE_PASSWORD_CHANGE_TOKEN, [tokenId])
  }

  // BATCH

  var RESET_ACCOUNT = 'CALL resetAccount_1(?, ?, ?, ?, ?, ?)'

  MySql.prototype.resetAccount = function (uid, data) {
    return this.write(
      RESET_ACCOUNT,
      [uid, data.verifyHash, data.authSalt, data.wrapWrapKb, Date.now(), data.verifierVersion]
    )
  }

  var VERIFY_EMAIL = 'CALL verifyEmail_1(?)'

  MySql.prototype.verifyEmail = function (uid) {
    return this.write(VERIFY_EMAIL, [uid])
  }

  var FORGOT_PASSWORD_VERIFIED = 'CALL forgotPasswordVerified_1(?, ?, ?, ?, ?)'

  MySql.prototype.forgotPasswordVerified = function (tokenId, accountResetToken) {
    return this.write(
      FORGOT_PASSWORD_VERIFIED,
      [
        tokenId,
        accountResetToken.tokenId,
        accountResetToken.data,
        accountResetToken.uid,
        accountResetToken.createdAt
      ]
    )
  }

  var UPDATE_LOCALE = 'CALL updateLocale_1(?, ?)'

  MySql.prototype.updateLocale = function (uid, data) {
    return this.write(UPDATE_LOCALE, [data.locale, uid])
  }

  // Internal

  MySql.prototype.singleQuery = function (poolName, sql, params) {
    return this.getConnection(poolName)
      .then(
        function (connection) {
          return query(connection, sql, params)
            .then(
              function (result) {
                connection.release()
                return result
              },
              function (err) {
                connection.release()
                throw err
              }
            )
        }
      )
  }

  MySql.prototype.transaction = function (fn) {
    return retryable(
      function () {
        return this.getConnection('MASTER')
          .then(
            function (connection) {
              return query(connection, 'BEGIN')
                .then(
                  function () {
                    return fn(connection)
                  }
                )
                .then(
                  function (result) {
                    return query(connection, 'COMMIT')
                      .then(function () { return result })
                  }
                )
                .catch(
                  function (err) {
                    log.error({ op: 'MySql.transaction', err: err })
                    return query(connection, 'ROLLBACK')
                      .then(function () { throw err })
                  }
                )
                .then(
                  function (result) {
                    connection.release()
                    return result
                  },
                  function (err) {
                    connection.release()
                    throw err
                  }
                )
            }
          )
      }.bind(this),
      LOCK_ERRNOS
    )
    .catch(
      function (err) {
        throw error.wrap(err)
      }
    )
  }

  MySql.prototype.readOneFromMultipleResults = function (sql, param) {
    return this.read(sql, param)
      .then(function(results) {
        // instead of the result being [result], it'll be [[result...]]
        if (!results.length) { throw error.notFound() }
        if (!results[0].length) { throw error.notFound() }
        return results[0][0]
      })
  }

  MySql.prototype.readFirstFromMultipleResults = function (sql, param) {
    return this.read(sql, param)
      .then(function(results) {
        // instead of the result being [result], it'll be [[result...]]
        if (!results.length) { throw error.notFound() }
        return results[0]
      })
  }

  MySql.prototype.read = function (sql, param) {
    return this.singleQuery('SLAVE*', sql, [param])
      .catch(
        function (err) {
          log.error({ op: 'MySql.read', sql: sql, id: param, err: err })
          throw error.wrap(err)
        }
      )
  }

  MySql.prototype.write = function (sql, params) {
    return this.singleQuery('MASTER', sql, params)
      .then(
        function (result) {
          log.trace({ op: 'MySql.write', sql: sql, result: result })
          return {}
        },
        function (err) {
          log.error({ op: 'MySql.write', sql: sql, err: err })
          if (err.errno === ER_DUP_ENTRY) {
            err = error.duplicate()
          }
          else {
            err = error.wrap(err)
          }
          throw err
        }
      )
  }

  MySql.prototype.getConnection = function (name) {
    return retryable(
      this.getClusterConnection,
      [ER_TOO_MANY_CONNECTIONS, 'ECONNREFUSED', 'ETIMEDOUT', 'ECONNRESET']
    )
  }

  function query(connection, sql, params) {
    var d = P.defer()
    connection.query(
      sql,
      params || [],
      function (err, results) {
        if (err) { return d.reject(err) }
        d.resolve(results)
      }
    )
    return d.promise
  }

  function retryable(fn, errnos) {
    function success(result) {
      return result
    }
    function failure(err) {
      var errno = err.cause ? err.cause.errno : err.errno
      log.error({ op: 'MySql.retryable', err: err })
      if (errnos.indexOf(errno) === -1) {
        throw err
      }
      return fn()
    }
    return fn().then(success, failure)
  }

  // exposed for testing only
  MySql.prototype.retryable_ = retryable

  var PRUNE = "CALL prune(?, ?)"
  MySql.prototype.pruneTokens = function () {
    log.info({  op : 'MySql.pruneTokens' })

    var now = Date.now()
    var pruneBefore = now - this.options.pruneEvery

    return this.write(
      PRUNE,
      [pruneBefore, now]
    )
  }

  return MySql
}
