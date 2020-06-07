const server = require('./app.js')
const dotenv = require('dotenv');
dotenv.config();

server.listen(process.env.PORT, () => console.log(`Example app listening on port ` + process.env.PORT + `!`));
