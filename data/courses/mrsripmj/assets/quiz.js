(function(global) {
  'use strict';

  function normalizeAnswer(value) {
    return String(value).toLowerCase().replace(/\s+/g, ' ').trim();
  }

  function shuffleArray(arr) {
    return arr.slice().sort(() => Math.random() - 0.5);
  }

  function findSpecPath() {
    const scripts = document.querySelectorAll('script[data-assessment]');
    if (scripts.length) return scripts[0].dataset.assessment;
    const lessonFile = window.location.pathname.split('/').pop().replace('.html', '');
    return '../assessments/' + lessonFile + '.json';
  }

  function renderActivities(activities) {
    activities.forEach(act => {
      const container = document.querySelector('[data-kimi-activity="' + act.id + '"]');
      if (!container) return;
      container.className = 'activity';
      container.innerHTML = '';
      renderActivity(container, act);
    });
  }

  function renderActivity(container, act) {
    const title = document.createElement('div');
    title.className = 'activity-title';
    title.textContent = act.title || act.prompt;
    container.appendChild(title);

    if (act.stage) {
      const meta = document.createElement('div');
      meta.className = 'activity-meta';
      meta.textContent = '阶段：' + act.stage + (act.claimId ? ' · 对应能力：' + act.claimId : '');
      container.appendChild(meta);
    }

    const prompt = document.createElement('div');
    prompt.textContent = act.prompt;
    prompt.style.marginBottom = '10px';
    container.appendChild(prompt);

    if (act.type === 'single-choice') {
      renderSingleChoice(container, act);
    } else if (act.type === 'multiple-choice') {
      renderMultipleChoice(container, act);
    } else if (act.type === 'fill-blank') {
      renderFillBlank(container, act);
    } else if (act.type === 'ordering') {
      renderOrdering(container, act);
    } else if (act.type === 'short-answer' || act.type === 'recording') {
      renderOpen(container, act);
    }
  }

  function renderSingleChoice(container, act) {
    const opts = document.createElement('div');
    opts.className = 'options';
    act.options.forEach(opt => {
      const label = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = act.id;
      input.value = opt.id;
      input.dataset.label = opt.label;
      label.appendChild(input);
      label.appendChild(document.createTextNode(opt.label));
      opts.appendChild(label);
    });
    container.appendChild(opts);
    addSubmit(container, act, () => {
      const selected = opts.querySelector('input:checked');
      return selected ? selected.value : null;
    });
  }

  function renderMultipleChoice(container, act) {
    const opts = document.createElement('div');
    opts.className = 'options';
    act.options.forEach(opt => {
      const label = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.name = act.id;
      input.value = opt.id;
      input.dataset.label = opt.label;
      label.appendChild(input);
      label.appendChild(document.createTextNode(opt.label));
      opts.appendChild(label);
    });
    container.appendChild(opts);
    addSubmit(container, act, () => {
      return Array.from(opts.querySelectorAll('input:checked')).map(i => i.value);
    });
  }

  function renderFillBlank(container, act) {
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'fill-input';
    input.placeholder = '请填写答案';
    input.id = 'input-' + act.id;
    container.appendChild(input);
    addSubmit(container, act, () => input.value);
  }

  function renderOrdering(container, act) {
    const list = document.createElement('ul');
    list.className = 'ordering-list';
    list.id = 'list-' + act.id;
    const shuffled = shuffleArray(act.items || act.scoring.answer);
    shuffled.forEach((item, idx) => {
      const li = document.createElement('li');
      li.draggable = true;
      li.textContent = item;
      li.dataset.value = item;
      li.addEventListener('dragstart', e => {
        e.dataTransfer.setData('text/plain', String(idx));
        li.classList.add('dragging');
      });
      li.addEventListener('dragend', () => li.classList.remove('dragging'));
      li.addEventListener('dragover', e => e.preventDefault());
      li.addEventListener('drop', e => {
        e.preventDefault();
        const children = Array.from(list.children);
        const fromIdx = parseInt(e.dataTransfer.getData('text/plain'), 10);
        const fromEl = children[fromIdx];
        list.insertBefore(fromEl, li.nextSibling);
      });
      list.appendChild(li);
    });
    container.appendChild(list);
    addSubmit(container, act, () => Array.from(list.children).map(li => li.dataset.value));
  }

  function renderOpen(container, act) {
    const wrap = document.createElement('div');
    wrap.className = 'speaking';
    const textarea = document.createElement('textarea');
    textarea.placeholder = '请在此输入你的回答或学习笔记';
    textarea.id = 'input-' + act.id;
    wrap.appendChild(textarea);
    const note = document.createElement('div');
    note.className = 'speaking-note';
    note.textContent = '此题为开放性任务，自动评分仅检查是否完成，具体内容请自评或请老师/家长评定。';
    wrap.appendChild(note);
    container.appendChild(wrap);
    addSubmit(container, act, () => textarea.value, true);
  }

  function addSubmit(container, act, getValue, isOpen) {
    const btnWrap = document.createElement('div');
    btnWrap.style.marginTop = '10px';
    const btn = document.createElement('button');
    btn.className = 'btn';
    btn.textContent = '提交答案';
    btnWrap.appendChild(btn);

    const hintBtn = document.createElement('button');
    hintBtn.className = 'btn btn-secondary';
    hintBtn.textContent = '提示';
    btnWrap.appendChild(hintBtn);
    container.appendChild(btnWrap);

    let hintIndex = 0;
    hintBtn.addEventListener('click', () => {
      if (!act.hints || act.hints.length === 0) return;
      const existing = container.querySelector('.hint');
      if (existing) existing.remove();
      const hint = document.createElement('div');
      hint.className = 'hint';
      hint.textContent = '提示 ' + (hintIndex + 1) + '：' + act.hints[hintIndex].content;
      container.appendChild(hint);
      hintIndex = (hintIndex + 1) % act.hints.length;
    });

    btn.addEventListener('click', () => {
      const value = getValue();
      if (value === null || value === '' || (Array.isArray(value) && value.length === 0)) {
        alert('请先完成本题。');
        return;
      }
      const result = scoreActivity(act, value);
      showFeedback(container, act, result, isOpen);
      updateSummary();
    });
  }

  function scoreActivity(act, value) {
    if (act.type === 'single-choice') {
      return { correct: value === act.correctOptionId, value };
    }
    if (act.type === 'multiple-choice') {
      const correct = Array.isArray(act.correctOptionIds)
        ? arraysEqual(value.sort(), act.correctOptionIds.sort())
        : false;
      return { correct, value };
    }
    if (act.type === 'fill-blank' && act.scoring) {
      const normUser = normalizeAnswer(value);
      const normAns = normalizeAnswer(act.scoring.answer);
      return { correct: normUser === normAns, value };
    }
    if (act.type === 'ordering' && act.scoring) {
      const user = value.map(normalizeAnswer);
      const ans = act.scoring.answer.map(normalizeAnswer);
      return { correct: JSON.stringify(user) === JSON.stringify(ans), value };
    }
    if (act.type === 'short-answer' || act.type === 'recording') {
      const min = act.scoring && act.scoring.minimumLength ? act.scoring.minimumLength : 1;
      return { correct: String(value).trim().length >= min, value, completion: true };
    }
    return { correct: false, value };
  }

  function showFeedback(container, act, result, isOpen) {
    const existing = container.querySelector('.feedback');
    if (existing) existing.remove();
    const fb = document.createElement('div');
    fb.className = 'feedback ' + (result.correct ? 'correct' : 'wrong');
    if (isOpen) {
      fb.textContent = act.feedback.correct;
    } else {
      fb.textContent = result.correct ? act.feedback.correct : act.feedback.incorrect;
    }
    container.appendChild(fb);
  }

  function arraysEqual(a, b) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  }

  function updateSummary() {
    const summary = document.getElementById('summary');
    const text = document.getElementById('summary-text');
    if (!summary || !text) return;
    const activities = document.querySelectorAll('.activity');
    const scored = document.querySelectorAll('.feedback.correct');
    const total = activities.length;
    summary.style.display = 'block';
    text.textContent = '你已提交 ' + scored.length + ' / ' + total + ' 道计分题回答正确。继续加油！';
  }

  function loadAssessment(path) {
    return fetch(path)
      .then(r => {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(data => {
        if (data.activities) renderActivities(data.activities);
        return data;
      })
      .catch(err => {
        console.error('无法加载测评文件：', err);
        const notice = document.createElement('div');
        notice.className = 'tip';
        notice.textContent = '提示：未能加载测评文件。若直接双击打开本文件，请通过本地服务器访问（如 python3 -m http.server），或允许浏览器访问本地文件。答案与评分键保存在 assessments/ 中。';
        document.querySelector('.container').appendChild(notice);
      });
  }

  global.KimiQuiz = {
    init: function(path) {
      path = path || findSpecPath();
      return loadAssessment(path);
    }
  };
})(window);
