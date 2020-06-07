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
const Algorithmia = require("algorithmia");

const db = new Firestore({
  projectId: 'plasma-geode-271605',
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
});

const images = require("./public/javascripts/images.js");

var pending = false;
// Set some defaults (required if your JSON file is empty)
// db.defaults({ users:[{name:'adam', username:'adam', password:1234, id:1, data: [{"name": "a","type": "shirt","color": "Blue","image": "shirt.jpeg","id": "1581913227641"},{"name": "Jeans","type": "shirt","color": "Blue","image": "shirt.jpeg","id": "1581913980798"}]}] })
//    .write()
//console.log("Image path: "+path.join(__dirname,'images'));
let users = db.collection('users');

// users.doc("xjEsI36jVTcK238fGI9g").set({
//   name:'adam',
//   username:'adam',
//   password:1234,
//   data: [{"name": "a","type": "shirt","color": "Blue","image": "shirt.jpeg","id": "1581913227641"},{"name": "Jeans","type": "shirt","color": "Blue","image": "shirt.jpeg","id": "1581913980798"}]
// }).then(() => {
//   users.doc("xjEsI36jVTcK238fGI9g").update({id:"xjEsI36jVTcK238fGI9g"});
//   console.log("default set");
// });


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
         //console.log('Error getting user', err);
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
  //console.log("data to be updated: ", obj);
	users.doc(user.id).update({data:obj});
    console.log("Saved something");
}

async function update(id, user, obj) {
    var data = await read(user);


    for (i=0 ; i<data.length ; i++){
        if (data[i].id == id){
            data[i] = obj;

        }
    }
    save(user, data);
}

function genId () {

    id = Math.random().toString(36).substr(2, 9);

    return id.toString();
}

function prefrences(data, color) {
    var output =[];
    var clothing = {
        tops:["t-shirt","tank top", 'button down shirt', 'blouse', 'casual dress', 'formal dress', 'sweater dress', 'rompers', 'jumpsuit'],
        bottoms:['jeans', 'leggings', 'pants casual','sweatpants', 'shorts', 'pants suit formal',],
        shoes:[],
        outerwear:[],
        underwear:[],
        accessories:[]
    };
    data.forEach((item, i) => {
        if(item.color == color);
    });

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
    //console.log(res.statusCode);
    const q = url.parse(req.url, true).query;
    if (q.manual == "true") {
        res.sendFile('./clothes.html', options, function(err){
            if (err) throw err;
        });
    }else {
        //console.log(res.statusCode);
        res.type('html');
        res.setHeader('Location', '/wardrobe');
        res.sendFile('./autoclothes.html', options, function(err){
            if (err) throw err;
        });
    }
});

app.get('/prefrences', require('connect-ensure-login').ensureLoggedIn(), (req,res) => {
  res.sendFile('./prefrences.html', options, function(err){
  		if (err) throw err;
  });
});

app.get('/clear', require('connect-ensure-login').ensureLoggedIn(), async (req,res) => {
    var clothes = await read(req.user);
    clothes = [];
    save(req.user, clothes);
    res.redirect('/wardrobe');
});

