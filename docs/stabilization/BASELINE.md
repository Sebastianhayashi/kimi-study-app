# 稳定化基线

## 基线提交

```text
22d70f18bbba142a452b6bf74246aff337b4551b
Apply current-main frontend shell patch (tutor markdown, rounded tools, quote chip)
```

此基线已包含：

- Lenis 课程滚动
- Kimi Wire / stream-json 生成事件
- 生成动画与进度展示
- Source Viewer（PDF、EPUB、文本、HTML、图片）
- Margin Notes、Study Cards、Activity Runtime
- Tutor Markdown 和圆角课节工具栏

## 捕获命令

```bash
npm run stabilization:baseline
```

命令将执行：

```text
npm run check
npm test
```

并将以下信息写入 `.stabilization/baseline.json`：

- Git commit 和 branch
- 工作区是否有未提交修改
- Node、npm、操作系统和架构
- `npm run check` 结果
- `npm test` 结果
- 命令耗时和输出尾部

## 基线操作规程

1. 开始稳定化工作前，工作区必须干净。
2. 运行 `npm ci`。
3. 运行 `npm run stabilization:baseline`。
4. 将失败输出保存到问题台账。
5. 不在基线采集期间修改业务代码。

## 后续浏览器基线

Phase 3 建立 Playwright 后，基线还会包含：

- Chromium、Firefox、WebKit 版本
- 失败截图、视频和 Trace
- 浏览器 Console Error
- 未预期的 4xx/5xx
- 视觉回归基准版本
