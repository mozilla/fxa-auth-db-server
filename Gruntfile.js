/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

module.exports = function (grunt) {

  require('load-grunt-tasks')(grunt);

  grunt.initConfig({
    copyright: {
      files: [
        "*.js",
        "{bin,db}/*.js"
      ],
      options: {
        pattern: "This Source Code Form is subject to the terms of the Mozilla Public"
      }
    },
    jshint: {
      files: [
        "*.{js,json}",
        "{bin,db}/*.{js,json}"
      ],
      options: {
        jshintrc: ".jshintrc"
      }
    }
  });

  grunt.registerTask('default', ['jshint', 'copyright']);
};
