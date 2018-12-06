const Router = require('koa-router');
const fUser = require('./controllers/frontend/user.js');

const router = new Router();
const apiFrontendRouter = new Router();

apiFrontendRouter.prefix('/api/f');
apiFrontendRouter.use('/user', fUser.routes());
apiFrontendRouter.use('/user/auth', global.userAuth.router.routes());

router
  .get('/', (ctx) => { ctx.body = `it's works!`; })
  .use(apiFrontendRouter.routes());

module.exports = router;