app.get('/logout',
  function(req, res){
    req.logout();
    res.redirect('/');
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


app.post('/add', images.multer.single('image'), images.uploadImage, async (req, res) => {
	var clothes = await read(req.user);
    var cloth = [{}];
    var imgUrl;

    if(req.file && req.file.cloudStoragePublicUrl) {
        imgUrl = req.file.cloudStoragePublicUrl;
    }



    var inputClothes = {
       "image": imgUrl,
       "model":"large",
       "tags_only": true
    };

    cloth[0].imgUrl = imgUrl;
    cloth[0].name = "Loading...";
    cloth[0].type = "Loading...";
    cloth[0].color = {color:"Loading..."};
    var id = genId();
    cloth[0].id = id;
    clothes.push(cloth[0]);
    save(req.user, clothes);

    function out (obj) {
        //console.log("From API:", obj)
        obj.articles.forEach( (item, i) => {
            //console.log("item: ",item);
            cloth[i] = item;
            cloth[i].imgUrl = imgUrl;
            cloth[i].name = item.article_name;
            cloth[i].type = item.article_name;
            cloth[i].color = {color:"Loading..."};
            cloth[i].id = genId();

        });

        cloth.forEach((item, iterator) => {
            clothes.splice(clothes.length-1 , 1);
            //crop images to bounding boxes
            //console.log("Before crop: ", item.imgUrl);
            images.crop(item, (res) =>{
                item.imgUrl = res;
                //console.log("After crop in call back: ", item.imgUrl);

                //find color of each article
                var inputColor =  {"image": item.imgUrl};
                Algorithmia.client("simHERP2fTXQrX3Ur+e4Joow8DF1")
                  .algo("coqnitics/colordetector/0.1.1") // timeout is optional
                  .pipe(inputColor)
                  .then(function(response) {
                    var res = response.get();
                    var color;
                    var colorRatio = 0;
                    //find main color
                    res.forEach( (entity, i) => {

                        if(entity.ratio > colorRatio){
                            colorRatio = entity.ratio;
                        }
                        color = {color:entity.color_name , hex:entity.hex};
                    });

                    item.color = color;

                    //save each item to the clothes array and then save it to database
                    // if (iterator == 0){
                    //     console.log("Length of clothes:", clothes.length);
                    //     clothes[clothes.length-1] = item;
                    //     // for(var i= 0; i < clothes.length; i++){
                    //     //     if(clothes[i].id == item.id && clothes[i].name == "Loading..."){
                    //     //         clothes[i] = item;
                    //     //     }
                    //     // }
                    //
                    // }
                    // if (iterator != 0){

                    clothes.push(item);
                    //console.log("Clothes", clothes);
                    save(req.user, clothes);
                        //console.log("Clothes", i, clothes);
                    // }
                    //console.log("Last Clothing item:" , clothes[clothes.length - 1]);


                  });


            });

        });
    }

    Algorithmia.client("simHERP2fTXQrX3Ur+e4Joow8DF1")
      .algo("algorithmiahq/DeepFashion/1.3.0") // timeout is optional -> +"?timeout=3000"
      .pipe(inputClothes)
      .then(async function(response) {
        out(response.get());
        //console.log("Clothes:", clothes);

      });
     res.setHeader('Location', '/wardrobe');
     res.redirect('/wardrobe');

});

app.get('/delete', async function(req,res) {
	var q = url.parse(req.url, true).query;
    var deleteID = q.id.toString();
	var clothes = await read(req.user);

	for(var i=0;i<clothes.length;i++){
        console.log("q.id:", q.id);
        console.log("clothes[i].id:", clothes[i].id);
		if (clothes[i].id == deleteID){
			clothes.splice(i,1);
            //console.log("After deletion:",clothes);
            console.log("Successfully deleted:", q.id);
        	save(req.user, clothes);
			break;
		}
	}

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

app.post('/prefrences', async function(req, res) {

    var clothes = await read(req.user);
    //console.log(clothes);
    var output = [];
    var fndshirt = false;
    var fndpants = false;
    var form = new formidable.IncomingForm();
    form.parse(req, function (err, fields, files) {
        if (err) throw err;

        var color = fields.color;

        for(i=0; i< clothes.length ; i++){
            if( clothes[i].color == color && output.length < 3) {
                output.push(clothes[i]);
            }
        }

    res.send(output)

    });
});

app.get('/view', require('connect-ensure-login').ensureLoggedIn() , async function (req, res) {

    //console.log("request recieved");
    const user = await read(req.user);
    res.type('json');
    res.send(user);
    //console.log(res.statusCode);

});






app.use('/page', express.static(path.join(__dirname, 'public')));

module.exports = app;
