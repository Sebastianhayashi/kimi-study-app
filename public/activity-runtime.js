(() => {
  'use strict';

  const courseId = window.__courseId;
  const lessonFile = window.__lessonFile;
  if (!courseId || !lessonFile) return;

  const apiBase = `/api/courses/${encodeURIComponent(courseId)}/lessons/${encodeURIComponent(lessonFile)}`;
  const state = { spec: null, attempts: [], mastery: {}, media: new Map() };

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function stageLabel(stage) {
    return ({
      diagnostic: '快速诊断',
      'worked-example': '示范',
      guided: '引导练习',
      independent: '独立练习',
      transfer: '应用任务',
      'exit-ticket': '离堂检测',
      remediation: '针对性补练',
    })[stage] || '练习';
  }

  function latestAttempt(activityId) {
    return state.attempts.filter((attempt) => attempt.activityId === activityId).sort((a, b) => b.attemptNumber - a.attemptNumber)[0] || null;
  }

  async function postAttempt(activity, response) {
    const result = await fetch(`${apiBase}/activities/${encodeURIComponent(activity.id)}/attempt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ response }),
    });
    if (!result.ok) throw new Error((await result.json().catch(() => ({}))).error || '提交失败');
    const data = await result.json();
    state.attempts.push(data.attempt);
    state.mastery = data.mastery || {};
    return data;
  }

  function feedbackNode(data) {
    const box = element('div', 'kimi-activity__feedback', data.feedback || (data.passed ? '已完成。' : '请再试一次。'));
    box.dataset.state = data.passed ? 'passed' : 'retry';
    box.setAttribute('role', 'status');
    return box;
  }

  function renderProgress(root, activity) {
    const claim = state.mastery[activity.claimId];
    if (!claim) return;
    const progress = root.querySelector('.kimi-activity__progress') || element('div', 'kimi-activity__progress');
    progress.textContent = claim.mastered
      ? `✓ 已证明：${claim.label}`
      : `${claim.label}：已通过 ${claim.passed}/${claim.requiredPassed} 个必要练习`;
    if (!progress.parentNode) root.appendChild(progress);
  }

  function addHintAction(actions, activity, feedbackArea) {
    if (!activity.hints || !activity.hints.length) return;
    const button = element('button', 'kimi-activity__button kimi-activity__button--secondary', '查看提示');
    button.type = 'button';
    let hintIndex = 0;
    button.addEventListener('click', () => {
      const existing = feedbackArea.querySelector('.kimi-activity__hint');
      if (existing) existing.remove();
      const hint = element('div', 'kimi-activity__hint', activity.hints[Math.min(hintIndex, activity.hints.length - 1)].content || activity.hints[Math.min(hintIndex, activity.hints.length - 1)]);
      feedbackArea.appendChild(hint);
      hintIndex += 1;
      if (hintIndex >= activity.hints.length) button.disabled = true;
    });
    actions.appendChild(button);
  }

  function renderChoice(activity, root, multiple) {
    const form = element('form');
    const options = element('div', 'kimi-activity__options');
    for (const option of activity.options || []) {
      const label = element('label', 'kimi-activity__option');
      const input = document.createElement('input');
      input.type = multiple ? 'checkbox' : 'radio';
      input.name = activity.id;
      input.value = option.id;
      label.append(input, document.createTextNode(option.label));
      options.appendChild(label);
    }
    const actions = element('div', 'kimi-activity__actions');
    const submit = element('button', 'kimi-activity__button', '检查答案');
    submit.type = 'submit';
    actions.appendChild(submit);
    const feedbackArea = element('div');
    addHintAction(actions, activity, feedbackArea);
    form.append(options, actions, feedbackArea);
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const checked = [...form.querySelectorAll('input:checked')].map((input) => input.value);
      if (!checked.length) return;
      submit.disabled = true;
      try {
        const result = await postAttempt(activity, multiple ? checked : checked[0]);
        feedbackArea.replaceChildren(feedbackNode(result));
        renderProgress(root, activity);
      } catch (error) {
        feedbackArea.replaceChildren(element('div', 'kimi-activity-error', error.message));
      } finally { submit.disabled = false; }
    });
    root.appendChild(form);
  }

  function renderText(activity, root, multiline) {
    const form = element('form');
    const input = element(multiline ? 'textarea' : 'input', multiline ? 'kimi-activity__textarea' : 'kimi-activity__input');
    if (!multiline) input.type = 'text';
    input.placeholder = activity.ui && activity.ui.placeholder || '请输入你的回答';
    const actions = element('div', 'kimi-activity__actions');
    actions.style.marginTop = '12px';
    const submit = element('button', 'kimi-activity__button', multiline ? '提交回答' : '检查答案');
    submit.type = 'submit';
    actions.appendChild(submit);
    const feedbackArea = element('div');
    addHintAction(actions, activity, feedbackArea);
    form.append(input, actions, feedbackArea);
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!input.value.trim()) return;
      submit.disabled = true;
      try {
        const result = await postAttempt(activity, input.value);
        feedbackArea.replaceChildren(feedbackNode(result));
        renderProgress(root, activity);
      } catch (error) {
        feedbackArea.replaceChildren(element('div', 'kimi-activity-error', error.message));
      } finally { submit.disabled = false; }
    });
    root.appendChild(form);
  }

  function renderOrdering(activity, root) {
    const list = element('div', 'kimi-activity__ordering');
    const order = (activity.items || []).map((item) => ({ ...item }));
    const redraw = () => {
      list.replaceChildren();
      order.forEach((item, index) => {
        const row = element('div', 'kimi-activity__order-item');
        row.appendChild(element('span', '', item.label));
        const controls = element('span', 'kimi-activity__order-controls');
        const up = element('button', 'kimi-activity__icon-button', '↑');
        const down = element('button', 'kimi-activity__icon-button', '↓');
        up.type = down.type = 'button';
        up.disabled = index === 0;
        down.disabled = index === order.length - 1;
        up.setAttribute('aria-label', '上移');
        down.setAttribute('aria-label', '下移');
        up.addEventListener('click', () => { [order[index - 1], order[index]] = [order[index], order[index - 1]]; redraw(); });
        down.addEventListener('click', () => { [order[index], order[index + 1]] = [order[index + 1], order[index]]; redraw(); });
        controls.append(up, down);
        row.appendChild(controls);
        list.appendChild(row);
      });
    };
    redraw();
    const actions = element('div', 'kimi-activity__actions');
    const submit = element('button', 'kimi-activity__button', '检查顺序');
    submit.type = 'button';
    const feedbackArea = element('div');
    addHintAction(actions, activity, feedbackArea);
    actions.prepend(submit);
    submit.addEventListener('click', async () => {
      submit.disabled = true;
      try {
        const result = await postAttempt(activity, order.map((item) => item.id));
        feedbackArea.replaceChildren(feedbackNode(result));
        renderProgress(root, activity);
      } catch (error) { feedbackArea.replaceChildren(element('div', 'kimi-activity-error', error.message)); }
      finally { submit.disabled = false; }
    });
    root.append(list, actions, feedbackArea);
  }

  function renderRecording(activity, root) {
    const area = element('div', 'kimi-activity__recording');
    const actions = element('div', 'kimi-activity__actions');
    const record = element('button', 'kimi-activity__button', '开始录音');
    const stop = element('button', 'kimi-activity__button kimi-activity__button--secondary', '停止');
    const complete = element('button', 'kimi-activity__button kimi-activity__button--secondary', '我已回放并完成');
    record.type = stop.type = complete.type = 'button';
    stop.disabled = true;
    complete.disabled = true;
    const audio = document.createElement('audio');
    audio.controls = true;
    audio.hidden = true;
    const feedbackArea = element('div');
    let recorder = null;
    let chunks = [];
    record.addEventListener('click', async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        recorder = new MediaRecorder(stream);
        chunks = [];
        recorder.addEventListener('dataavailable', (event) => chunks.push(event.data));
        recorder.addEventListener('stop', () => {
          const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
          audio.src = URL.createObjectURL(blob);
          audio.hidden = false;
          complete.disabled = false;
          stream.getTracks().forEach((track) => track.stop());
        });
        recorder.start();
        record.disabled = true;
        stop.disabled = false;
      } catch (error) { feedbackArea.replaceChildren(element('div', 'kimi-activity-error', `无法开始录音：${error.message}`)); }
    });
    stop.addEventListener('click', () => {
      if (recorder && recorder.state !== 'inactive') recorder.stop();
      record.disabled = false;
      stop.disabled = true;
    });
    complete.addEventListener('click', async () => {
      try {
        const result = await postAttempt(activity, { recorded: true, reviewed: true });
        feedbackArea.replaceChildren(feedbackNode(result));
        renderProgress(root, activity);
      } catch (error) { feedbackArea.replaceChildren(element('div', 'kimi-activity-error', error.message)); }
    });
    actions.append(record, stop, complete);
    area.append(actions, audio, feedbackArea);
    root.appendChild(area);
  }

  function renderActivity(activity, mount) {
    const root = element('section', 'kimi-activity');
    root.dataset.activityId = activity.id;
    root.appendChild(element('p', 'kimi-activity__eyebrow', stageLabel(activity.stage)));
    if (activity.title) root.appendChild(element('h3', 'kimi-activity__title', activity.title));
    root.appendChild(element('div', 'kimi-activity__prompt', activity.prompt));
    if (activity.stimulus && (activity.stimulus.text || activity.stimulus.audioUrl || activity.stimulus.imageUrl)) {
      const stimulus = element('div', 'kimi-activity__stimulus');
      if (activity.stimulus.text) stimulus.appendChild(element('div', '', activity.stimulus.text));
      if (activity.stimulus.imageUrl) { const img = document.createElement('img'); img.src = activity.stimulus.imageUrl; img.alt = activity.stimulus.alt || ''; img.style.maxWidth = '100%'; stimulus.appendChild(img); }
      if (activity.stimulus.audioUrl) { const audio = document.createElement('audio'); audio.controls = true; audio.src = activity.stimulus.audioUrl; stimulus.appendChild(audio); }
      root.appendChild(stimulus);
    }
    if (activity.type === 'single-choice') renderChoice(activity, root, false);
    else if (activity.type === 'multiple-choice') renderChoice(activity, root, true);
    else if (activity.type === 'fill-blank') renderText(activity, root, false);
    else if (activity.type === 'short-answer') renderText(activity, root, true);
    else if (activity.type === 'ordering') renderOrdering(activity, root);
    else if (activity.type === 'recording') renderRecording(activity, root);
    renderProgress(root, activity);
    mount.replaceChildren(root);
  }

  async function init() {
    const mounts = [...document.querySelectorAll('[data-kimi-activity]')];
    if (!mounts.length) return;
    try {
      const response = await fetch(`${apiBase}/activities`);
      if (response.status === 404 || response.status === 204) return;
      if (!response.ok) throw new Error('互动练习暂时不可用');
      const data = await response.json();
      state.spec = data.spec;
      state.attempts = data.progress && data.progress.attempts || [];
      state.mastery = data.progress && data.progress.mastery || {};
      const byId = new Map(state.spec.activities.map((activity) => [activity.id, activity]));
      for (const mount of mounts) {
        const activity = byId.get(mount.dataset.kimiActivity);
        if (activity) renderActivity(activity, mount);
      }
    } catch (error) {
      for (const mount of mounts) mount.replaceChildren(element('div', 'kimi-activity-error', error.message));
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
