var tests = []

tests.push(require('./local/ping'))
tests.push(require('./local/db_tests'))

module.exports = tests
