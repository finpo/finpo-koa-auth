# FINPO KOA2 AUTH

## descript

登入驗證模組


## install

```bash
yarn add @finpo/finpo-koa-auth
```

## constrator

```js
// required
{
  mongoose, // mongoose framework
  model, // mongoose model
  sendMail, // send mail function
}

// optional
{
  tokenSecretCert: String, // 設定自訂 jwt 憑證
  AESsecret: String, // 密碼傳送 AES 協議鑰匙
  expiresIn: '1d', // token 有效時間
  floodProtection: 30, // 忘記密碼間隔時間
  tempPasswordExpiredHours: 25, // 臨時密碼有效期
  signupFields: ['name'], // 註冊欄位
  resetPasswordTemplate: path.resolve(`${__dirname}/resetpassword.pug`), // 信件範本路徑
  resetPasswordSubject: '密碼重設信', // 信件標題
  emailAuthTemplate: path.resolve(`${__dirname}/emailauth.pug`), // 信件範本路徑
  emailAuthSubject: '帳號認證信', // 信件標題
  frontendURL: '', // 前端連線網址
}
```

## usage
`index.js`
```js
const mongoose = require('mongoose');
const User = require('./models/user.js');

const Auth = require('@finpo/finpo-koa-auth');
const userAuth = new Auth({
  model: User,
  mongoose,
  sendMail: (mail) => {
    // mail only html and to props
    // nodemailer.send(mail);
  },
  signupFields: ['name', 'phone'],
});
global.userAuth = userAuth;
```

`router.js`
```js
const Router = require('koa-router');
const router = new Router();

router.prefix('/api/f');
// inject routes to koa-router
router.use('/user/auth', global.userAuth.router.routes());
// user verifyToken for security path
.get('/user', global.userAuth.verifyToken, (ctx) => { ctx.body = `it's works!`; })
```

`if passed auth object will inject to ctx.auth`
```js
{
  user: _id
}
```

## REST API 文件

https://rebilly.github.io/ReDoc/?url=https://raw.githubusercontent.com/finpo/finpo-koa-auth/master/docs/openapi.yml

