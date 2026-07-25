# 质量与测试

## 质量目标

仓库的质量标准不是“页面能够打开”，而是：

- 核心用户旅程可以完整结束；
- 每个状态面表达同一个规范状态；
- 失败不会伪装为永久加载；
- 测试不会污染真实课程数据；
- 模型生成产物通过结构、安全与学习质量门禁；
- 修复包含可复现失败和对应回归测试。

## 自动测试

### 静态检查

```bash
npm run check
```

检查服务端、领域逻辑、浏览器运行时、Fixture 脚本和 Playwright 支持代码的 JavaScript 语法。

### Node 测试

```bash
npm test
```

当前包含 116 个测试，覆盖：

- 生成状态和公共事件；
- 评估结构与质量；
- 私有文件和答案键隔离；
- Tutor 上下文与 session 恢复；
- 下一课事务、清理与中断恢复；
- 笔记、学习卡片、选区和滚动策略；
- Fixture 构建与测试数据隔离。

### Playwright E2E

```bash
npm run fixtures:build
LUCUBRO_DATA_DIR=tests/.runtime/courses npm run fixtures:seed -- --clean
npm run test:e2e:ci
```

覆盖：

- 落地页和课程库；
- 新建课程；
- generating、ready、failed 和 invalid-assessment 状态；
- 课程工作区与来源阅读；
- 移动端抽屉；
- 生成状态一致性；
- Console、Network 和生产数据目录守卫。

## 状态一致性回归

一次真实 Chromium 审计曾发现：主画布已经进入失败终态，但页头和侧栏仍显示生成中，同时同一工作流出现三个主进度面。

修复后的不变量：

1. `failed` 或 `interrupted` 到达后，所有运行文案停止；
2. 当前课节、左侧状态、活动记录和 Tutor 上下文使用同一终态；
3. 中央生成预览拥有唯一可见 `role=progressbar`；
4. 页头和侧栏只显示文字摘要；
5. 迟到的事件不能把终态恢复成 running。

![状态修复前后](images/quality-before-after.jpg)

## CI

`.github/workflows/ci.yml` 在 push、Pull Request 和手动触发时执行：

1. `npm ci`；
2. 安装 Chromium；
3. 检查生产课程目录干净；
4. 静态检查；
5. Node 测试；
6. Chromium E2E；
7. 再次确认生产课程目录未改变；
8. 上传 Playwright 报告和失败证据。

## 发布门禁

发布前至少要求：

- P0/P1 缺陷为 0；
- Node 测试和 Chromium 核心旅程通过；
- 无未登记 `pageerror`、`console.error`、`requestfailed`、404 或 5xx；
- PDF/EPUB Fixture 矩阵通过；
- 视觉变化提供 before/after；
- Safari、键盘和真实触控板旅程完成人工验证。

更完整的门禁见 [`docs/stabilization/RELEASE-GATE.md`](stabilization/RELEASE-GATE.md)。

## 审计报告

本仓库包附带一次真实浏览器 UX E2E、源码诊断和修复报告：

- [中文报告](reports/kimi-study-ux-e2e-report.zh-CN.pdf)
- [English report](reports/kimi-study-ux-e2e-report.en-US.pdf)

报告中的环境替代和阻塞项只代表那一次隔离执行，不等同于所有环境的能力。
