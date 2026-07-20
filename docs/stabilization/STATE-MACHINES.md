# 状态机定义

状态机是后续测试的唯一状态来源。UI 文案可以调整，但状态和转换不能隐式增加。

## 1. 课程生成

```text
idle
  └─ uploadAccepted → uploading
uploading
  ├─ courseCreated → understanding
  └─ uploadFailed → failed
understanding
  ├─ profileReady → generating
  ├─ processLost → interrupted
  └─ fatalError → failed
generating
  ├─ lessonArtifactReady → validating
  ├─ retryableError → retrying
  ├─ processLost → interrupted
  └─ fatalError → failed
retrying
  ├─ retryStarted → generating
  ├─ processLost → interrupted
  └─ retriesExhausted → failed
validating
  ├─ validationPassed → ready
  ├─ repairStarted → generating
  ├─ processLost → interrupted
  └─ validationFailed → failed
ready
failed
interrupted
```

不变量：

- `progress` 不得倒退。
- `ready` 必须有至少一个 lesson。
- `ready` 不代表 assessment 合法；发布门禁必须单独验证。
- `failed/interrupted` 必须停止动画。
- SSE 与轮询冲突时，终止状态优先。

## 2. Source Viewer

```text
closed
  └─ open(source) → loading
loading
  ├─ renderSucceeded → ready
  ├─ switchSource → loading
  ├─ renderFailed → error
  └─ close → closed
ready
  ├─ search → searching
  ├─ switchSource → loading
  └─ close → closed
searching
  ├─ resultsReady → ready
  ├─ searchFailed → ready-with-search-error
  └─ close → closed
error
  ├─ retry → loading
  ├─ switchSource → loading
  └─ close → closed
```

不变量：

- 每次切换资源必须先运行旧资源 cleanup。
- `closed` 时 lesson iframe 恢复可见。
- 错误状态必须保留原文件链接。
- 不可信 HTML/EPUB 脚本不得执行。

## 3. Tutor

```text
idle
  ├─ submit → sending
  └─ reset → resetting
sending
  ├─ responseStarted → receiving
  ├─ conflict → busy
  └─ requestFailed → error
receiving
  ├─ responseComplete → idle
  └─ streamFailed → error
busy
  └─ retryAvailable → idle
error
  ├─ retry → sending
  └─ edit → idle
resetting
  ├─ resetComplete → idle
  └─ resetFailed → error
```

不变量：

- 同一问题不能被重复提交。
- 失败时保留用户输入和 selection context。
- Markdown 必须先转义/清理，再写入 DOM。

## 4. 笔记

```text
none
  └─ create → creating
creating
  ├─ saveSucceeded → saved
  └─ saveFailed → error
saved
  ├─ edit → editing
  ├─ collapse → collapsed
  └─ delete → deleting
editing
  ├─ saveSucceeded → saved
  ├─ cancel → saved
  └─ saveFailed → error
collapsed
  ├─ expand → saved
  └─ delete → deleting
deleting
  ├─ deleteSucceeded → none
  └─ deleteFailed → saved
error
  ├─ retry → creating/editing
  └─ dismiss → previousStableState
```

不变量：

- note ID 稳定。
- anchor 恢复失败时不能删除用户内容。
- 无笔记时不强制预留 rail。

## 5. 互动活动

```text
loading
  ├─ validSpec → unanswered
  ├─ missingSpec → unavailable
  └─ invalidSpec → invalid
unanswered
  ├─ validResponse → submitting
  └─ hint → unanswered-with-hint
submitting
  ├─ passed → passed
  ├─ failed → retryable
  └─ requestError → submission-error
retryable
  └─ retry → unanswered
```
