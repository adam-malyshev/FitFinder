const expect = require('chai').expect;
const request = require('supertest');
const app = require('../app');

const userCredentials = {
  username: 'adam',
  password: '1234'
}
var authenticatedUser = request.agent(app);

before(function(done){
  authenticatedUser
    .post('/login')
    .set('Accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9')
    .set('Content-Type', 'application/x-www-form-urlencoded')
    .send('username=adam&password=1234')
    .end(function(err, response){
      expect(response.statusCode).to.equal(302);
      expect('Location', '/wardrobe');
      done();
    });
});


describe('GET /login', function(){
    it('responds with no errors',
    function(done) {
        request(app).get('/login')
        // .expect('location', '/')
        .expect(200, done);
    });
});

// describe('POST /login', function(){
//     let Cookies;
//     it('should auth and create user session for valid user',
//     function(done) {
//         request(app)
//         .post('/login')
//         .set('Accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9')
//         .set('Content-Type', 'application/x-www-form-urlencoded')
//         .send('username=adam2&password=1234')
//         .expect(302)
//         .then((res) => {
//             // Save the cookie to use it later to retrieve the session
//             // console.log(res.headers);
//             //Cookies = res.headers['set-cookie'].pop().split(';')[0];
//             done();
//       });
//     });
// });


describe('GET /wardrobe', function(done){
    it('access /wardrobe page',
    function(done){
        authenticatedUser.get('/wardrobe')
        .expect('Content-Type', "text/html; charset=utf-8")
        .expect('Location', '/wardrobe')
        .expect(200,done);
    });

    it('should return a 302 response and redirect to /login',
    function(done){
        request(app).get('/wardrobe')
        .expect('location', '/login')
        .expect(302, done);
    });
});



describe('GET /view', function(done){
    it('access clothes', function(done){
authenticatedUser.get('/view')
            .expect('Content-Type', /json/)
            .expect(200, done);
    });
});




describe('POST /add', function(done){
    this.timeout(100000);
    var oldClothes;
    it('gets clothes', function(done){
        authenticatedUser.get('/view')
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200)
        .end((err, res)=>{
            if(err) return done(err);
            oldClothes = res.body;
            done();
        });

    });
    it('post clothing through /add ',
    function(done){
        authenticatedUser.post('/add')
        .attach('image', '/Users/adammalyshev/Downloads/IMG_6041.JPG')
        .expect('Location', '/wardrobe')
        .expect(302, done);
    });
    it('posted new clothing', function(done){
    authenticatedUser.get('/view')
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200)
        .then((response) => {
            setTimeout(function(){
                var newClothes= response.body;
                expect(newClothes.length > oldClothes.length).to.be.true;
                return done();
            }, 60000);
        })
    });
});

describe('GET /delete', function(done){
    this.timeout(4000);
    var oldclothes = [{id:0}];
    var lastoldclothes;
    var id;
    var url;
    it('accesses clothes', function(done){
authenticatedUser.get('/view')
            .expect('Content-Type', /json/)
            .expect(200)
            .end((err, res) => {
                if (err) return done(err);
                oldclothes = res.body;
                console.log("CLOTHES:",oldclothes);
                lastoldclothes = oldclothes.length - 1;
                id = oldclothes[lastoldclothes].id;
                url = '/delete?id=' + id.toString();
                done();
            });
    });
    setTimeout(function(){
        it('deletes last item', function(done){
    authenticatedUser.get(url)
                .expect('Content-Type', /json/)
                .expect(200)
                .end((err, res) => {
                    setTimeout(function(){
                        if (err) return done(err);
                        console.log("INCOMING:", res.body);
                        expect(res.body.length == lastoldclothes).to.be.true;
                        done();
                    }, 1000);
                });
        });
    }, 2000);



});

describe('GET /clear', function(done){
    it('clears all clothes', function(done){
authenticatedUser.get('/clear')
            .expect('Location', '/wardrobe')
            .expect(302,done);
    });

});
