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
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
});

const images = require('./public/javascripts/images')
// Set some defaults (required if your JSON file is empty)
// db.defaults({ users:[{name:'adam', username:'adam', password:1234, id:1, data: [{"name": "a","type": "shirt","color": "Blue","image": "shirt.jpeg","id": "1581913227641"},{"name": "Jeans","type": "shirt","color": "Blue","image": "shirt.jpeg","id": "1581913980798"}]}] })
//    .write()
console.log("Image path: "+path.join(__dirname,'images'));
let users = db.collection('users');

users.doc("xjEsI36jVTcK238fGI9g").set({
  name:'adam',
  username:'adam',
  password:1234,
  data: [{"name": "a","type": "shirt","color": "Blue","image": "shirt.jpeg","id": "1581913227641"},{"name": "Jeans","type": "shirt","color": "Blue","image": "shirt.jpeg","id": "1581913980798"}]
}).then(() => {
  users.doc("xjEsI36jVTcK238fGI9g").update({id:"xjEsI36jVTcK238fGI9g"});
  console.log("default set");
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
         console.log('Error getting user', err);
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

      }).catch(err => {
          console.log("Error getting user", err);
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

   users.where('username', '==', user.username).get().then(snapshot => {
      if (snapshot.empty) {
         done(null, null);
         console.log("Error finding user")
      }
      snapshot.forEach(doc => {
         done(null, doc.id);
         console.log("User: "+doc.id+" has been found")
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

async function read(user) {
	//get the user and return the data by searching with user id
  const doc = await users.doc(user.id).get();

  if (!doc.exists) {
      console.log("The user " + user.username + " has not been found");
  }
  return doc.data().data;
}

function save(user, obj) {
  console.log("data to be updated: ", obj);
	users.doc(user.id).update({data:obj});
}

// Use application-level middleware for common functionality, including
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({ secret: 'keyboard cat', resave: false, saveUninitialized: false }));

// Initialize Passport and restore authentication state, if any, from the
// session.
app.use(passport.initialize());
app.use(passport.session());

// Routes

//app.use(express.urlencoded());

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
        users.doc(ref.id).update({id:ref.id});
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

app.post('/add', images.multer.single('image'), images.uploadImage, async (req, res) => {
	var clothes = await read(req.user);
  var cloth = req.body;

  if(req.file && req.file.cloudStoragePublicUrl) {
    cloth.imgUrl = req.file.cloudStoragePublicUrl;
  }

	var d = new Date();
	var id = d.getTime();
	cloth.id = id;
	clothes.push(cloth);

	// save items to file here
	save(req.user, clothes);
	res.redirect('/wardrobe');
});

app.get('/delete', async function(req,res) {
	var q = url.parse(req.url, true).query;
	var clothes = await read(req.user);
	for(i=0;i<clothes.length;i++){
		if (clothes[i].id == q.id){
			clothes.splice(i,1);
			break;
		}
	}
	save(req.user, clothes);
	res.send(clothes);
});

app.post('/edit', images.multer.single('image'), images.uploadImage, async (req, res) => {
	var clothes = await read(req.user);
  var cloth = req.body;

  if(req.file && req.file.cloudStoragePublicUrl) {
    cloth.imgUrl = req.file.cloudStoragePublicUrl;
  }

	for(i=0;i<clothes.length;i++){
		if(clothes[i].id == cloth.id){
			clothes[i] = cloth;
		}
	}

	save(req.user, clothes);
	res.redirect('/wardrobe');
});
app.get('/view', require('connect-ensure-login').ensureLoggedIn() , async function (req, res) {

  const user = await read(req.user);

	res.send(user);
});

app.use('/page', express.static(path.join(__dirname, 'public')));
app.listen(process.env.PORT, () => console.log(`Example app listening on port ` + process.env.PORT + `!`));
