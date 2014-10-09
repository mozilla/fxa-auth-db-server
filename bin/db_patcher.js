/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var path = require('path')
var mysql = require('mysql')
var config = require('../config')
var log = require('../log')(config.logLevel, 'db-patcher')
var patcher = require('mysql-patcher')
var P = require('../promise')
var patch = require('../db/patch')

// Since the regular `fxa` user doesn't have enough permissions to perform DB
// schema changes, use the admin credentials (for the same database).
var opts = {
  user:     config.admin.user,
  password: config.admin.password,
  host:     config.master.host,
  port:     config.master.port,
}

// First, we create the `fxa` user if this user does not yet exist.
// Then we patch the database
var connection = mysql.createConnection(opts)
connection.connect()

// this calls back with (err, rows, fields) so we need to .spread() when using it
var pQuery = P.promisify(connection.query, connection);

var SQL_SEL_USER = 'SELECT user, host FROM mysql.user WHERE user = ? AND host = ?'
pQuery(SQL_SEL_USER, [config.master.user, config.master.host])
  .spread(function(rows, fields) {
    if ( rows.length > 0 ) {
      log.info('Database user ' + config.master.user + '@' + config.master.host + ' already exists')
      return
    }

    var SQL_CREATE_USER = 'CREATE USER ?@?'
    log.info('Creating user ' + config.master.user + '@' + config.master.host)
    return pQuery(SQL_CREATE_USER, [config.master.user, config.master.host])
  })
  .spread(function(result) {
    if (result) {
      log.info('User created')
    }
    // close the current connection
    connection.end()

    log.info('Patching database to level ' + patch.level)

    opts.database = config.master.database
    opts.dir = path.join(__dirname, '..', 'db', 'schema')
    opts.patchKey = 'schema-patch-level'
    opts.metaTable = 'dbMetadata'
    opts.patchLevel = patch.level
    opts.mysql = mysql
    opts.createDatabase = true
    opts.reversePatchAllowed = false

    var d = P.defer()
    patcher.patch(opts, function(err) {
      if (err) return d.reject(err)
      d.resolve()
    })
    return d.promise
  })
  .then(
    function() {
      log.info('Database patched to level ' + opts.patchLevel)
    },
    function(err) {
      log.error(err)
      process.exit(2)
    }
  )
