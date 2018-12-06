const Router = require('koa-router');
const router = new Router();

router.get('/', global.userAuth.verifyToken, ctx => {
  // 取得自己的會員資料
});

router.put('/', ctx => {
  // 更新會員資料
});


module.exports = router;
