/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

var restify = require('restify')
var P = require('../promise.js')

module.exports = function createClient(cfg) {
  var client = restify.createJsonClient(cfg)

  client.headThen = function() {
    var p = P.defer()
    var args = Array.prototype.slice.call(arguments, 0)
    args.push(function(err, req, res, obj) {
      if (err) return p.reject(err)
      p.resolve({ req: req, res: res, obj: obj })
    })
    client.head.apply(this, args)
    return p.promise
  }

  client.getThen = function() {
    var p = P.defer()
    var args = Array.prototype.slice.call(arguments, 0)
    args.push(function(err, req, res, obj) {
      if (err) return p.reject(err)
      p.resolve({ req: req, res: res, obj: obj })
    })
    client.get.apply(this, args)
    return p.promise
  }

  client.postThen = function() {
    var p = P.defer()
    var args = Array.prototype.slice.call(arguments, 0)
    args.push(function(err, req, res, obj) {
      if (err) return p.reject(err)
      p.resolve({ req: req, res: res, obj: obj })
    })
    client.post.apply(this, args)
    return p.promise
  }

  client.putThen = function() {
    var p = P.defer()
    var args = Array.prototype.slice.call(arguments, 0)
    args.push(function(err, req, res, obj) {
      if (err) return p.reject(err)
      p.resolve({ req: req, res: res, obj: obj })
    })
    client.put.apply(this, args)
    return p.promise
  }

  client.delThen = function() {
    var p = P.defer()
    var args = Array.prototype.slice.call(arguments, 0)
    args.push(function(err, req, res, obj) {
      if (err) return p.reject(err)
      p.resolve({ req: req, res: res, obj: obj })
    })
    client.del.apply(this, args)
    return p.promise
  }

  return client
}
