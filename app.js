const fs = require('fs');
const express = require('express');
const app = express();
const url = require('url');
const formidable = require('formidable');
const passport = require('passport');
const session = require("express-session");
const bodyParser = require("body-parser");
const path = require('path');
const LocalStrategy = require('passport-local').Strategy;
const dotenv = require('dotenv');
dotenv.config();
const Firestore = require('@google-cloud/firestore');

const db = new Firestore({
  projectId: 'plasma-geode-271605',
  keyFilename: '${process.env.GOOGLE_APPLICATION_CREDENTIALS}',
});

// Set some defaults (required if your JSON file is empty)
// db.defaults({ users:[{name:'adam', username:'adam', password:1234, id:1, data: [{"name": "a","type": "shirt","color": "Blue","image": "shirt.jpeg","id": "1581913227641"},{"name": "Jeans","type": "shirt","color": "Blue","image": "shirt.jpeg","id": "1581913980798"}]}] })
//    .write()

let users = db.collection('users');

users.add({
   name:'adam',
   username:'adam',
   password:1234,
   id:1,
   data: [{"name": "a","type": "shirt","color": "Blue","image": "shirt.jpeg","id": "1581913227641"},{"name": "Jeans","type": "shirt","color": "Blue","image": "shirt.jpeg","id": "1581913980798"}]
}).then(ref => {
   console.log("Added Default with Id: "+ ref.id);
});
// Passport

findById = function(id, cb) {
  process.nextTick(function() {
     users.doc(id).get().then(doc => {
        if(!doc.exists) {
           cb(new Error('User ' + id + ' does not exist'), null);
        } else {
           cb(null, doc.data());
        }
     }).catch(err => {
         console.log('Error getting document', err);
     });
  });
}

findByUsername = function(username, cb) {
   process.nextTick(function() {

      users.where('username', '==', username).get().then(snapshot => {
         if (snapshot.empty) {
            return cb(null, null);
         }
         snapshot.forEach(doc => {
            return cb(null, doc.data());
         });

      });

   });
}

passport.use(new LocalStrategy(

  function(username, password, done) {
    findByUsername(username , function (err, user) {

      if (err) return done(err);
      if (!user) return done(null, false, { message: 'Incorrect username.' });
      if (user.password != password) return done(null, false, { message: 'Incorrect password.' });

      return done(null, user);
    });
  }
));
// Configure Passport authenticated session persistence.
//
// In order to restore authentication state across HTTP requests, Passport needs
// to serialize users into and deserialize users out of the session.  The
// typical implementation of this is as simple as supplying the user ID when
// serializing, and querying the user record by ID from the database when
// deserializing.
passport.serializeUser(function(user, done) {
	console.log(user);
   users.where('username', '==', user.username).get().then(doc => {
      done(null, doc.id);
   });

   users.where('username', '==', username).get().then(snapshot => {
      if (snapshot.empty) {
         return cb(null, null);
      }
      snapshot.forEach(doc => {
         return cb(null, doc.data());
      });

   });

});

passport.deserializeUser(function(id, done) {
  findById(id, function (err, user) {
    if (err) { return done(err); }
    done(null, user);
  });
});


const port = 3000;
var loggedin = false;
var options = {
	root:path.join(__dirname,'public')
};
function read(user) {
	//get the user object by searching database for the same username
	var user = db.get('users').find({username:user.username}).value();
	//if the user is not found
	if (!user) {console.log("No user "+user.username+" found in db")}
	return user.data;

}

function save(user, obj) {
	var user = db.get('users').find({username:user.username}).value();
	if (!user) console.log("No user "+user.username+" found in db");
	db.get('users').find({username:user.username}).assign({data:obj}).write();
}

// Use application-level middleware for common functionality, including
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({ secret: 'keyboard cat', resave: false, saveUninitialized: false }));

// Initialize Passport and restore authentication state, if any, from the
// session.
app.use(passport.initialize());
app.use(passport.session());

// Routes

app.use(express.urlencoded());

app.get('/', function(req,res){

	res.sendFile('./welcome.html', options, function(err){
		if (err) throw err;
	});
});

app.get('/login', function(req, res){
	res.sendFile('./login.html', options, function(err){
  		if (err) throw err;
  	});
});

app.get('/register', function(req, res){
	res.sendFile('./register.html', options, function(err){
  		if (err) throw err;
  	});
});
app.get('/wardrobe', require('connect-ensure-login').ensureLoggedIn() , function(req, res){
	res.sendFile('./clothes.html', options, function(err){
  		if (err) throw err;
  	});
});
app.post('/login',
  passport.authenticate('local', { successRedirect: '/wardrobe',
                                   failureRedirect: '/login' })
);
app.post('/register', function(req, res){
	 var form = new formidable.IncomingForm();
	 form.parse(req, function (err, fields, files) {
	 	if (err) throw err;
      fields.data = [];
      users.add(fields).then(ref => {
         console.log("Added user: "+ ref.id);
      });
		res.redirect('/login');
	});
});
app.get('/logout',
  function(req, res){
    req.logout();
    res.redirect('/');
 });

app.post('/add', function (req, res) {
	var clothes = read(req.user);
	console.log("clothes:" + clothes);
	var form = new formidable.IncomingForm();
	form.parse(req, function (err, fields, files) {
	  	// console.log(fields);
	  	// console.log(files);

	  	// move file to /public
		var oldpth = files.image.path;
		var newpth = "/home/adam_malyshev/fitfinder/public/images" + files.image.name;
		console.log(oldpth);
		fs.rename(oldpth, newpth, function (err){
			if (err) throw err;
		});
		var cloth = fields;
		cloth.image = files.image.name;
		var d = new Date();
		var id = d.getTime();
		cloth.id = id;
		clothes.push(cloth);
		console.log(clothes);
		// save items to file here

		save(req.user, clothes);

		res.redirect('/wardrobe');
	});
});

app.get('/delete', function(req,res) {
	var q = url.parse(req.url, true).query;
	var clothes = read(req.user);
	for(i=0;i<clothes.length;i++){
		if (clothes[i].id == q.id){
			clothes.splice(i,1);
			break;
		}
	}
	save(req.user, clothes);
	res.send(clothes);
});

app.post('/edit', function(req,res){
	var form = new formidable.IncomingForm();
   form.parse(req, function (err, fields, files) {
		//save new image, replace old one
		var clothes = read(req.user);
		var oldpth = files.image.path;
		var newpth = "/Users/adam/projects/js/wardrobe/public/images/" + files.image.name;
		console.log(oldpth);
		fs.rename(oldpth, newpth, function (err){
			if (err) throw err;
		});

		var cloth = fields;
		cloth.image = files.image.name;
		var q = url.parse(req.url, true).query;
		cloth.id = q.id;
		console.log(cloth);
		console.log(req.url);
		for(i=0;i<clothes.length;i++){
			if(clothes[i].id == cloth.id){
				clothes[i] = cloth;
			}
		}
		save(req.user, clothes);
		res.redirect('/wardrobe');
	});
});
app.get('/view', require('connect-ensure-login').ensureLoggedIn() , function (req, res) {
	console.log("user: ",req.user);
	res.send(read(req.user));
});

app.use('/page', express.static(path.join(__dirname, 'public')));
app.listen(port, () => console.log(`Example app listening on port ${port}!`));
