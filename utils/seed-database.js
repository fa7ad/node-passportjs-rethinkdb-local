require('dotenv').config()

const bcrypt = require('bcrypt-nodejs')
const r = require('rethinkdb')
require('rethinkdb-init')(r)

r
  .init(
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    db: process.env.DB_NAME
  },
  [
    {
      name: 'users',
      primaryKey: 'username'
    }
  ]
  )
  .then(conn => {
    r
      .db(process.env.DB_NAME)
      .table('users')
      .insert({
        username: 'admin',
        password: bcrypt.hashSync('password'),
        roll: 0
      })
      .run(conn)
      .then(() => {
        console.log('All Done!')
        process.exit(0)
      })
      .error(e => {
        console.log(e)
        process.exit(1 + Math.ceil(Math.random() * 10))
      })
  })
  .error(e => {
    console.log(e)
    process.exit(1 + Math.ceil(Math.random() * 10))
  })
