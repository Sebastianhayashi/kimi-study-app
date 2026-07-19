# Kimi Study

上传一本书，Kimi Code（K2.7 Coding + teach skill）在后台把它拆成一系列互动课件，并在课程页提供有记忆的学习助教。

## 启动

```bash
npm install
node server.js   # → http://localhost:3000
```

前提：本机已安装并登录 `kimi` CLI（`kimi login`）。

## 结构

- `public/` — 三个冻结的前端原型（`index.html` 落地页 / `app.html` 书架 / `course.html` 课程工作区），字节级原样，服务端输出时注入 `glue.js`
- `public/glue.js` — 唯一的接线层：真实上传、进度轮询、课节加载、助教问答
- `skills/teach/` — teach skill 原样（来自 github.com/mattpocock/skills）
- `server.js` — 唯一的后端：静态页 + 课程 API + kimi 子进程管理
- `data/courses/<id>/` — 每门课一个 kimi 工作区（原书 + teach 产物 + lessons/）

## 用户旅程

`/` 落地页 → `/app` 书架 → 上传材料（pdf/epub/md/txt）→ 进度轮询（上传 → 理解 → 大纲）→ `/course/<id>` 课程工作区：课节 iframe、下一课生成、Kimi 助教（`-c` 继续会话，保留教学上下文）。

## 部署

同一套代码扔到服务器，`kimi login` 后 `PORT=80 node server.js` 即可（建议放 pm2/systemd 后面）。模型固定 `kimi-code/kimi-for-coding`，在 `server.js` 顶部可改。
