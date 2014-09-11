var test = require('../ptaptest')

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
          'teardown',
          function (t) {
            return db.close()
          }
        )

      }
    )
}
