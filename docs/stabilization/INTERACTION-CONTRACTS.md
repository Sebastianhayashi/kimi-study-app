# 交互契约

## 契约字段

每个可交互控件必须定义：

```text
Control ID
Visible when
Enabled when
Immediate feedback
Loading
Success
Error
Persistence
Keyboard
Focus return
Telemetry/diagnostics
```

## C01 上传材料

| 字段 | 契约 |
|---|---|
| Control ID | `library-upload-submit` |
| Visible when | 上传入口打开 |
| Enabled when | 已选择受支持文件且没有正在提交 |
| Immediate feedback | 按钮和 dropzone 禁用，显示文件名和大小 |
| Loading | 显示上传中，不伪造课程生成百分比 |
| Success | 获得 courseId 后进入 `/course/:id` |
| Error | 保留已选文件，显示可重试错误 |
| Persistence | 不要求刷新恢复未提交文件 |
| Keyboard | Enter/Space 可提交 |

## C02 下一课

| 字段 | 契约 |
|---|---|
| Control ID | `course-next-lesson` |
| Visible when | 已有至少一节课 |
| Enabled when | 当前课程没有 Kimi 任务 |
| Immediate feedback | 禁用按钮并显示“正在生成” |
| Loading | 中央显示生成覆盖层，按钮不能重复触发 |
| Success | 更新目录并打开新增课节 |
| Error | 停止动画、恢复按钮、显示重试信息 |
| Persistence | 刷新后以 `/status` 为准恢复 |

## C03 原文阅读器

| 字段 | 契约 |
|---|---|
| Control ID | `lesson-original` |
| Visible when | `/sources` 至少返回一个允许预览的文件 |
| Enabled when | 课程生成覆盖层未阻止交互 |
| Immediate feedback | 中央区域显示加载状态 |
| Loading | “正在打开学习资源…” |
| Success | 显示与格式匹配的阅读器控件 |
| Error | 显示可理解错误和“在新窗口打开” |
| Persistence | 字号和主题保存；课节状态保持 |
| Keyboard | Enter/Space 打开，Escape 返回课程 |
| Focus return | 返回触发“原文”的按钮 |

## C04 Source Viewer 搜索

| 字段 | 契约 |
|---|---|
| Control ID | `source-search` |
| Enabled when | 当前格式支持搜索且资源 ready |
| Immediate feedback | 显示搜索进行中 |
| Success | 结果列表、数量和当前位置同步 |
| Empty | 显示“未找到结果”，不作为错误 |
| Error | 显示搜索失败，但阅读器继续可用 |
| Keyboard | Ctrl/Cmd+F 聚焦，Enter 执行 |

## C05 划词问助手

| 字段 | 契约 |
|---|---|
| Control ID | `selection-ask` |
| Visible when | 有非空有效选区 |
| Enabled when | 当前 iframe 属于当前 Lesson |
| Immediate feedback | 父页面出现引用 Chip，聚焦 Tutor 输入框 |
| Success | 发送时包含 lesson、section、selectedText、surrounding |
| Error | 消息发送失败时保留引用和问题 |
| Persistence | 未发送引用不跨课节保留 |

## C06 笔记开关

| 字段 | 契约 |
|---|---|
| Control ID | `lesson-notes` |
| Visible when | Lesson iframe 完成增强层初始化 |
| Enabled when | 笔记模块 ready |
| Immediate feedback | 展开或收起笔记，不刷新课文 |
| Success | `aria-pressed` 与实际布局一致 |
| Empty state | 没有笔记时不永久占据页面宽度 |
| Persistence | 笔记内容持久化；面板开关策略需产品确认 |
| Keyboard | Enter/Space 切换 |

## C07 活动提交

| 字段 | 契约 |
|---|---|
| Control ID | `activity-submit` |
| Enabled when | 用户提供满足题型要求的 response |
| Immediate feedback | 禁用重复提交，显示评分中 |
| Success | 展示确定性 feedback 并保存 attempt |
| Error | 恢复输入并显示可重试错误 |
| Persistence | 刷新后恢复 progress/mastery |
| Security | 公共 API 不包含正确答案或评分键 |

## C08 Tutor 发送

| 字段 | 契约 |
|---|---|
| Control ID | `tutor-send` |
| Enabled when | 输入非空且课程没有占用同一 Kimi lock |
| Immediate feedback | 显示用户消息、禁用输入和重复发送 |
| Loading | 显示等待时间或思考状态 |
| Success | 安全渲染 Markdown，更新建议按钮 |
| Error | 恢复输入内容并提供重试 |
| Persistence | 成功消息写入 `chat.json` |

## C09 左右侧栏恢复

| 字段 | 契约 |
|---|---|
| Control ID | `course-open-context`, `course-open-assistant` |
| Visible when | 对应侧栏折叠或移动端关闭 |
| Immediate feedback | 恢复对应侧栏，不同时改变另一侧栏 |
| Success | 可见区域、ARIA 和按钮状态同步 |
| Keyboard | Enter/Space 打开，Escape 按移动端约定关闭 |
