/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var restify = require('restify')
var error = require('../error')
var bufferize = require('../bufferize')
var config = require('../config')
var log = require('../log')(config.logLevel, 'db-api')
var DB = require('../db/mysql')(log, error)
var package = require('../package.json')

var MemoryMonitor = require('../memory_monitor')
var memoryMonitor = new MemoryMonitor()
memoryMonitor.on(
  'mem',
  function (usage) {
    log.stat(
      {
        stat: 'mem',
        rss: usage.rss,
        heapTotal: usage.heapTotal,
        heapUsed: usage.heapUsed
      }
    )
  }
)
memoryMonitor.start()

process.on(
  'uncaughtException',
  function (err) {
    log.fatal({
      op: 'uncaughtException',
      err: err
    })
    process.exit(8)
  }
)

// defer to allow ass code coverage results to complete processing
if (process.env.ASS_CODE_COVERAGE) {
  process.on('SIGINT', shutdown)
  function shutdown() {
    process.nextTick(function() {
      process.exit()
    })
  }
}

function startServer(db) {

  function reply(fn) {
    return function (req, res, next) {
      fn.call(db, req.params.id, req.body)
        .then(
          function (result) {
            log.info(
              {
                op: 'request.summary',
                code: 200,
                route: req.route.name,
                method: req.method,
                path: req.url,
                t: Date.now() - req.time()
              }
            )
            if (Array.isArray(result)) {
              res.send(result.map(bufferize.unbuffer))
            }
            else {
              res.send(bufferize.unbuffer(result || {}))
            }
          },
          function (err) {
            if (typeof err !== 'object') {
              err = { message: err || 'none' }
            }
            var statusCode = err.code || 500
            var msg = {
              op: 'request.summary',
              code: statusCode,
              route: req.route.name,
              method: req.method,
              path: req.url,
              err: err,
              t: Date.now() - req.time()
            }
            if (statusCode >= 500) {
              log.error(msg)
            }
            else {
              log.warn(msg)
            }
            res.send(err.code || 500, err)
          }
        )
        .done(next, next)
    }
  }
  var api = restify.createServer()
  api.use(restify.bodyParser())
  api.use(bufferize.bufferizeRequest)

  api.get('/account/:id', reply(db.account))
  api.del('/account/:id', reply(db.deleteAccount))
  api.put('/account/:id', reply(db.createAccount))
  api.get('/account/:id/devices', reply(db.accountDevices))
  api.post('/account/:id/reset', reply(db.resetAccount))
  api.post('/account/:id/verifyEmail', reply(db.verifyEmail))

  api.get('/sessionToken/:id', reply(db.sessionToken))
  api.del('/sessionToken/:id', reply(db.deleteSessionToken))
  api.put('/sessionToken/:id', reply(db.createSessionToken))

  api.get('/keyFetchToken/:id', reply(db.keyFetchToken))
  api.del('/keyFetchToken/:id', reply(db.deleteKeyFetchToken))
  api.put('/keyFetchToken/:id', reply(db.createKeyFetchToken))

  api.get('/accountResetToken/:id', reply(db.accountResetToken))
  api.del('/accountResetToken/:id', reply(db.deleteAccountResetToken))
  api.put('/accountResetToken/:id', reply(db.createAccountResetToken))

  api.get('/passwordChangeToken/:id', reply(db.passwordChangeToken))
  api.del('/passwordChangeToken/:id', reply(db.deletePasswordChangeToken))
  api.put('/passwordChangeToken/:id', reply(db.createPasswordChangeToken))

  api.get('/passwordForgotToken/:id', reply(db.passwordForgotToken))
  api.del('/passwordForgotToken/:id', reply(db.deletePasswordForgotToken))
  api.put('/passwordForgotToken/:id', reply(db.createPasswordForgotToken))
  api.post('/passwordForgotToken/:id/update', reply(db.updatePasswordForgotToken))
  api.post('/passwordForgotToken/:id/verified', reply(db.forgotPasswordVerified))

  api.get('/emailRecord/:id', reply(db.emailRecord))
  api.head('/emailRecord/:id', reply(db.accountExists))

  api.get('/__heartbeat__', reply(db.ping))

  api.get(
    '/',
    function (req, res, next) {
      res.send({ version: package.version, patchLevel: db.patchLevel })
      next()
    }
  )

  api.listen(
    config.port,
    config.hostname,
    function () {
      log.info({ op: 'listening', port: config.port, host: config.hostname })
    }
  )
}

DB.connect(config).done(startServer)
