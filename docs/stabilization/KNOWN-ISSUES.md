# 已知问题台账

> 状态说明：`OBSERVED` 来自用户或现有运行结果；`CODE-RISK` 来自代码路径，需要浏览器复现；`UNVERIFIED` 表示核心旅途尚未验收。

| ID | 严重度 | 状态 | 旅途 | 问题 | 验收证据 |
|---|---|---|---|---|---|
| STAB-001 | P1 | OBSERVED | J04 | PDF、EPUB 在部分真实文件上不能正确载入 | 待建立格式 fixture 和 Trace |
| STAB-002 | P1 | OBSERVED | J02 | 生成动画、真实事件和最终状态仍可能不一致 | 待建立 SSE/轮询组合测试 |
| STAB-003 | P1 | CONFIRMED | 全部 | 当前没有浏览器 E2E、跨浏览器和视觉回归 | Phase 3 |
| STAB-004 | P2 | CODE-RISK | J02 | ready 后 `location.reload()` 可能丢失临时 UI 状态或造成重复初始化 | 待记录 reload 次数和状态 |
| STAB-005 | P2 | OBSERVED | J04 | “资源”和“原文”概念接近，用户可能不理解区别 | 需要可用性测试和产品决定 |
| STAB-006 | P2 | OBSERVED | J03 | 课节头部按钮数量与层级开始造成困惑 | 先记录点击路径，不立即重设计 |
| STAB-007 | P2 | CODE-RISK | J02 | SSE 只在 active job 时重放历史，完成后刷新可能缺少全过程 | 待断线/重连 fixture |
| STAB-008 | P2 | CODE-RISK | J06/J08 | notes/chat 使用直接写文件，进程中断时存在部分写入风险 | 后续原子写入测试 |
| STAB-009 | P1 | CONFIRMED | 测试基础 | 数据目录固定，自动测试可能污染真实课程 | 本批次加入 `LUCUBRO_DATA_DIR` |
| STAB-010 | P2 | UNVERIFIED | J04 | PDF.js、EPUB.js 动态加载、worker 和资源路径未做真实浏览器矩阵 | Phase 5 |
| STAB-011 | P2 | CONFIRMED | 全部 | 目前没有统一收集 console error、requestfailed、4xx/5xx | Phase 3 |
| STAB-012 | P2 | UNVERIFIED | J03/J06/J07 | Lenis 是否干扰笔记、输入和排序拖动尚未端到端验证 | Phase 6 |
| STAB-013 | P2 | CODE-RISK | J05 | postMessage 尚无来源和当前 iframe 身份的统一契约 | Phase 6 |
| STAB-014 | P2 | UNVERIFIED | J07 | 非法 assessment 的用户可理解降级尚未验收 | invalidassessment fixture |
| STAB-015 | P2 | CODE-RISK | J08 | Tutor Markdown 在长表格、代码、链接混合时可能产生布局差异 | Phase 4/7 |

## 问题登记模板

```markdown
### STAB-XXX 标题

- 严重度：P0/P1/P2/P3
- 状态：OBSERVED/CODE-RISK/CONFIRMED/FIXED
- 影响旅途：JXX
- 环境：浏览器、操作系统、commit
- 前置数据：fixture 或真实文件说明
- 复现步骤：
  1.
  2.
- 预期：
- 实际：
- Console/Network：
- Trace/截图：
- 修复 commit：
- 回归测试：
```
