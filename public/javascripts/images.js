const {Storage} = require('@google-cloud/storage');
const storage = new Storage({keyFilename:process.env.GOOGLE_APPLICATION_CREDENTIALS});
const bucket = storage.bucket(process.env.BUCKET);
const Multer = require('multer');
const sharp = require('sharp');
const path = require('path');

function getPublicUrl(filename) {
  return `https://storage.googleapis.com/` + process.env.BUCKET + `/${filename}`;
}

function uploadImage(req, res, next) {
  if (!req.file) {
    return next();
  }
  var date = new Date();
  const name = date.getTime() + req.file.originalname;
  const file = bucket.file(name);

  const stream = file.createWriteStream({
    metadata: {
      contentType: req.file.mimetype,
    },
    resumable: false,
  });

  stream.on('error', err => {
    req.file.cloudStorageError = err;
    next(err);
  });

  stream.on('finish', async () => {
    req.file.cloudStorageObject = name;
    await file.makePublic();
    req.file.cloudStoragePublicUrl = getPublicUrl(name);
    next();
  });

  stream.end(req.file.buffer);
}

async function crop(obj, cb){
    var imageurl = obj.imgUrl;
    var nameparse = imageurl.split('/');
    var name = nameparse[nameparse.length - 1 ];
    console.log("Name of the orig file: " , name);
    var fileparse = imageurl.split('.');
    var fileFormat = fileparse[fileparse.length - 1];
    console.log("File Format:" , fileFormat);
    var date = new Date();
    var newname = obj.id + '_' + date.getTime() + '.' + fileFormat;
    console.log("Name of the proc file: ", newname);

    var readFile = bucket.file(name);
    var writeFile =  bucket.file(newname);

    var sx = obj.bounding_box.x0;
    var sy = obj.bounding_box.y0;
    var swidth = obj.bounding_box.x1 - obj.bounding_box.x0;
    var sheight = obj.bounding_box.y1 - obj.bounding_box.y0;
    var out;

    // var dx = canvas.width / 2 - destwidth / 2;
    // var dy = canvas.height / 2 - destheight / 2;

    //crop image to bounding box using sharp


    const cropImage =
        sharp()
            .extract({left: sx, top: sy, width: swidth, height: sheight})
            .resize(100, 100, {
                fit: sharp.fit.inside,
                withoutEnlargement: true
            })
            .toFormat(fileFormat);

    //create Read Stream
    readFile.createReadStream()
        .on('error', function(err) {})
        .on('response', function(response) {
            // Server connected and responded with the specified status and headers.
            console.log("Connected");
        })
        .on('end', function() {
            // The file is fully downloaded.
            console.log("File read");
        })
        .pipe(cropImage)
        .pipe(writeFile.createWriteStream())
          .on('error', function(err) {})
          .on('finish', async function() {
            // The file upload is complete.
            console.log("File uploaded");
            await writeFile.makePublic();
            out = getPublicUrl(newname);
            console.log("URL after cropping:", out);
            cb(out);
          });
}

const multer = Multer({
  storage: Multer.MemoryStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // no larger than 5mb
  },
});


module.exports = {
  getPublicUrl,
  uploadImage,
  crop,
  multer
}
