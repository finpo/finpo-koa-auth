const Koa = require('koa');
const consola = require('consola');
const bodyParser = require('koa-bodyparser');
const cors = require('@koa/cors');
const dbConfigs = require('./configs/db.js');
const mongoose = require('mongoose');
const error = require('koa-json-error');
const Auth = require('../src/index.js');
const User = require('./models/user.js');
const nodemailer = require('nodemailer');
const mailConfig = require('./configs/mail.js');
const _ = require('lodash');

const transporter = nodemailer.createTransport({
  host: mailConfig.smtp.host,
  port: mailConfig.smtp.port,
  auth: {
    user: mailConfig.smtp.auth.user,
    pass: mailConfig.smtp.auth.pass,
  },
});

const userAuth = new Auth({
  model: User,
  mongoose,
  sendMail: (mail) => {
    transporter.sendMail(_.merge(mail,  {
      from: 'noreply@finpo.com.tw',
    })).then((a)=> { console.log(a);}, (b) => { console.log(b);});
  },
  emailAuth: true,
  frontendURL: 'http://127.0.0.1/auth/emailtoken/',
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
