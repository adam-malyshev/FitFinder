const {Storage} = require('@google-cloud/storage');
const storage = new Storage({keyFilename:process.env.GOOGLE_APPLICATION_CREDENTIALS});
const bucket = storage.bucket(process.env.BUCKET);
const Multer = require('Multer');


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


const multer = Multer({
  storage: Multer.MemoryStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // no larger than 5mb
  },
});


module.exports = {
  getPublicUrl,
  uploadImage,
  multer
}
