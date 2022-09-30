const server = require('./app.js')
const dotenv = require('dotenv');
dotenv.config();

server.listen(process.env.PORT, () => console.log(`App running on  ` + process.env.PORT + `!`));
