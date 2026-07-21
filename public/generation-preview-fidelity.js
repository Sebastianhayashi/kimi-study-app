(() => {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const PHASE_ORDER = ['extracting', 'profiling', 'claims', 'blueprint', 'questions', 'quality', 'assembling', 'validating', 'complete'];
  const PHASE_LABELS = {
    extracting: '读取教材内容',
    profiling: '理解材料结构',
    claims: '确定学习目标',
    blueprint: '设计练习路线',
    questions: '生成题目候选',
    quality: '筛选题目质量',
    assembling: '组装第一课',
    validating: '验证互动课程',
    complete: '课程准备完成',
  };
  const VARIANT_TO_PHASE = {
    material: 'extracting',
    structure: 'profiling',
    claims: 'claims',
    practice: 'blueprint',
    questions: 'questions',
    quality: 'quality',
    assembly: 'assembling',
    validation: 'validating',
    ready: 'complete',
  };
  const PHASE_TO_VARIANT = Object.fromEntries(Object.entries(VARIANT_TO_PHASE).map(([variant, phase]) => [phase, variant]));

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function clampProgress(value) {
    return Math.max(0, Math.min(100, Number(value) || 0));
  }

  function metricFrom(source, name, fallback) {
    const value = Number(source?.metrics?.[name] ?? source?.[name]);
    return Number.isFinite(value) && value >= 0 ? value : fallback;
  }

  function line(width, className = '') {
    return `<div class="ks-fidelity-block-line ${className}" style="width:${width}%"></div>`;
  }

  const stageTemplates = {
    material() {
      return `
        <div class="ks-fidelity-stage-caption">材料内容</div>
        <div class="ks-fidelity-block ks-fidelity-skeleton-shimmer"><div class="ks-fidelity-block-title" style="width:61%"></div></div>
        <div class="ks-fidelity-section-rule"></div>
        <div class="ks-fidelity-block ks-fidelity-skeleton-shimmer">
          ${line(92)}${line(86)}${line(80)}${line(92)}${line(68)}
        </div>
        <div class="ks-fidelity-block ks-fidelity-skeleton-shimmer ks-fidelity-block-spaced">
          <div class="ks-fidelity-block-title" style="width:46%"></div>
          <div class="ks-fidelity-copy-stack">${line(86)}${line(92)}${line(74)}</div>
        </div>
        <div class="ks-fidelity-block ks-fidelity-skeleton-shimmer ks-fidelity-block-spaced">
          <div class="ks-fidelity-block-title" style="width:55%"></div>
          <div class="ks-fidelity-copy-stack">${line(92)}${line(80)}${line(61)}</div>
        </div>`;
    },

    structure(context) {
      const units = Math.max(1, metricFrom(context, 'units', 8));
      const rows = Array.from({ length: Math.min(5, units) }, (_, index) => {
        const widths = [74, 86, 68, 80, 61];
        return `
          <div class="ks-fidelity-chapter-row">
            <span class="ks-fidelity-chapter-index">${String(index + 1).padStart(2, '0')}</span>
            <div class="ks-fidelity-chapter-copy">
              <div class="ks-fidelity-chapter-title">材料单元 ${index + 1}</div>
              ${line(widths[index % widths.length])}
            </div>
            <span class="ks-fidelity-chapter-tag ks-fidelity-skeleton-shimmer"></span>
          </div>`;
      }).join('');
      return `
        <div class="ks-fidelity-stage-caption">教材结构 · ${units} 个单元</div>
        <div class="ks-fidelity-chapter-stack">${rows}</div>`;
    },

    claims(context) {
      const claims = Math.max(1, metricFrom(context, 'claims', 4));
      const titles = ['理解核心概念', '识别关键材料', '应用课程方法', '完成迁移练习'];
      const copies = ['能用自己的语言说明材料中的核心判断', '能从原始材料中定位关键证据', '能在引导练习中正确使用所学方法', '能把方法应用到一个新的真实场景'];
      return `
        <div class="ks-fidelity-stage-caption">本课学习目标 · ${claims} 个</div>
        <div class="ks-fidelity-objective-grid">
          ${Array.from({ length: Math.min(4, claims) }, (_, index) => `
            <article class="ks-fidelity-objective-card">
              <div class="ks-fidelity-objective-icon">${String.fromCharCode(65 + index)}</div>
              <div class="ks-fidelity-objective-title">${titles[index]}</div>
              <div class="ks-fidelity-objective-copy">${copies[index]}</div>
            </article>`).join('')}
        </div>`;
    },

    practice() {
      const exercises = [
        ['引导练习', '根据材料线索选择正确判断', 3],
        ['独立练习', '用自己的语言补全核心解释', 1],
        ['应用任务', '将方法步骤按正确顺序排列', 3],
      ];
      return `
        <div class="ks-fidelity-stage-caption">练习组合 · 引导 → 独立</div>
        <div class="ks-fidelity-exercise-stack">
          ${exercises.map(([kind, title, count]) => `
            <article class="ks-fidelity-exercise-card">
              <div class="ks-fidelity-exercise-head"><span class="ks-fidelity-exercise-kind">${kind}</span><span class="ks-fidelity-exercise-score"></span></div>
              <div class="ks-fidelity-exercise-title">${title}</div>
              <div class="ks-fidelity-choice-list">
                ${Array.from({ length: count }, (_, index) => `<div class="ks-fidelity-choice"><span class="ks-fidelity-choice-dot"></span>${line([68, 80, 55][index % 3])}</div>`).join('')}
              </div>
            </article>`).join('')}
        </div>`;
    },

    questions(context) {
      const candidates = Math.max(1, metricFrom(context, 'candidates', 11));
      const questions = [
        ['这段材料的核心判断是什么？', ['材料中的主要判断', '一个相近但不完整的解释', '与材料无关的说法']],
        ['哪个例子最能支持当前学习目标？', ['直接来自材料的证据', '表面相关的例子', '过度泛化的结论']],
        ['下一步应该怎样应用这个方法？', ['按照步骤完成迁移', '跳过证据直接判断', '重复原文但不应用']],
      ];
      return `
        <div class="ks-fidelity-stage-caption">候选题目 · ${candidates} 道</div>
        <div class="ks-fidelity-exercise-stack">
          ${questions.map(([question, options]) => `
            <article class="ks-fidelity-exercise-card">
              <div class="ks-fidelity-exercise-title">${question}</div>
              <div class="ks-fidelity-choice-list">
                ${options.map((option) => `<div class="ks-fidelity-choice"><span class="ks-fidelity-choice-dot"></span><span class="ks-fidelity-choice-copy">${option}</span></div>`).join('')}
              </div>
            </article>`).join('')}
        </div>`;
    },

    quality(context) {
      const accepted = metricFrom(context, 'accepted', 9);
      const rejected = metricFrom(context, 'rejected', 2);
      return `
        <div class="ks-fidelity-stage-caption">题目质量检查 · 保留 ${accepted} / 移除 ${rejected}</div>
        <div class="ks-fidelity-quality-grid">
          <div class="ks-fidelity-exercise-stack">
            <article class="ks-fidelity-exercise-card">
              <div class="ks-fidelity-exercise-head"><span class="ks-fidelity-exercise-kind"></span><span class="ks-fidelity-quality-state is-kept">保留</span></div>
              <div class="ks-fidelity-exercise-title">哪个判断最符合材料中的证据与适用边界？</div>
              <div class="ks-fidelity-choice-list"><div class="ks-fidelity-choice"><span class="ks-fidelity-choice-dot"></span>${line(68)}</div><div class="ks-fidelity-choice"><span class="ks-fidelity-choice-dot"></span>${line(55)}</div></div>
            </article>
            <article class="ks-fidelity-exercise-card ks-fidelity-quality-card is-rejected">
              <div class="ks-fidelity-exercise-head"><span class="ks-fidelity-exercise-kind"></span><span class="ks-fidelity-quality-state">已移除</span></div>
              <div class="ks-fidelity-exercise-title">只要求复述材料中的一个词语</div>
              <div class="ks-fidelity-quality-reason">与前一题重复，不能提供新的学习证据</div>
            </article>
          </div>
          <aside class="ks-fidelity-quality-side">
            <div class="ks-fidelity-quality-check">材料依据明确</div>
            <div class="ks-fidelity-quality-check">只对应一个目标</div>
            <div class="ks-fidelity-quality-check">答案规则明确</div>
            <div class="ks-fidelity-quality-check">错误选项可诊断</div>
            <div class="ks-fidelity-quality-check">阅读难度合适</div>
          </aside>
        </div>`;
    },

    assembly(context) {
      const lessonNumber = Math.max(1, metricFrom(context, 'lessonNumber', 1));
      return `
        <div class="ks-fidelity-lesson-hero">
          <div class="ks-fidelity-lesson-eyebrow">Lesson ${String(lessonNumber).padStart(4, '0')} · 正在组装</div>
          <h1 class="ks-fidelity-lesson-title">第一课正在形成</h1>
          <p class="ks-fidelity-lesson-subtitle">讲解、示范和练习正在被整理到同一课节</p>
          <div class="ks-fidelity-lesson-goal"><strong>本课目标：</strong>理解材料中的核心判断，并能在练习中正确应用。</div>
        </div>
        <h2 class="ks-fidelity-lesson-section-title">一、核心内容</h2>
        <div class="ks-fidelity-vocab-grid">
          ${['核心概念', '关键证据', '适用条件', '常见误区', '练习方法', '迁移任务'].map((label) => `<div class="ks-fidelity-vocab-card"><div class="ks-fidelity-vocab-en">${label}</div><div class="ks-fidelity-vocab-cn">正在写入课节</div></div>`).join('')}
        </div>
        <h2 class="ks-fidelity-lesson-section-title">二、重点讲解</h2>
        <article class="ks-fidelity-exercise-card">${line(86, 'is-dark')}${line(74)}${line(92)}</article>`;
    },

    validation() {
      return `
        <div class="ks-fidelity-lesson-hero">
          <div class="ks-fidelity-lesson-eyebrow">Lesson 0001 · 互动验证</div>
          <h1 class="ks-fidelity-lesson-title">第一课正在完成最后检查</h1>
          <p class="ks-fidelity-lesson-subtitle">题目、提示和评分规则正在连接</p>
          <div class="ks-fidelity-lesson-goal"><strong>本课目标：</strong>理解材料中的核心判断，并能在练习中正确应用。</div>
        </div>
        <h2 class="ks-fidelity-lesson-section-title">互动练习</h2>
        <article class="ks-fidelity-exercise-card">
          <div class="ks-fidelity-validation-head"><span>哪个判断最符合当前材料？</span><span>验证中</span></div>
          <div class="ks-fidelity-choice-list"><div class="ks-fidelity-choice"><span class="ks-fidelity-choice-dot"></span><span class="ks-fidelity-choice-copy">第一个候选答案</span></div><div class="ks-fidelity-choice"><span class="ks-fidelity-choice-dot"></span><span class="ks-fidelity-choice-copy">第二个候选答案</span></div><div class="ks-fidelity-choice"><span class="ks-fidelity-choice-dot"></span><span class="ks-fidelity-choice-copy">第三个候选答案</span></div></div>
        </article>
        <div class="ks-fidelity-ready-badge">答案、提示与评分规则已连接</div>`;
    },

    ready() {
      return `
        <div class="ks-fidelity-lesson-hero">
          <div class="ks-fidelity-lesson-eyebrow">Lesson 0001 · 已准备</div>
          <h1 class="ks-fidelity-lesson-title">第一课已经准备好</h1>
          <p class="ks-fidelity-lesson-subtitle">讲解、示范与互动练习已经完成</p>
          <div class="ks-fidelity-lesson-goal"><strong>本课目标：</strong>理解材料中的核心判断，并能在练习中正确应用。</div>
        </div>
        <h2 class="ks-fidelity-lesson-section-title">一、核心内容</h2>
        <div class="ks-fidelity-vocab-grid">
          ${['核心概念', '关键证据', '适用条件', '常见误区', '练习方法', '迁移任务'].map((label) => `<div class="ks-fidelity-vocab-card"><div class="ks-fidelity-vocab-en">${label}</div><div class="ks-fidelity-vocab-cn">课程内容</div></div>`).join('')}
        </div>
        <h2 class="ks-fidelity-lesson-section-title">二、互动练习</h2>
        <article class="ks-fidelity-exercise-card"><div class="ks-fidelity-exercise-title">哪个判断最符合当前材料？</div><div class="ks-fidelity-choice-list"><div class="ks-fidelity-choice"><span class="ks-fidelity-choice-dot"></span><span class="ks-fidelity-choice-copy">第一个候选答案</span></div><div class="ks-fidelity-choice"><span class="ks-fidelity-choice-dot"></span><span class="ks-fidelity-choice-copy">第二个候选答案</span></div><div class="ks-fidelity-choice"><span class="ks-fidelity-choice-dot"></span><span class="ks-fidelity-choice-copy">第三个候选答案</span></div></div></article>
        <div class="ks-fidelity-ready-badge">课程可以开始</div>`;
    },

    error() {
      return `
        <div class="ks-fidelity-error-state">
          <div class="ks-fidelity-error-mark">!</div>
          <h2>课程生成没有完成</h2>
          <p>生成过程已经停止。返回课程库后可以重新创建课程。</p>
        </div>`;
    },
  };

  function mount(stage) {
    if (!stage) return { show() {}, update() {}, appendEvent() {}, complete() {}, fail() {}, hide() {}, destroy() {} };

    stage.classList.add('ks-generation-host');
    const root = document.createElement('section');
    root.className = 'ks-generation-preview ks-generation-fidelity';
    root.hidden = true;
    root.setAttribute('aria-label', '课程生成进度');
    root.innerHTML = `
      <div class="ks-generation-shell">
        <div class="ks-generation-meta">
          <button class="ks-generation-summary ks-generation-status-trigger" type="button" aria-expanded="false" aria-controls="ksGenerationProcess">
            <span class="ks-generation-current-status"><span class="ks-generation-status-pulse" aria-hidden="true"></span><span class="ks-generation-message" aria-live="polite">正在准备课程生成环境…</span></span>
            <span class="ks-generation-status-action"><span class="ks-generation-disclosure">查看生成过程</span><svg class="ks-generation-status-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m7 9 5 5 5-5"/></svg></span>
          </button>
          <div class="ks-generation-progress" role="progressbar" aria-label="课程生成进度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span></span></div>
          <section class="ks-generation-history ks-generation-process-popover" id="ksGenerationProcess" hidden>
            <div class="ks-generation-process-head"><span class="ks-generation-process-title">课程创建过程</span><button class="ks-generation-process-close" type="button" aria-label="关闭生成过程">×</button></div>
            <div class="ks-generation-process-list"></div>
          </section>
        </div>
        <div class="ks-generation-canvas ks-generation-canvas-wrap" data-variant="material" aria-hidden="true">
          <div class="ks-generation-course-paper">
            <div class="ks-generation-paper-header">
              <span class="ks-generation-paper-label"><span class="ks-generation-paper-label-mark"></span><span class="ks-generation-paper-stage-label">正在读取材料</span></span>
              <span class="ks-generation-paper-mini-progress"><span></span></span>
            </div>
            <div class="ks-generation-canvas-viewport">
              <div class="ks-generation-scan"></div>
              <div class="ks-generation-paper-noise"></div>
              <div class="ks-generation-canvas-content" aria-live="polite"></div>
            </div>
          </div>
        </div>
      </div>`;
    stage.appendChild(root);

    const summary = root.querySelector('.ks-generation-summary');
    const message = root.querySelector('.ks-generation-message');
    const disclosure = root.querySelector('.ks-generation-disclosure');
    const progress = root.querySelector('.ks-generation-progress');
    const progressValue = progress.querySelector(':scope > span');
    const history = root.querySelector('.ks-generation-history');
    const processList = root.querySelector('.ks-generation-process-list');
    const closeProcess = root.querySelector('.ks-generation-process-close');
    const canvas = root.querySelector('.ks-generation-canvas');
    const canvasContent = root.querySelector('.ks-generation-canvas-content');
    const scan = root.querySelector('.ks-generation-scan');
    const paperProgress = root.querySelector('.ks-generation-paper-mini-progress > span');
    const paperStageLabel = root.querySelector('.ks-generation-paper-stage-label');
    const lessonFrame = stage.querySelector('.lesson-frame');

    let visible = false;
    let latest = null;
    let activeRunId = null;
    let activePhase = 'extracting';
    let activeVariant = 'material';
    let liveMessage = '';
    let liveHistory = [];
    let displayedProgress = 0;
    let terminalState = null;
    let terminalMessage = '';
    let hideTimer = 0;
    const terminalRuns = new Set();

    function setExpanded(expanded) {
      summary.setAttribute('aria-expanded', String(expanded));
      history.hidden = !expanded;
      disclosure.textContent = expanded ? '收起生成过程' : '查看生成过程';
    }

    function resetRun(runId) {
      window.clearTimeout(hideTimer);
      activeRunId = runId || activeRunId;
      activePhase = 'extracting';
      activeVariant = 'material';
      liveMessage = '';
      liveHistory = [];
      displayedProgress = 0;
      terminalState = null;
      terminalMessage = '';
      root.classList.remove('is-complete', 'is-error');
    }

    function canAcceptEvent(event) {
      if (!event.runId) return !terminalState || event.kind === 'run-start';
      if (!activeRunId) {
        resetRun(event.runId);
        return true;
      }
      if (event.runId === activeRunId) return !terminalState || event.kind === 'run-complete' || event.kind === 'run-failed';
      if (terminalRuns.has(event.runId)) return false;
      if (event.kind === 'run-start') {
        resetRun(event.runId);
        return true;
      }
      return false;
    }

    function historyItemForPhase(phase) {
      for (let index = liveHistory.length - 1; index >= 0; index -= 1) {
        if (liveHistory[index].phase === phase) return liveHistory[index];
      }
      return null;
    }

    function renderProcess() {
      const activeIndex = Math.max(0, PHASE_ORDER.indexOf(activePhase));
      processList.innerHTML = PHASE_ORDER.map((phase, index) => {
        const actual = historyItemForPhase(phase);
        let state = actual?.state;
        if (!state) state = index < activeIndex ? 'complete' : index === activeIndex ? (terminalState === 'error' ? 'error' : 'active') : 'pending';
        if (phase === 'complete' && terminalState === 'complete') state = 'complete';
        const detail = actual?.detail || actual?.label || (state === 'complete' ? '已完成' : state === 'active' ? '正在处理' : state === 'error' ? terminalMessage : '等待开始');
        const stateLabel = state === 'complete' ? '完成' : state === 'active' ? '进行中' : state === 'error' ? '失败' : '等待';
        return `<div class="ks-generation-process-step is-${escapeHtml(state)}" data-phase="${phase}">
          <span class="ks-generation-step-indicator">${state === 'complete' ? '✓' : state === 'pending' ? index + 1 : state === 'error' ? '!' : ''}</span>
          <span class="ks-generation-step-copy"><span class="ks-generation-step-label">${PHASE_LABELS[phase]}</span><span class="ks-generation-step-detail">${escapeHtml(detail)}</span></span>
          <span class="ks-generation-step-state">${stateLabel}</span>
        </div>`;
      }).join('');
    }

    function runScan() {
      if (terminalState === 'error' || reduceMotion.matches) return;
      scan.classList.remove('is-running');
      void scan.offsetWidth;
      scan.classList.add('is-running');
    }

    function animateCanvas(html) {
      if (reduceMotion.matches || typeof canvasContent.animate !== 'function' || !canvasContent.childElementCount) {
        canvasContent.innerHTML = html;
        return;
      }
      canvasContent.classList.add('is-leaving');
      const outgoing = canvasContent.animate([
        { opacity: 1, transform: 'translateY(0) scale(1)' },
        { opacity: 0, transform: 'translateY(-7px) scale(.994)' },
      ], { duration: 280, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' });
      outgoing.finished.catch(() => {}).then(() => {
        canvasContent.innerHTML = html;
        canvasContent.classList.remove('is-leaving');
        canvasContent.animate([
          { opacity: 0, transform: 'translateY(9px) scale(.994)' },
          { opacity: 1, transform: 'translateY(0) scale(1)' },
        ], { duration: 520, easing: 'cubic-bezier(.16,.78,.22,1)', fill: 'both' });
      });
    }

    function renderVariant(variant, context = {}) {
      const normalized = stageTemplates[variant] ? variant : 'material';
      const phase = VARIANT_TO_PHASE[normalized] || activePhase;
      const changed = normalized !== activeVariant || !canvasContent.childElementCount;
      activeVariant = normalized;
      activePhase = phase;
      canvas.dataset.variant = normalized;
      paperStageLabel.textContent = PHASE_LABELS[phase] || '正在创建课程';
      if (changed) {
        animateCanvas(stageTemplates[normalized](context));
        runScan();
      }
      renderProcess();
    }

    function updateProgress(value) {
      displayedProgress = Math.max(displayedProgress, clampProgress(value));
      const progressText = `${displayedProgress}%`;
      progress.setAttribute('aria-valuenow', String(displayedProgress));
      progressValue.style.width = progressText;
      paperProgress.style.width = progressText;
    }

    function show() {
      if (visible) return;
      visible = true;
      root.hidden = false;
      stage.classList.add('is-generation-active');
      lessonFrame?.setAttribute('aria-hidden', 'true');
      requestAnimationFrame(() => {
        root.classList.add('is-visible');
        runScan();
      });
    }

    function update(status = {}) {
      latest = status;
      if (status.runId && status.runId !== activeRunId && !terminalRuns.has(status.runId)) resetRun(status.runId);
      if (terminalState && (!status.runId || status.runId === activeRunId) && !['ready', 'failed'].includes(status.stage)) return;
      show();
      liveMessage = liveMessage || status.currentMessage || status.error || '正在创建课程…';
      message.textContent = terminalMessage || liveMessage;
      updateProgress(status.progress);
      const variant = status.canvasVariant || PHASE_TO_VARIANT[status.phase] || activeVariant || 'material';
      renderVariant(variant, status);
    }

    function appendEvent(event = {}) {
      if (!event || !event.message || !canAcceptEvent(event)) return;
      const state = ['complete', 'active', 'error', 'pending'].includes(event.state)
        ? event.state
        : event.kind === 'run-complete' ? 'complete' : event.kind === 'run-failed' ? 'error' : 'active';
      const phase = event.phase || (event.kind === 'run-complete' ? 'complete' : activePhase);
      const key = event.key || `event:${event.id || `${event.kind}:${event.message}`}`;
      const item = { id: key, phase, label: event.message, detail: event.detail || '', state };
      const existing = liveHistory.findIndex((entry) => entry.id === key);
      if (existing >= 0) liveHistory[existing] = item;
      else liveHistory.push(item);
      liveHistory = liveHistory.slice(-40);
      liveMessage = event.message;
      show();
      message.textContent = liveMessage;
      const variant = event.canvasVariant || PHASE_TO_VARIANT[phase] || activeVariant;
      renderVariant(variant, event);

      if (event.kind === 'run-complete') {
        complete({ ...(latest || {}), runId: event.runId, currentMessage: event.message, history: liveHistory });
        hideTimer = window.setTimeout(() => hide(), 900);
      } else if (event.kind === 'run-failed') {
        fail({ ...(latest || {}), runId: event.runId, currentMessage: event.message, history: liveHistory });
      }
    }

    function complete(status = latest || {}) {
      if (status.runId && status.runId !== activeRunId) resetRun(status.runId);
      terminalState = 'complete';
      terminalMessage = status.currentMessage || '课程已准备好';
      if (activeRunId) terminalRuns.add(activeRunId);
      liveMessage = terminalMessage;
      updateProgress(100);
      show();
      message.textContent = terminalMessage;
      root.classList.remove('is-error');
      root.classList.add('is-complete');
      renderVariant('ready', status);
    }

    function fail(status = {}) {
      if (status.runId && status.runId !== activeRunId) resetRun(status.runId);
      terminalState = 'error';
      terminalMessage = status.currentMessage || status.error || '课程创建没有完成，请返回课程库后重试';
      if (activeRunId) terminalRuns.add(activeRunId);
      liveMessage = terminalMessage;
      show();
      message.textContent = terminalMessage;
      scan.classList.remove('is-running');
      root.classList.remove('is-complete');
      root.classList.add('is-error');
      renderVariant('error', status);
    }

    function hide({ immediate = false } = {}) {
      window.clearTimeout(hideTimer);
      if (!visible) return;
      visible = false;
      const finish = () => {
        root.hidden = true;
        root.classList.remove('is-visible', 'is-complete', 'is-error');
        stage.classList.remove('is-generation-active');
        lessonFrame?.removeAttribute('aria-hidden');
        setExpanded(false);
      };
      if (immediate || reduceMotion.matches) finish();
      else {
        root.classList.remove('is-visible');
        window.setTimeout(finish, 260);
      }
    }

    function destroy() {
      window.clearTimeout(hideTimer);
      if (window.KimiGenerationPreview?.current === api) window.KimiGenerationPreview.current = null;
      root.remove();
      stage.classList.remove('is-generation-active', 'ks-generation-host');
      lessonFrame?.removeAttribute('aria-hidden');
    }

    summary.addEventListener('click', () => setExpanded(summary.getAttribute('aria-expanded') !== 'true'));
    closeProcess.addEventListener('click', () => {
      setExpanded(false);
      summary.focus();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !history.hidden) {
        setExpanded(false);
        summary.focus();
      }
    });

    const api = { show, update, appendEvent, complete, fail, hide, destroy };
    window.KimiGenerationPreview.current = api;
    renderVariant('material');
    const queued = window.__kimiGenerationEventQueue || [];
    window.__kimiGenerationEventQueue = [];
    queued.forEach((event) => appendEvent(event));
    return api;
  }

  window.KimiGenerationPreview = { mount, current: null };
})();
