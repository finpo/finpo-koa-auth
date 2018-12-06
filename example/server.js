const Koa = require('koa');
const consola = require('consola');
const bodyParser = require('koa-bodyparser');
const cors = require('@koa/cors');
const dbConfigs = require('./configs/db.js');
const mongoose = require('mongoose');
const error = require('koa-json-error');
const Auth = require('../src/index.js');
const User = require('./models/user.js');
const userAuth = new Auth({
  model: User,
});
global.userAuth = userAuth;


const startServer = async () => {
  const listenPort = process.env.PORT || 3000;
  const app = new Koa();
  const router = require('./router.js');

  mongoose.connect(dbConfigs.MONGO_URL, {
    useNewUrlParser: true,
    autoReconnect: true,
    useCreateIndex: true,
  });
  mongoose.connection.once('open', () => {
    consola.success('database connected.');
  });

  const formatError = formatErr => ({
    success: false,
    code: formatErr.code,
    data: formatErr.data,
    message: formatErr.message
  });

  
  app.use(cors());
  app.use(bodyParser());
  app.use(error(formatError));
  app.use(router.routes()).use(router.allowedMethods());
  
  app.listen(listenPort);
  consola.success(`Server is listen on port: ${listenPort}`);
};

startServer();
