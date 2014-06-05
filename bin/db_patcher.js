/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var path = require('path')
var fs = require('fs')
var argh = require('argh');
var mysql = require('mysql')
var P = require('../promise.js')
var config = require('../config')
var log = require('../log')(config.logLevel, 'db-patcher')

var schemaDir = path.join(__dirname, '..', 'db', 'schema')
var patches = {}
var files = fs.readdirSync(schemaDir)
files.forEach(function(filename) {
  var from, to
  var m = filename.match(/^patch-(\d+)-(\d+)\.sql$/)
  if (m) {
    from = parseInt(m[1], 10)
    to = parseInt(m[2], 10)
    patches[from] = patches[from] || {}
    patches[from][to] = fs.readFileSync(path.join(schemaDir, filename),  { encoding: 'utf8'})
  }
  else {
    console.warn("Startup error: Unknown file in schema/ directory - '%s'", filename)
    process.exit(2)
  }
})

// To run any patches we need to switch multipleStatements on
config.master.multipleStatements = true

// when creating the database, we need to connect without a database name
var database = config.master.database
delete config.master.database

var client = mysql.createConnection(config.master)

createDatabase()
  .then(changeUser)
  .then(checkDbMetadataExists)
  .then(readDbPatchLevel)
  .then(figureOutPatchesToBeApplied)
  .then(function(patchesToApply) {
    if ( argh.argv['dry-run'] ) {
      return patchToRequiredLevelDryRun(patchesToApply)
    }
    else {
      return patchToRequiredLevel(patchesToApply)
    }
  })
  .then(close)
  .done(
    function() {
      log.info('Patching complete')
    },
    function(err) {
      log.fatal(err)
      process.exit(2)
    }
  )

// helper functions
function createDatabase() {
  var d = P.defer()
  log.trace( { op: 'MySql.createSchema:CreateDatabase' } )
  client.query(
    'CREATE DATABASE IF NOT EXISTS ' + database + ' CHARACTER SET utf8 COLLATE utf8_unicode_ci',
    function (err) {
      if (err) {
        log.error({ op: 'MySql.createSchema:CreateDatabase', err: err.message })
        return d.reject(err)
      }
      d.resolve()
    }
  )
  return d.promise
}

function changeUser() {
  var d = P.defer()
  log.trace( { op: 'MySql.createSchema:ChangeUser' } )
  client.changeUser(
    {
      user     : config.master.user,
      password : config.master.password,
      database : database
    },
    function (err) {
      if (err) {
        log.error({ op: 'MySql.createSchema:ChangeUser', err: err.message })
        return d.reject(err)
      }
      d.resolve()
    }
  )
  return d.promise
}

function checkDbMetadataExists() {
  log.trace( { op: 'MySql.createSchema:CheckDbMetadataExists' } )
  var d = P.defer()
  var query = "SELECT COUNT(*) AS count FROM information_schema.TABLES WHERE table_schema = ? AND table_name = 'dbMetadata'"
  client.query(
    query,
    [ database ],
    function (err, result) {
      if (err) {
        log.trace( { op: 'MySql.createSchema:MakingTheSchema', err: err.message } )
        return d.reject(err)
      }
      d.resolve(result[0].count === 0 ? false : true)
    }
  )
  return d.promise
}

function readDbPatchLevel(dbMetadataExists) {
  log.trace( { op: 'MySql.createSchema:ReadDbPatchLevel' } )
  if ( dbMetadataExists === false ) {
    // the table doesn't exist, so start at patch level 0
    return P.resolve(0)
  }

  // find out what patch level the database is currently at
  var d = P.defer()
  var query = "SELECT value FROM dbMetadata WHERE name = ?"
  client.query(
    query,
    [ config.patchKey ],
    function(err, result) {
      if (err) {
        log.trace( { op: 'MySql.createSchema:ReadDbPatchLevel', err: err.message } )
        return d.reject(err)
      }
      // convert the patch level from a string to a number
      return d.resolve(+result[0].value)
    }
  )
  return d.promise
}

function figureOutPatchesToBeApplied(currentPatchLevel) {
  log.trace( { op: 'MySql.createSchema:FigureOutPatchesToBeApplied' } )

  // if we don't need any patches
  if ( config.patchLevel === currentPatchLevel ) {
    log.trace( { op: 'MySql.createSchema:FigureOutPatchesToBeApplied', patch: 'No patch required' } )
    return P.resolve([])
  }

  // We don't want any reverse patches to be automatically applied, so
  // just emit a warning and carry on.
  if ( config.patchLevel < currentPatchLevel ) {
    log.warn( { op: 'MySql.createSchema:FigureOutPatchesToBeApplied', err: 'Reverse patch required - must be done manually' } )
    return P.resolve([])
  }

  log.trace({
    op: 'MySql.createSchema:FigureOutPatchesToBeApplied',
    msg1: 'Patching from ' + currentPatchLevel + ' to ' + config.patchLevel
  })

  var patchesToApply = []

  // First, loop through all the patches we need to apply
  // to make sure they exist.
  while ( currentPatchLevel < config.patchLevel ) {
    // check that this patch exists
    if ( !patches[currentPatchLevel][currentPatchLevel+1] ) {
      log.fatal({
        op: 'MySql.createSchema:FigureOutPatchesToBeApplied',
        err: 'Patch from level ' + currentPatchLevel + ' to ' + (currentPatchLevel+1) + ' does not exist'
      });
      process.exit(2)
    }
    patchesToApply.push({
      sql  : patches[currentPatchLevel][currentPatchLevel+1],
      from : currentPatchLevel,
      to   : currentPatchLevel+1,
    })
    currentPatchLevel += 1
  }

  return P.resolve(patchesToApply)
}

function patchToRequiredLevelDryRun(patchesToApply) {
  log.trace( { op: 'MySql.createSchema:PatchToRequiredLevelDryRun' } )

  patchesToApply.forEach(function(patch) {
    log.info({ op: 'MySql.createSchema:PatchToRequiredLevelDryRun', msg1: 'Would update DB for patch ' + patch.from + ' to ' + patch.to })
  })

  return P.resolve()
}

function patchToRequiredLevel(patchesToApply) {
  log.trace( { op: 'MySql.createSchema:PatchToRequiredLevel' } )

  var promise = P.resolve()

  // now apply each patch
  patchesToApply.forEach(function(patch) {
    promise = promise.then(function() {
      var d = P.defer()
      log.info({ op: 'MySql.createSchema:PatchToRequiredLevel', msg1: 'Updating DB for patch ' + patch.from + ' to ' + patch.to })
      client.query(
        patch.sql,
        function(err) {
          if (err) return d.reject(err)
          d.resolve()
        }
      )
      return d.promise
    })
  })

  return promise
}

function close() {
  var d = P.defer()
  log.trace( { op: 'MySql.createSchema:Close' } )
  client.end(
    function (err) {
      if (err) {
        log.error({ op: 'MySql.createSchema:Closed', err: err.message })
        return d.reject(err)
      }

      // create the mysql class
      log.trace( { op: 'MySql.createSchema:ResolvingWithNewClient' } )
      d.resolve('ok')
    }
  )
  return d.promise
}
