Firefox Accounts DB Server
==========================

[![Build Status](https://travis-ci.org/mozilla/fxa-auth-db-server.svg?branch=master)](https://travis-ci.org/mozilla/fxa-auth-db-server)

This project implements a DB backend using MySql. It is accessible via HTTP which the
[fxa-auth-server](https://github.com/mozilla/fxa-auth-server/) will use. Currently a work in progress.

Note: Since this project is a work in progress, these instructions are also a WIP.

## Prerequisites

* node 0.10.x or higher
* npm
* mysql

## Configuration ##

In `config/config.js` you can see a set of defaults for various config options. Go take a look and
then create a new local file called `config/local.js`. This will contain a set of values to override
the defaults. For example, if you have a password set for your MySql `root` user, you might try
something like this:

```json
{
  "master": {
    "user": "root",
    "password": "mysecret1"
  },
  "slave": {
    "user": "root",
    "password": "mysecret2"
  }
}
```

## Creating the Database ##

Once you have your config in place, you can create and patch the database using the
`db_patcher.js` command. Try this:

```sh
CONFIG_FILES=config/local.json node bin/db_patcher.js
```

This should create the database (if it doesn't yet exist), and apply each patch located
in `db/schema/*.sql` in the correct order. If this command fails and can't connect to the
database, please check your mysql configuration and connectivity on the command line.

## Starting the Server ##

Once the database has been created and patched, you can start the server:

```sh
CONFIG_FILES=config/local.json npm start
```

Once this has started up, it will be listening on `locahost:8000` (or whatever port you have
configured in your local config file).

## Cleanup

You may want to clear the data from the database periodically. You can just drop the database
but make sure there is nothing in it that you want to keep:

```sh
mysql -u root -p -e 'DROP DATABASE fxa'
```

The server will automatically re-create it on next use.

## License

MPL 2.0
