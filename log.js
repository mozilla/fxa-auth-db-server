/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var Domain = require('domain')
var util = require('util')
var Logger = require('bunyan')
var unbuffer = require('./bufferize').unbuffer

function Overdrive(options) {
  Logger.call(this, options)
}
util.inherits(Overdrive, Logger)

Overdrive.prototype.trace = function () {
  // TODO if this is a performance burden reintroduce the level check
  // otherwise this is valuable data for debugging in the log.summary
  var arg0 = arguments[0]
  if (typeof(arg0) === 'object') {
    unbuffer(arg0)
  }

  return Logger.prototype.trace.apply(this, arguments)
}

Overdrive.prototype.event = function (name, data) {
  var e = {
    event: name,
    data: unbuffer(data)
  }
  process.stdout.write(JSON.stringify(e) + '\n')
}

Overdrive.prototype.stat = function (stats) {
  stats.op = 'stat'
  this.info(stats)
}

module.exports = function (level, name) {
  var logStreams = [{ stream: process.stderr, level: level }]
  name = name || 'fxa-auth-server'

  var log = new Overdrive(
    {
      name: name,
      streams: logStreams
    }
  )

  process.stdout.on(
    'error',
    function (err) {
      if (err.code === 'EPIPE') {
        log.emit('error', err)
      }
    }
  )

  Object.keys(console).forEach(
    function (key) {
      console[key] = function () {
        var json = { op: 'console', message: util.format.apply(null, arguments) }
        if(log[key]) {
          log[key](json)
        }
        else {
          log.warn(json)
        }
      }
    }
  )

  return log
}
