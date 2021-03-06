const _ = require('lodash');
const fs = require('fs');
const path = require('path');
const Router = require('koa-router');
const bcrypt = require('bcrypt');
const to = require('await-to-js').to;
const moment = require('moment');
const GeneratePassword = require('generate-password');
const CryptoJS = require('crypto-js');
const jwt = require('jsonwebtoken');
const authSchema = require('./schema.js');
const pug = require('pug');

let mongoose;


function Auth (opt) {
  const defaultOptions = {
    tokenSecretCert: fs.readFileSync(path.resolve(`${__dirname}/tokensecret.cert`)).toString(),
    AESsecret: '9&B73S$cGDGewBrPZDJN',
    expiresIn: '1d',
    floodProtection: 30,
    tempPasswordExpiredHours: 25,
    resetPasswordTemplate: path.resolve(`${__dirname}/resetpassword.pug`),
    resetPasswordSubject: '密碼重設信',
    emailAuthTemplate: path.resolve(`${__dirname}/emailauth.pug`),
    emailAuthSubject: '帳號認證信',
    signupFields: [],
    emailAuth: false,
    frontendURL: '',
  };
  
  if (_.isEmpty(opt.mongoose)) {
    throw Error('property mongoose is required');
  }
  if (_.isEmpty(opt.model)) {
    throw Error('property model is required');
  }
  if (!_.isFunction(opt.sendMail)) {
    throw Error('property sendMail is required');
  }
  const options = _.assign(defaultOptions, opt);
  mongoose = options.mongoose;
  if (_.get(options, 'model.prototype') instanceof mongoose.Model === false) {
    throw Error('model property must be mongoose.Model');
  }
  const modelName = options.model.modelName;
  const extendSchema = new mongoose.Schema(Object.assign({}, opt.model.schema.obj, authSchema));
  mongoose.deleteModel(modelName);
  const User = mongoose.model(modelName, new mongoose.Schema(extendSchema));

  this.verifyToken = async (ctx, next) => {
    const token = _.chain(ctx).result('request.header.authorization').split(' ').get(1).value();
    if (!token) {
      ctx.throw({ message: 'token require' });
    }
    const verify = jwt.verify(token, options.tokenSecretCert);
    const [err, user] = await to(User.findOne({
      _id: verify.user,
      'authLog._id': verify.authLog, 
    }, { 'authLog.$': 1, emailAuth: 1 }));
    if (options.emailAuth && user.emailAuth !== true) {
      ctx.throw({ message: 'email not auth yet' });
    }
    if (_.chain(user).result('authLog[0].signout').isEmpty().value()) {
      ctx.auth = verify;
    } else {
      ctx.throw({ message: 'token signout' });
    }
    await next();
  };

  this.verifyJWT = async (token) => {
    const verify = jwt.verify(token, options.tokenSecretCert);
    const [err, user] = await to(User.findOne({
      _id: verify.user,
      'authLog._id': verify.authLog, 
    }, { 'authLog.$': 1, emailAuth: 1 }));
    if (_.chain(user).result('authLog[0].signout').isEmpty().value()) {
      return verify;
    } else {
      throw { message: 'token signout' };
    }
  };

  const decryptPassword = (password) => {
    return CryptoJS.AES.decrypt(password, options.AESsecret).toString(CryptoJS.enc.Utf8);
  };
  const createToken = (payload) => {
    return jwt.sign(payload, options.tokenSecretCert, { expiresIn: options.expiresIn });
  };
  const router = new Router();

  // 註冊
  router.post('/', async ctx => {
    const body = ctx.request.body;
    const password = decryptPassword(body.password);
    if (!password) {
      ctx.throw({ message: '密碼需使用 CryptoJS AES 加密傳送' });
    }
    body.passwordHash = await bcrypt.hash(password, 10);
    const [err, user] = await to(User.create(_.pick(body, _.concat(options.signupFields, [
      'email',
      'passwordHash',
    ]))));
    if (err) {
      ctx.throw({
        data: err,
        message: '新增使用者錯誤',
      });
    }
    user.passwordHash = undefined;
    ctx.body = {
      success: true,
      data: user,
    };
  });

  // 索取電子郵件驗證
  router.post('/email', async (ctx) => {
    if (options.emailAuth !== true) {
      ctx.throw({ message: '沒有開啟郵件認證功能' });
    }
    const token = _.chain(ctx).result('request.header.authorization').split(' ').get(1).value();
    if (!token) {
      ctx.throw({ message: 'token require' });
    }
    const verify = jwt.verify(token, options.tokenSecretCert);
    if (!verify) {
      ctx.throw({ message: 'token 編碼錯誤' });
    }
    const [err, user] = await to(User.findOne({
      _id: verify.user,
      'authLog._id': verify.authLog, 
    }, { 'authLog.$': 1, 'email': 1, 'emailAuth': 1 }));
    console.log(user.emailAuth);
    if (user.emailAuth === true) {
      ctx.throw({ message: 'email 已經驗證過' });
    }
    user.emailAuth = GeneratePassword.generate({
      length: 40,
      numbers: true,
    });
    const authToken = jwt.sign({
      authToken: user.emailAuth,
      user: user._id,
    }, options.tokenSecretCert, { expiresIn: options.expiresIn });
    user.save();
    const html = pug.renderFile(options.emailAuthTemplate, { authToken, frontendURL: options.frontendURL });
    options.sendMail({
      html,
      to: user.email,
      subject: options.emailAuthSubject,
    });
    ctx.body = { success: true };
  });

  // 使用驗證碼驗證電子郵件
  router.put('/email', async (ctx) => {
    const token = ctx.request.body.token;
    if (!token) {
      ctx.throw({ message: 'token require' });
    }
    const verify = jwt.verify(token, options.tokenSecretCert);
    const [err, user] = await to(User.findOne({ _id: verify.user }));
    if (user.emailAuth === true) {
      ctx.throw({ message: '電子郵件已驗證' });
    }
    if (user.emailAuth !== verify.authToken) {
      ctx.throw({ message: '驗證碼錯誤' });
    }
    user.emailAuth = true;
    user.save();
    ctx.body = { success: true, message: '電子郵件驗證完成' };
  });

  // 重設密碼
  router.post('/reset_password', this.verifyToken, async ctx => {
    const [err, user] = await to(User.findById(ctx.auth.user, '+passwordHash +tempPassword'));
    if (err) {
      ctx.throw(err);
    }
    const oldPassword = decryptPassword(ctx.request.body.oldPassword);
    const newPassword = decryptPassword(ctx.request.body.newPassword);
    if (_.isEmpty(oldPassword) || _.isEmpty(newPassword)) {
      ctx.throw({ message: '密碼需使用 CryptoJS AES 加密傳送' });
    }
    const passwordCompare = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!passwordCompare) {
      if (_.isEmpty(user.tempPassword)) {
        ctx.throw({ message: '舊密碼錯誤' });
      } else {
        const tempPasswordCompare = await bcrypt.compare(oldPassword, user.tempPassword.hash);
        if (!tempPasswordCompare) {
          ctx.throw({ message: '舊密碼錯誤' });
        }
      }
    }
    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await user.save();
    ctx.body = { success: true };
  });
  
  // 使用者登入
  router.put('/', async ctx => {
    const body = ctx.request.body;
    const password = decryptPassword(body.password);
    if (!password) {
      ctx.throw({ message: '密碼需使用 CryptoJS AES 加密傳送' });
    }
    const [ err, user ] = await to(User.findOne({ email: body.email }, '+passwordHash +tempPassword'));
    if (err) {
      ctx.throw({ data: err, message: '查詢發生錯誤' });
    }
    if (!user) {
      ctx.throw({ message: '找不到該帳號' });
    }
    const result = await bcrypt.compare(password, user.passwordHash);
    if (!result && _.isEmpty(user.tempPassword)) {
      ctx.throw({ message: '密碼錯誤' });
    }
    if (!result && !_.isEmpty(user.tempPassword)) {
      if (moment().isAfter(moment(user.tempPassword.expired))) {
        ctx.throw({ message: '臨時密碼過期' });
      }
      const tempCompareResult = await bcrypt.compare(password, user.tempPassword.hash);
      if (!tempCompareResult) {
        ctx.throw({ message: '密碼錯誤' });
      }
    }
    const authLog = await (new User()).authLog.create({
      // 補 UA 與 IP
    });
    await User.updateOne({ _id: user._id }, {
      $push: {
        authLog,
      },
    });
    // 產生 token
    const token = createToken({
      user: user._id,
      authLog: authLog._id,
    });
    ctx.body = {
      success: true,
      token,
    };
  
  });
  
  // 使用者登出
  router.delete('/', this.verifyToken, async ctx => {
    const verify = ctx.auth;
    const [err, user] = await to(User.findOneAndUpdate({
      _id: verify.user,
      'authLog._id': ctx.request.body.authLog || verify.authLog, 
    }, { 'authLog.$.signout': { date: new Date() }}));
    ctx.body = {
      success: true,
      message: 'signout',
    };
  });
  
  // 取得臨時密碼
  router.patch('/', async ctx => {
    const floodProtection = options.floodProtection;    const [err, user] = await to(User.findOne({ email: ctx.request.body.email }, '+tempPassword'));
    if (!user) {
      ctx.throw({ message: '找不到使用者電子郵件' });
    }
    if (moment().add(floodProtection, 'minutes').isBefore(moment(_.result(user, 'tempPassword.expired')))) {
      ctx.throw({ message: `${floodProtection} 分鐘內僅可取得一次臨時密碼` });
    }
    const tempPassword = GeneratePassword.generate({
      length: 20,
      numbers: true,
    });
    const tempPasswordHash = await bcrypt.hash(tempPassword, 10);
    user.tempPassword = {
      hash: tempPasswordHash,
      expired: moment().add(options.tempPasswordExpiredHours, 'hour'),
    };
    await user.save();
    // 寄信
    const html = pug.renderFile(options.resetPasswordTemplate, { tempPassword });
    options.sendMail({
      html,
      to: user.email,
      subject: options.resetPasswordSubject,
    });
    ctx.body = { success: true };
  });

  this.router = router;
  
}


module.exports = Auth;
