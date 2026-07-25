# Lucubro 前端体验升级验收

验收日期：2026-07-26  
分支：`codex/frontend-optimization`

## 结果

- 语法检查通过。
- 137 项单元测试全部通过。
- 55 项 Playwright 浏览器测试全部通过。
- 首页、课程库、建课页、ready、generating、failed 课程页均完成桌面与移动端检查。
- light、dark、reduced-motion、键盘焦点、抽屉关闭与焦点返回均有现有测试或最终人工截图覆盖。
- 目标视口没有水平溢出：1440×900、1366×768、390×844。

## 真实材料旅程

使用用户提供的 `/Users/microseyuyu/Downloads/让创意更有黏性.epub` 在隔离测试数据目录完成真实上传。

- 文件格式：EPUB
- 文件大小：386,768 bytes
- 书名识别：让创意更有黏性：创意直抵人心的六条路径
- 作者识别：[美]奇普·希思、[美]丹·希思
- 语言识别：zh-CN
- 章节文档数：20
- 材料检查：完成
- Teach Mission：约 18 秒生成第一轮问题和 5 个可选场景
- 移动端水平溢出：0 px

真实材料只写入 `tests/.runtime/`，没有进入正式课程数据。

## 首页本地性能指标

在隔离的本地 Chromium、1440×900 视口下采集：

| 指标 | 结果 | 目标 |
| --- | ---: | ---: |
| LCP | 132 ms | < 2.5 s |
| CLS | 0.0004 | < 0.1 |
| 最长交互事件 | 40 ms | < 200 ms |
| 静态资源传输量 | 460,115 bytes | 记录项 |
| 资源请求数 | 11 | 记录项 |

这些数据用于本地回归，不等同于线上真实用户监控。

## Taste Skill 预检

- 首页不再包含 Base64 内嵌产品页面。
- 产品图来自真实 fixture 路径截图。
- 保留单一 Lucubro 品牌蓝作为主要强调色。
- 未发现可见的长破折号文案。
- 状态页统一使用真实进度、内容形状和恢复入口。
- 首页横向装饰溢出已裁切，不产生页面横向滚动。
- 超过 24 小时的任务以“天 + 时间”显示，不再出现四位数小时。
- 深色主题和 reduced-motion 都有独立视觉处理。

## 视觉基线

- `docs/images/frontend-baseline/landing-1440x900.png`
- `docs/images/frontend-baseline/landing-dark-1366x768.png`
- `docs/images/frontend-baseline/library-reduced-motion-1366x768.png`
- `docs/images/frontend-baseline/new-course-390x844.png`
- `docs/images/frontend-baseline/course-ready-1440x900.png`
- `docs/images/frontend-baseline/course-generating-1366x768.png`
- `docs/images/frontend-baseline/course-failed-390x844.png`
- `docs/images/frontend-baseline/real-epub-mission-390x844.png`
