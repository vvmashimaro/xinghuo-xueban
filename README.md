# 星火学伴（网页端）

GitHub 仓库：网页静态站点 + 共享 API / SQLite 数据库源码。

## 在线预览（GitHub Pages）

部署启用后访问：`https://vvmashimaro.github.io/xinghuo-xueban/login.html`

演示验证码：`888888`  
家长：`13980889211`　导师：`13880123456`

## 本地网页

```bash
python3 -m http.server 8080
# http://127.0.0.1:8080/login.html
```

## 数据库

SQLite 文件：`_platform/server/data/xinghuo.db`

表：`users` / `bookings` / `sessions` / `availability` / `meta`  
已写入演示账号与已完课样例数据。

JSON 兼容库（API 用）：`_platform/server/data/db.json`  
启动 API：

```bash
cd _platform/server && npm install && npm start
# 默认 http://127.0.0.1:8787
```

## 小程序

见 `_platform/miniprogram/`，用微信开发者工具导入。
