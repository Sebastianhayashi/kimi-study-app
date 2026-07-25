<div align="center">

<img src="public/assets/brand/lucubro-mark.svg" width="72" height="72" alt="Lucubro">

# Lucubro

**把你已经拥有的材料，变成一门围绕真实目标展开的课程。**

[English](README.md) · [日本語](README.ja.md) · [本地运行](#运行-lucubro) · [产品原理](docs/PRODUCT.md)

</div>

![Lucubro 学习工作区](public/assets/product/hero-showcase.webp)

## 从你要完成的事情开始

Lucubro 可以把书籍、教材、文章、试卷和自己的文档变成学习工作区。你先说明想完成什么，Lucubro 再把材料组织成目标、课程路径、互动课节、练习、笔记和基于原文的辅助。

它面向两类学习任务：

- **备考与提升。** 上传教材、试卷、练习题或作业。后续课程更关注你实际完成了什么、答得怎么样，而不只依赖“我懂了”这样的自述。
- **解决现实问题。** 上传与你的写作、表达、工作问题或当前项目有关的书籍和文章，把阅读转化成可以使用的产出。

两种模式使用同一个学习循环：

```text
问题 → 材料 → 行动 → 证据 → 调整
```

## 你可以用它做什么

- 上传 EPUB、PDF、Markdown 或纯文本。
- 在生成课程前明确使用场景和预期结果。
- 阅读互动课节，完成检查、提示、重试和迁移练习。
- 在课程旁边打开原始材料。
- 划选原文、写锚定笔记，或保存 Lucubro 的回答。
- 在独立笔记本中查看所有课程的笔记，并回到准确课节位置。
- 通过类似 GitHub 点阵图的学习记录查看每天的课节、笔记和练习。
- 让 Lucubro 结合当前课节和原始材料解释、举例或反馈。
- 保留课程、笔记和学习记录，继续生成下一课。

![由《让创意更有黏性》生成的真实课程](public/assets/product/course-workspace.webp)

## 这是学习工作区，不是另一个聊天框

- **左侧课程导航**：当前课节、进度、目录、目标与路径。
- **中间课节**：主要阅读与练习区域。
- **右侧 Lucubro 助手**：结合当前课程解释和反馈。
- **上下文笔记**：普通布局使用紧凑侧栏；专注或全屏产生足够留白时成为 margin notes；移动端使用底部面板。
- **原文阅读**：可单独阅读，也可与课节并排对照。

课程库会继续你上次停下的课节。独立笔记本跨课程工作，不需要为了找笔记逐门打开课程。

## Lucubro 会保留什么

每门课程都是本地、可继续的工作区，包括原始材料、学习目标、课程路径、课节、评估、笔记、学习活动、助手上下文和生成状态。即使课程生成失败，已上传的材料和确认过的目标仍会保留。

目前已经记录课节打开、笔记与练习尝试。更完整的用户 artifacts——例如改写后的段落、做完的题目、演讲稿或项目产出——属于明确的产品方向，但后端还没有全部实现。

## 运行 Lucubro

### 环境要求

- Node.js 22+
- 已安装并登录 [`kimi` CLI](https://github.com/MoonshotAI/kimi-cli)

该 CLI 目前是 Lucubro 的本地生成运行时，只是实现依赖，不作为学习界面中的另一个产品品牌。

```bash
kimi login
git clone https://github.com/Sebastianhayashi/lucubro.git
cd lucubro
npm ci
npm start
```

打开 `http://localhost:3000`。

### 不调用模型，先查看产品

```bash
npm ci
npm run demo:seed
LUCUBRO_DATA_DIR=tests/.runtime/courses PORT=3107 npm start
```

打开 `http://localhost:3107/app`。演示数据与 `data/courses` 完全隔离。

## 语言

界面默认使用英语，并支持简体中文和日语。课程与原始材料会保留创建课程时选择的内容语言。

## 当前状态

Lucubro 是实验性开源产品，不是已经完成的生产 SaaS。

- 课程生成具有非确定性，发布前会经过结构验证与质量门禁。
- 课程数据保存在本地，模型请求通过已配置的 CLI 服务完成。
- 生产账号、多人权限、支付、云端队列和横向扩展不在当前范围内。
- PDF 与 EPUB 已有真实文件测试，但仍需要更大的兼容性样本。

测试覆盖首页、课程库、建课、ready/generating/failed 状态、笔记、原文阅读、移动抽屉和状态一致性。

```bash
npm run check
npm test
npm run fixtures:build
LUCUBRO_DATA_DIR=tests/.runtime/courses npm run fixtures:seed -- --clean
npm run test:e2e:ci
```

更多内容见 [产品原理](docs/PRODUCT.md)、[工作流](docs/WORKFLOW.md)、[架构](docs/ARCHITECTURE.md)、[质量](docs/QUALITY.md) 和 [限制](docs/LIMITATIONS.md)。

## 贡献

欢迎贡献真实材料兼容性样本、无障碍与移动端改进、学习证据实验、笔记与原文阅读回归测试，以及基于真实目标的可用性研究。

请阅读 [CONTRIBUTING.md](CONTRIBUTING.md)。安全问题请遵循 [SECURITY.md](SECURITY.md)。

## 许可证

代码使用 [ISC License](LICENSE)。第三方内容见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

Lucubro 是独立开源项目，不是 Moonshot AI 的官方产品。
