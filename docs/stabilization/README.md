# Lucubro 稳定化工作区

本目录定义当前产品的行为边界、核心用户旅途、交互契约、状态机、问题台账和发布门禁。

## 当前基线

- 基线提交：`22d70f18bbba142a452b6bf74246aff337b4551b`
- 基线说明：`Apply current-main frontend shell patch (tutor markdown, rounded tools, quote chip)`
- 本阶段范围：Phase 0–2（基线、产品契约、确定性 fixture 和隔离数据目录）
- 本阶段不包含：Playwright、视觉回归、业务 Bug 修复、UI 重设计

## 文档索引

- [BASELINE.md](./BASELINE.md)：如何捕获可复现的环境基线
- [PRODUCT-SURFACE.md](./PRODUCT-SURFACE.md)：当前所有产品入口和运行边界
- [USER-JOURNEYS.md](./USER-JOURNEYS.md)：核心用户旅途和完成条件
- [INTERACTION-CONTRACTS.md](./INTERACTION-CONTRACTS.md)：按钮与控件的统一行为契约
- [STATE-MACHINES.md](./STATE-MACHINES.md)：生成、阅读器、Tutor、笔记状态机
- [KNOWN-ISSUES.md](./KNOWN-ISSUES.md)：当前问题台账
- [RELEASE-GATE.md](./RELEASE-GATE.md)：合并和上线门禁
- [TRACEABILITY.md](./TRACEABILITY.md)：模块、旅途、fixture 和未来测试的对应关系

## 本地准备

```bash
npm run fixtures:build
LUCUBRO_DATA_DIR=/tmp/lucubro-e2e npm run fixtures:seed -- --clean
npm run stabilization:baseline
```

生成物默认写入：

```text
tests/.generated/fixtures/
.stabilization/baseline.json
```

这些目录不会提交到 Git。

## 原则

1. 先复现，再修复。
2. 每项功能必须以完整用户旅途验收，而不是只检查单个按钮。
3. 自动测试不得依赖真实 Kimi 输出的稳定性。
4. 测试数据不得写入生产课程目录。
5. 任何 P0/P1 问题都阻止发布。
