var config = require('./config');

var express = require('express');
var bodyParser = require('body-parser');
var flash = require('connect-flash');
var bcrypt = require('bcrypt-nodejs');
var passport = require('passport');
var local = require('passport-local').Strategy;
var r = require('rethinkdb');
var app = express();

app.use(require('morgan')('combined'));
app.use(require('cookie-parser')());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(require('express-session')({ secret: 'love_the_codez', resave: false, saveUninitialized: false }));

// Initialize Passport and restore authentication state, if any, from the
// session.
app.use(passport.initialize());
app.use(passport.session());
app.use(flash());

app.set('views', __dirname + '/views');
app.set('view engine', 'jade');

// Setup our db so we can get started
setupDatabase();

// Setup PassportJS local authentication strategy
passport.use(new local(
  function(username, password, done) {
    r.db(config.database).table('users').filter(r.row('username').eq(username)).run(connection, function (err, user) {
      if (err) { return done(err); }
      if (!user) { return done(null, false); }

      user.toArray(function(err, result) {
          if (err) throw err;
          if (result.length == 0) { return done(null, false); }
          if (!bcrypt.compareSync(password, result[0].password)) { return done(null, false); }
          return done(null, result[0]);
      });
    });
  }
));

// Provide a user serialization method
passport.serializeUser(function(user, done) {
  done(null, user.id);
});

// Deserialize the user: Get the record from the db and return it
passport.deserializeUser(function (id, done) {
  r.db(config.database).table('users').filter(r.row('id').eq(id)).run(connection, function(err, user) {
    if (err) { return done(err); }
    if (!user) { return done(null, false); }
    user.toArray(function(err, result) {
        if (err) throw err;
        return done(null, result[0]);
    });
  });
});

// Utility function to validate authentication has taken place
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) return next();
  if (req.method == 'GET') req.session.returnTo = req.originalUrl;
  res.redirect('/');
}

// Ensures a default database, table, and user are present
function setupDatabase() {
  r.connect( {host: 'localhost', port: 28015}, function(err, conn) {
      if (err) throw err;
      connection = conn;
  }).then(res => {
    r.dbCreate(config.database).run(connection, function(err, res) {
      if (err) {
        console.log('Database "' + config.database + '" Exists!');
      }
      else {
        console.log('Created database ' + config.database +'!');
      }
    });
    r.db(config.database).tableCreate('users').run(connection, function(err, res) {
      if (err) {
        console.log('Table "users" already exists!');
      }
      else {
        console.log('Created table "users"!');
      }
    });
    r.db(config.database).table('users').filter(r.row('username').eq('admin')).run(connection, function(err, res) {
      if (err) {
        console.log('error retrieving users...');
        return;
      }
      res.toArray(function(err, users) {
        if (users.length != 0) {
          console.log('User "admin" already exists!');
        }
        else {
          r.db(config.database).table('users').insert({
            username: 'admin',
            password: bcrypt.hashSync('password'),
            roll: 0
          }).run(connection, function(err, res) {
            console.log('Created default user "admin"');
          });
        }
      });
    })
  });
}

// Setup the views
app.get('/', function(req, res) {
  res.render('index', {authed: req.isAuthenticated()});
})

app.get('/secret', ensureAuthenticated, function(req, res) {
  res.render('secret', {authed: req.isAuthenticated()});
})

app.get('/logout', function(req, res){
  req.logout();
  res.redirect('/');
});

app.post('/login',
  passport.authenticate('local', { failureRedirect: '/' }),
  function(req, res) {
    res.redirect('/secret');
});

app.listen(3000, function () {
  console.log('node-passportjs-rethinkdb-local example listening on port 4000!');
});
