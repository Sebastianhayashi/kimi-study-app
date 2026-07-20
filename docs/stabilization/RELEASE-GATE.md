# 发布门禁

## 当前阶段门禁

Phase 0–2 合并前必须满足：

```text
npm run check
npm test
npm run fixtures:build
使用临时 KIMI_STUDY_DATA_DIR 完成 fixtures:seed
生产默认 data/courses 未被改写
```

## Phase 3 之后的 PR 门禁

```text
npm ci
npm run check
npm test
Playwright Chromium
Console/Network Guard
核心 P0/P1 Journey
```

## 完整发布门禁

### 自动化

- Node 单元测试全部通过。
- Chromium、Firefox、WebKit 核心旅途通过。
- PDF/EPUB fixture matrix 通过。
- 无未处理 `pageerror` 和 `console.error`。
- 无未登记 `requestfailed`。
- 无未登记 404/5xx。
- Axe 自动检查无严重问题。
- Chromium 视觉差异已经批准。

### 人工

- Safari 真机通过。
- Mac 触控板阻尼手感通过。
- 键盘完整旅途通过。
- “资源/原文/任务/SUCCESS”命名和层级经过产品批准。
- 至少 5 名目标用户能完成核心旅途，不接受按钮位置提示。

### Bug 门槛

| 严重度 | 发布要求 |
|---|---|
| P0 | 0 |
| P1 | 0 |
| P2 | 有明确 workaround、负责人和修复日期 |
| P3 | 可进入 backlog |

## 禁止合并条件

- 只运行 `node --check`，没有运行旅途测试。
- 修改公共 glue/server/select 文件但没有对应回归测试。
- 视觉变化未提供 before/after。
- 修复依赖真实 Kimi 每次输出相同内容。
- 测试会写入 `data/courses`。
- 通过隐藏错误、吞掉 Promise rejection 或删除功能来让测试变绿。
