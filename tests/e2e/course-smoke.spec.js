'use strict';

const { test, expect } = require('../support/test-fixtures');

test('课程外壳与课节 iframe 一起加载', async ({ page }) => {
  await page.goto('/course/readycourse');
  await expect(page.locator('.course-name')).toHaveText('Ready Course Fixture');
  await expect(page.locator('body')).not.toContainText(/Kimi|Teach|Tutor/);
  await expect(page.locator('.current-lesson')).toContainText('第 1 课');

  const frame = page.frameLocator('#lessonFrame');
  await expect(frame.getByRole('heading', { name: '稳定化测试课节' })).toBeVisible();
  await expect(frame.locator('[data-kimi-activity="activity-1"]')).toBeVisible();
  await expect(frame.locator('html')).toHaveAttribute('data-kimi-source-viewer-bound', 'true');
});

test('完整助教问答、划词、新对话及笔记栏交互', async ({ page }) => {
  // 拦截聊天接口以确保测试运行极速且 100% 确定，防止网络延迟或 rate limit 导致失败
  await page.route('**/api/courses/readycourse/chat', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        reply: "限制确实能创造新的行动空间。在这个课节里，这就是**核心概念**。\n\n* 列表项一\n* 列表项二",
        suggestions: [
          { label: "解释句子含义", prompt: "请解释'限制并不只是阻碍'这句话的含义" },
          { label: "提供生活实例", prompt: "提供生活的真实例子" }
        ]
      })
    });
  });

  await page.route('**/api/courses/readycourse/chat/reset', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true })
    });
  });

  await page.goto('/course/readycourse');

  // 1. 验证新对话按钮 (New Conversation Button) 和确认弹窗
  const newChatBtn = page.locator('.ks-new-chat-button');
  await expect(newChatBtn).toBeVisible();

  // 注册确认弹窗处理
  page.once('dialog', dialog => {
    expect(dialog.message()).toContain('清空当前对话记录并重新开始？');
    dialog.accept();
  });
  await newChatBtn.click();

  // 验证对话已被清空到只剩 welcome 消息
  const messages = page.locator('#chatThread .message');
  await expect(messages).toHaveCount(1);
  await expect(messages.first()).toContainText('我已经读取当前课节和对应材料');

  // 2. 模拟划词发送 (ask-selection)
  await page.evaluate(() => {
    window.postMessage({
      type: 'ask-selection',
      selectedText: '限制并不只是阻碍，它也可能创造新的行动空间。',
      section: '稳定化测试课节',
      surrounding: '限制并不只是阻碍，它也可能创造新的行动空间。这段文字用于验证划词、引用、笔记锚点和刷新恢复。',
      anchor: {
        exact: '限制并不只是阻碍，它也可能创造新的行动空间。',
        prefix: '',
        suffix: '这段文字用于验证划词',
        position: { start: 0, end: 24 }
      }
    }, '*');
  });

  // 验证引用 Chip 是否出现
  const quoteChip = page.locator('.ks-selection-quote');
  await expect(quoteChip).toBeVisible();
  await expect(quoteChip.locator('.ks-selection-quote-copy')).toContainText('限制并不只是阻碍');

  // 3. 点击关闭 Chip 按钮，验证它消失
  await quoteChip.locator('.ks-selection-quote-close').click();
  await expect(quoteChip).toBeHidden();

  // 4. 再次模拟划词
  await page.evaluate(() => {
    window.postMessage({
      type: 'ask-selection',
      selectedText: '限制并不只是阻碍，它也可能创造新的行动空间。',
      section: '稳定化测试课节',
      surrounding: '限制并不只是阻碍，它也可能创造新的行动空间。这段文字用于验证划词、引用、笔记锚点和刷新恢复。',
      anchor: {
        exact: '限制并不只是阻碍，它也可能创造新的行动空间。',
        prefix: '',
        suffix: '这段文字用于验证划词',
        position: { start: 0, end: 24 }
      }
    }, '*');
  });
  await expect(quoteChip).toBeVisible();

  // 5. 在输入框中输入问题并发送
  const input = page.locator('#assistantInput');
  await input.fill('这句话该怎么理解？');

  const sendBtn = page.locator('#sendButton');
  await sendBtn.click();

  // 引用 Chip 应自动隐藏
  await expect(quoteChip).toBeHidden();

  // 验证“Kimi 正在思考”提示出现过或最终回复已经完成
  const assistantReply = page.locator('#chatThread .message.assistant.ks-markdown-message').last();
  await expect(assistantReply).toBeVisible({ timeout: 25000 });
  await expect(assistantReply).toContainText(/限制|阻碍|创造/);

  // 6. 验证建议按钮 (Suggestions)
  const quickPrompts = page.locator('.quick-prompts .quick-prompt');
  await expect(quickPrompts.first()).toBeVisible();
  const count = await quickPrompts.count();
  expect(count).toBeGreaterThanOrEqual(1);

  // 7. 验证笔记栏开关按钮
  const slot = page.locator('#lessonResourceSlot');
  await expect(slot).toBeVisible();
  const notesToggle = slot.locator('.kn-notes-toggle');
  await expect(notesToggle).toBeVisible();
});
