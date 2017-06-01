const path = require('path')
require('dotenv').config()

const config = {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  db: process.env.DB_NAME
}

const express = require('express')
const passport = require('passport')
const flash = require('connect-flash')
const bodyParser = require('body-parser')
const { Strategy: LocalStrategy } = require('passport-local')

const r = require('rethinkdb')
require('rethinkdb-init')(r)
const app = express()

app.use(require('morgan')('combined'))
app.use(require('cookie-parser')())
app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json())
app.use(
  require('express-session')({
    secret: process.env.ESESSION_SECRET,
    resave: false,
    saveUninitialized: false
  })
)

// Initialize Passport and restore authentication state, if any, from the
// session.
app.use(passport.initialize())
app.use(passport.session())
app.use(flash())

app.set('views', path.join(__dirname, '/views'))
app.set('view engine', 'pug')

// Setup our db so we can get started
r
  .init(config, [
    {
      name: 'users',
      primaryKey: 'username'
    }
  ])
  .then(conn => {
    r.conn = conn
  })

// Setup PassportJS local authentication strategy
passport.use(new LocalStrategy(require('./utils/local-strategy')(r, config.db)))

// Provide a user serialization method
passport.serializeUser(function (user, done) {
  done(null, user.id)
})

// Deserialize the user: Get the record from the db and return it
passport.deserializeUser(function (id, done) {
  r
    .db(config.db)
    .table('users')
    .filter(r.row('id').eq(id))
    .run(r.conn)
    .then(user => {
      if (!user) return done(null, false)
      return user.toArray()
    })
    .then(res => done(null, res[0]))
    .error(e => {
      throw e
    })
    .catch(e => {
      throw e
    })
})

// Utility function to validate authentication has taken place
function ensureAuthenticated (req, res, next) {
  if (req.isAuthenticated()) return next()
  if (req.method === 'GET') req.session.returnTo = req.originalUrl
  res.redirect('/')
}

// Setup the views
app.get('/', function (req, res) {
  res.render('index', { authed: req.isAuthenticated() })
})

app.get('/secret', ensureAuthenticated, function (req, res) {
  res.render('secret', { authed: req.isAuthenticated() })
})

app.get('/logout', function (req, res) {
  req.logout()
  res.redirect('/')
})

app.post(
  '/login',
  passport.authenticate('local', { failureRedirect: '/' }),
  function (req, res) {
    res.redirect('/secret')
  }
)

app.listen(4000, function () {
  console.log('node-passportjs-rethinkdb-local example listening on port 4000!')
})
