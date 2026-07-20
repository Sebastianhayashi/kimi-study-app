# 当前产品表面清单

本文档列出用户可见入口、主要运行边界和代码责任。它是之后 Interaction Contract 和 E2E 覆盖率的来源。

## 1. 页面与运行边界

| Surface ID | 页面/边界 | 主要职责 | 当前代码 |
|---|---|---|---|
| `landing` | `/` | 进入书架 | `public/index.html`, `public/glue.js` |
| `library` | `/app` | 上传、课程列表、归档、删除 | `public/app.html`, `public/glue.js` |
| `course-shell` | `/course/:id` | 三栏工作区、课节导航、Tutor、工具条 | `public/course.html`, `public/glue.js` |
| `lesson-frame` | iframe | 课文、划词、笔记、学习卡片、互动练习、Lenis | lesson HTML + 注入运行时 |
| `generation-overlay` | 中央课程覆盖层 | 生成动画、进度、全过程 | `generation-preview.js`, `generation-events-client.js` |
| `source-viewer` | 中央课程覆盖层 | PDF/EPUB/文本/HTML/图片阅读 | `source-viewer.js` |
| `tutor` | 右栏 | 问答、建议、引用、聊天记录 | `glue.js`, `assistant-markdown.js` |

## 2. 书架页控件

| Control ID | 名称 | 责任 |
|---|---|---|
| `library-upload-open` | 上传材料 | 打开上传入口 |
| `library-upload-file` | 文件选择/拖放 | 选择 PDF、EPUB、TXT 等材料 |
| `library-upload-submit` | 开始创建 | 创建课程并进入生成界面 |
| `library-course-open` | 课程卡 | 进入课程工作区 |
| `library-course-menu` | 更多 | 打开课程操作菜单 |
| `library-course-archive` | 归档 | 从默认列表隐藏课程 |
| `library-course-delete` | 删除 | 永久删除课程数据 |

## 3. 课程全局控件

| Control ID | 名称 | 责任 |
|---|---|---|
| `course-back` | 返回 | 回到书架 |
| `course-open-context` | 学习概览 | 展开左侧栏 |
| `course-open-assistant` | 助手 | 展开右侧 Tutor |
| `course-collapse-context` | 最小化学习上下文 | 收起左栏 |
| `course-collapse-assistant` | 最小化助手 | 收起右栏 |
| `course-tab-overview` | 学习概览 | 展示任务、进度和学习记录 |
| `course-tab-map` | 学习地图 | 展示材料理解、方法和路径 |
| `course-tab-lessons` | 课程目录 | 展示课节列表 |
| `course-lesson-item` | 课节 | 切换当前课节 |
| `course-next-lesson` | 下一课 | 触发下一课生成 |
| `course-focus` | 专注模式 | 调整工作区布局 |
| `course-fullscreen` | 全屏 | 扩大中央课程区域 |

## 4. 课节工具条

当前工具条的入口需要在后续用户旅途测试中验证是否存在概念重叠。

| Control ID | 名称 | 当前预期 |
|---|---|---|
| `lesson-task` | 任务 | 查看本课任务或相关文档 |
| `lesson-resources` | 资源 | 查看课程生成的资源摘要 |
| `lesson-success` | SUCCESS | 查看方法速查表 |
| `lesson-notes` | 笔记 | 展开/折叠课内笔记 |
| `lesson-original` | 原文 | 打开原始材料阅读器 |

待验证问题：

- “资源”和“原文”是否对普通用户有清晰区别。
- “任务”和“SUCCESS”是否属于一级高频入口。
- 窄屏时隐藏文字后，图标能否独立表达含义。

## 5. 生成覆盖层控件

| Control ID | 名称 | 责任 |
|---|---|---|
| `generation-summary` | 当前生成状态 | 只显示一条中文当前状态 |
| `generation-history-toggle` | 查看生成过程 | 展开/收起真实事件历史 |
| `generation-progress` | 进度条 | 展示由真实产物推导的单调进度 |

## 6. Source Viewer 控件

| Control ID | 名称 | 适用格式 |
|---|---|---|
| `source-close` | 返回课程 | 全部 |
| `source-select` | 切换资源 | 全部 |
| `source-toc` | 目录/结果 | PDF、EPUB、HTML |
| `source-search` | 搜索 | PDF、EPUB、文本、HTML |
| `source-prev` | 上一页/上一位置 | PDF、EPUB |
| `source-next` | 下一页/下一位置 | PDF、EPUB |
| `source-location` | 页码/位置 | PDF、EPUB |
| `source-smaller` | 缩小/减小字体 | PDF、EPUB、文本 |
| `source-larger` | 放大/增大字体 | PDF、EPUB、文本 |
| `source-fit` | 适合宽度 | PDF |
| `source-rotate` | 旋转 | PDF |
| `source-theme` | 阅读主题 | EPUB、文本、HTML |
| `source-original` | 新窗口打开 | 全部 |

## 7. Tutor 控件

| Control ID | 名称 | 责任 |
|---|---|---|
| `tutor-reset` | 新对话 | 清空当前课程聊天记录 |
| `tutor-suggestion` | 建议问题 | 发送完整建议 prompt |
| `tutor-input` | 输入框 | 输入用户问题 |
| `tutor-send` | 发送 | 向课程 Kimi 会话发送问题 |
| `tutor-quote-chip` | 引用 | 表示当前提问带有课文上下文 |
| `tutor-remove-quote` | 移除引用 | 清除当前 selection context |

## 8. iframe 课节控件

| Control ID | 名称 | 责任 |
|---|---|---|
| `selection-ask` | 问助手 | 向父页面发送选区上下文 |
| `selection-note` | 记笔记 | 创建锚定课文的笔记 |
| `note-edit` | 编辑 | 修改自定义笔记内容 |
| `note-collapse` | 折叠 | 收起单张笔记卡 |
| `note-delete` | 删除 | 删除笔记和高亮 |
| `activity-submit` | 提交 | 提交当前互动题答案 |
| `activity-hint` | 提示 | 展示活动提示 |
| `activity-retry` | 重试 | 重新作答 |

## 9. 运行时注入顺序

课节 iframe 当前按以下顺序加载增强层：

```text
margin-notes-core.js
margin-notes.js
study-cards.js
select.js
activity-runtime.js
vendor/lenis/lenis.min.js
lesson-scroll-policy.js
lesson-shell.js
```

后续测试必须验证重复加载、切换课节和销毁行为。
