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
    assembling: '组装课节',
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
  const STATUS_PHASES = {
    upload: 'extracting',
    extract: 'extracting',
    profile: 'profiling',
    claims: 'claims',
    blueprint: 'blueprint',
    questions: 'questions',
    quality: 'quality',
    lesson: 'assembling',
    validate: 'validating',
  };
  const METRIC_ALIASES = {
    units: ['units', 'unitsFound'],
    claims: ['claims', 'claimsFound'],
    candidates: ['candidates', 'candidatesGenerated'],
    accepted: ['accepted'],
    rejected: ['rejected'],
    lessonNumber: ['lessonNumber'],
  };

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

  function metricFrom(source, name) {
    const aliases = METRIC_ALIASES[name] || [name];
    const pools = [source?.metrics, source?.preview, source];
    for (const pool of pools) {
      for (const alias of aliases) {
        const value = Number(pool?.[alias]);
        if (Number.isInteger(value) && value >= 0) return value;
      }
    }
    return null;
  }

  function phaseIndex(phase) {
    const index = PHASE_ORDER.indexOf(phase);
    return index < 0 ? 0 : index;
  }

  function phaseFromStatus(status = {}) {
    if (PHASE_ORDER.includes(status.phase)) return status.phase;
    const history = Array.isArray(status.history) ? status.history : [];
    const active = history.find((item) => item?.state === 'active' || item?.state === 'error');
    const completed = [...history].reverse().find((item) => item?.state === 'complete');
    const historyPhase = STATUS_PHASES[active?.id] || STATUS_PHASES[completed?.id];
    if (historyPhase) return historyPhase;
    return VARIANT_TO_PHASE[status.canvasVariant] || null;
  }

  function line(width, className = '') {
    return `<div class="ks-fidelity-block-line ${className}" style="width:${width}%"></div>`;
  }

  function metricSuffix(value, unit) {
    return value === null ? '' : ` · ${value} ${unit}`;
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
      const units = metricFrom(context, 'units');
      const rowCount = units === null ? 5 : Math.max(1, Math.min(5, units));
      const remainingUnits = units === null ? 0 : Math.max(0, units - rowCount);
      const widths = [74, 86, 68, 80, 61];
      return `
        <div class="ks-fidelity-stage-caption">教材结构${metricSuffix(units, '个单元')}${remainingUnits ? ` · 展示前 ${rowCount} 个` : ''}</div>
        <div class="ks-fidelity-chapter-stack">
          ${Array.from({ length: rowCount }, (_, index) => `
            <div class="ks-fidelity-chapter-row">
              <span class="ks-fidelity-chapter-index">${String(index + 1).padStart(2, '0')}</span>
              <div class="ks-fidelity-chapter-copy">
                ${units === null ? '<div class="ks-fidelity-block-title" style="width:34%"></div>' : `<div class="ks-fidelity-chapter-title">已识别内容单元 ${index + 1}</div>`}
                ${line(widths[index % widths.length])}
              </div>
              <span class="ks-fidelity-chapter-tag ks-fidelity-skeleton-shimmer"></span>
            </div>`).join('')}
        </div>
        ${remainingUnits ? `<div class="ks-fidelity-chapter-overflow">还有 ${remainingUnits} 个单元已识别，将继续用于课程规划</div>` : ''}`;
    },

    claims(context) {
      const claims = metricFrom(context, 'claims');
      const cardCount = claims === null ? 4 : Math.max(1, Math.min(4, claims));
      return `
        <div class="ks-fidelity-stage-caption">本课学习目标${metricSuffix(claims, '个')}</div>
        <div class="ks-fidelity-objective-grid">
          ${Array.from({ length: cardCount }, (_, index) => `
            <article class="ks-fidelity-objective-card">
              <div class="ks-fidelity-objective-icon">${String.fromCharCode(65 + index)}</div>
              <div class="ks-fidelity-objective-title">学习目标 ${index + 1}</div>
              <div class="ks-fidelity-objective-copy ks-fidelity-skeleton-copy">${line(86)}${line(68)}</div>
            </article>`).join('')}
        </div>`;
    },

    practice() {
      return `
        <div class="ks-fidelity-stage-caption">练习路线 · 引导 → 独立 → 应用</div>
        <div class="ks-fidelity-exercise-stack">
          ${['引导练习', '独立练习', '应用任务'].map((kind, index) => `
            <article class="ks-fidelity-exercise-card">
              <div class="ks-fidelity-exercise-head"><span class="ks-fidelity-exercise-kind">${kind}</span><span class="ks-fidelity-exercise-score"></span></div>
              <div class="ks-fidelity-skeleton-copy">${line([72, 84, 66][index])}</div>
              <div class="ks-fidelity-choice-list">
                ${Array.from({ length: index === 1 ? 1 : 3 }, (_, option) => `<div class="ks-fidelity-choice"><span class="ks-fidelity-choice-dot"></span>${line([68, 80, 55][option % 3])}</div>`).join('')}
              </div>
            </article>`).join('')}
        </div>`;
    },

    questions(context) {
      const candidates = metricFrom(context, 'candidates');
      return `
        <div class="ks-fidelity-stage-caption">候选题目${metricSuffix(candidates, '道')}</div>
        <div class="ks-fidelity-exercise-stack">
          ${Array.from({ length: 3 }, (_, index) => `
            <article class="ks-fidelity-exercise-card">
              <div class="ks-fidelity-question-placeholder">${line([82, 74, 88][index], 'is-dark')}</div>
              <div class="ks-fidelity-choice-list">
                ${Array.from({ length: 3 }, (_, option) => `<div class="ks-fidelity-choice"><span class="ks-fidelity-choice-dot"></span>${line([68, 80, 55][option])}</div>`).join('')}
              </div>
            </article>`).join('')}
        </div>`;
    },

    quality(context) {
      const accepted = metricFrom(context, 'accepted');
      const rejected = metricFrom(context, 'rejected');
      const suffix = accepted === null && rejected === null ? '' : ` · 保留 ${accepted ?? '—'} / 移除 ${rejected ?? '—'}`;
      return `
        <div class="ks-fidelity-stage-caption">题目质量检查${suffix}</div>
        <div class="ks-fidelity-quality-grid">
          <div class="ks-fidelity-exercise-stack">
            <article class="ks-fidelity-exercise-card">
              <div class="ks-fidelity-exercise-head"><span class="ks-fidelity-exercise-kind"></span><span class="ks-fidelity-quality-state">检查中</span></div>
              <div class="ks-fidelity-question-placeholder">${line(82, 'is-dark')}</div>
              <div class="ks-fidelity-choice-list"><div class="ks-fidelity-choice"><span class="ks-fidelity-choice-dot"></span>${line(68)}</div><div class="ks-fidelity-choice"><span class="ks-fidelity-choice-dot"></span>${line(55)}</div></div>
            </article>
            <article class="ks-fidelity-exercise-card ks-fidelity-quality-card">
              <div class="ks-fidelity-exercise-head"><span class="ks-fidelity-exercise-kind"></span><span class="ks-fidelity-quality-state">比较中</span></div>
              <div class="ks-fidelity-question-placeholder">${line(66, 'is-dark')}</div>
              <div class="ks-fidelity-quality-reason">正在比较材料依据、目标对齐与重复度</div>
            </article>
          </div>
          <aside class="ks-fidelity-quality-side">
            ${['材料依据', '目标对齐', '答案明确', '误区诊断', '重复度'].map((label) => `<div class="ks-fidelity-quality-check is-pending">${label}</div>`).join('')}
          </aside>
        </div>`;
    },

    assembly(context) {
      const lessonNumber = metricFrom(context, 'lessonNumber');
      const lessonLabel = lessonNumber === null ? '课节' : `第 ${lessonNumber} 课`;
      return `
        <div class="ks-fidelity-lesson-hero">
          <div class="ks-fidelity-lesson-eyebrow">${lessonNumber === null ? 'Lesson' : `Lesson ${String(lessonNumber).padStart(4, '0')}`} · 正在组装</div>
          <h1 class="ks-fidelity-lesson-title">${lessonLabel}正在形成</h1>
          <p class="ks-fidelity-lesson-subtitle">讲解、示范和练习正在被整理到同一课节</p>
          <div class="ks-fidelity-lesson-goal ks-fidelity-skeleton-copy">${line(88)}${line(70)}</div>
        </div>
        <h2 class="ks-fidelity-lesson-section-title">课节内容</h2>
        <div class="ks-fidelity-vocab-grid">
          ${Array.from({ length: 6 }, () => `<div class="ks-fidelity-vocab-card"><div class="ks-fidelity-block-title" style="width:66%"></div><div class="ks-fidelity-vocab-cn">正在写入课节</div></div>`).join('')}
        </div>
        <h2 class="ks-fidelity-lesson-section-title">重点讲解</h2>
        <article class="ks-fidelity-exercise-card">${line(86, 'is-dark')}${line(74)}${line(92)}</article>`;
    },

    validation(context) {
      const lessonNumber = metricFrom(context, 'lessonNumber');
      return `
        <div class="ks-fidelity-lesson-hero">
          <div class="ks-fidelity-lesson-eyebrow">${lessonNumber === null ? 'Lesson' : `Lesson ${String(lessonNumber).padStart(4, '0')}`} · 互动验证</div>
          <h1 class="ks-fidelity-lesson-title">正在完成最后检查</h1>
          <p class="ks-fidelity-lesson-subtitle">题目、提示和评分规则正在连接</p>
          <div class="ks-fidelity-lesson-goal ks-fidelity-skeleton-copy">${line(88)}${line(70)}</div>
        </div>
        <h2 class="ks-fidelity-lesson-section-title">互动练习</h2>
        <article class="ks-fidelity-exercise-card">
          <div class="ks-fidelity-validation-head"><span>互动题目</span><span>验证中</span></div>
          <div class="ks-fidelity-choice-list"><div class="ks-fidelity-choice"><span class="ks-fidelity-choice-dot"></span>${line(68)}</div><div class="ks-fidelity-choice"><span class="ks-fidelity-choice-dot"></span>${line(80)}</div><div class="ks-fidelity-choice"><span class="ks-fidelity-choice-dot"></span>${line(55)}</div></div>
        </article>
        <div class="ks-fidelity-ready-badge is-working">正在连接答案、提示与评分规则</div>`;
    },

    ready(context) {
      const lessons = Number(context?.lessons);
      const lessonText = Number.isInteger(lessons) && lessons > 0 ? `已确认 ${lessons} 节课可以读取` : '课节文件已经通过后端检查';
      return `
        <div class="ks-fidelity-success-state">
          <div class="ks-fidelity-success-mark" aria-hidden="true">✓</div>
          <div class="ks-fidelity-lesson-eyebrow">课程已准备好</div>
          <h1 class="ks-fidelity-lesson-title">课程已准备好</h1>
          <p class="ks-fidelity-lesson-subtitle">${escapeHtml(lessonText)}</p>
          <div class="ks-fidelity-success-lines">${line(86, 'is-dark')}${line(72)}${line(54)}</div>
          <div class="ks-fidelity-ready-badge">课程可以开始</div>
        </div>`;
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
    if (!stage) return { show() {}, update() {}, appendEvent() {}, complete() { return Promise.resolve(); }, fail() {}, hide() {}, destroy() {} };

    stage.classList.add('ks-generation-host');
    const root = document.createElement('section');
    root.className = 'ks-generation-preview ks-generation-fidelity ks-generation-product';
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
            <div class="ks-generation-process-head"><span class="ks-generation-process-title">可验证的生成过程</span><button class="ks-generation-process-close" type="button" aria-label="关闭生成过程">×</button></div>
            <p class="ks-generation-proof">这里只展示 Kimi 主动上报的阶段、实际工具调用和文件产物；不会展示或推测隐藏推理。</p>
            <div class="ks-generation-process-list" aria-label="生成阶段"></div>
            <div class="ks-generation-event-section">
              <div class="ks-generation-event-heading">实时执行记录</div>
              <div class="ks-generation-event-log" aria-live="polite"></div>
            </div>
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
              <div class="ks-generation-canvas-content"></div>
              <div class="ks-generation-paper-activity"><span class="ks-generation-activity-origin">等待后端事件</span><span class="ks-generation-activity-message">正在连接课程生成进度</span></div>
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
    const eventLog = root.querySelector('.ks-generation-event-log');
    const closeProcess = root.querySelector('.ks-generation-process-close');
    const canvas = root.querySelector('.ks-generation-canvas');
    const canvasContent = root.querySelector('.ks-generation-canvas-content');
    const scan = root.querySelector('.ks-generation-scan');
    const paperProgress = root.querySelector('.ks-generation-paper-mini-progress > span');
    const paperStageLabel = root.querySelector('.ks-generation-paper-stage-label');
    const activityOrigin = root.querySelector('.ks-generation-activity-origin');
    const activityMessage = root.querySelector('.ks-generation-activity-message');
    const lessonFrame = stage.querySelector('.lesson-frame');

    let visible = false;
    let latest = null;
    let activeRunId = null;
    let activePhase = 'extracting';
    let activeVariant = 'material';
    let displayedProgress = 0;
    let terminalState = null;
    let terminalMessage = '';
    let liveMessage = '';
    let lastLiveEventAt = 0;
    let liveEvents = [];
    let phaseEvidence = new Map();
    let ambientTimer = 0;
    let exitTimer = 0;
    let finishTimer = 0;
    let completionPromise = null;
    let completionResolve = null;
    const terminalRuns = new Set();

    function setExpanded(expanded) {
      summary.setAttribute('aria-expanded', String(expanded));
      history.hidden = !expanded;
      disclosure.textContent = expanded ? '收起生成过程' : '查看生成过程';
    }

    function stopAmbient() {
      window.clearInterval(ambientTimer);
      ambientTimer = 0;
      scan.classList.remove('is-running');
    }

    function runScan() {
      if (terminalState || reduceMotion.matches || !visible) return;
      scan.classList.remove('is-running');
      void scan.offsetWidth;
      scan.classList.add('is-running');
    }

    function startAmbient() {
      if (terminalState || reduceMotion.matches || ambientTimer) return;
      runScan();
      ambientTimer = window.setInterval(runScan, 3600);
    }

    function resetRun(runId) {
      window.clearTimeout(exitTimer);
      window.clearTimeout(finishTimer);
      stopAmbient();
      activeRunId = runId || activeRunId;
      activePhase = 'extracting';
      activeVariant = 'material';
      displayedProgress = 0;
      terminalState = null;
      terminalMessage = '';
      liveMessage = '';
      lastLiveEventAt = 0;
      liveEvents = [];
      phaseEvidence = new Map();
      completionPromise = null;
      completionResolve = null;
      root.classList.remove('is-complete', 'is-error', 'is-success-enter', 'is-success-exit');
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

    function setPhaseEvidence(phase, state, detail, source) {
      if (!PHASE_ORDER.includes(phase)) return;
      const previous = phaseEvidence.get(phase);
      if (previous?.state === 'complete' && state !== 'error') return;
      phaseEvidence.set(phase, { state, detail: detail || previous?.detail || '', source: source || previous?.source || '' });
    }

    function ingestStatus(status) {
      for (const item of status.history || []) {
        const phase = STATUS_PHASES[item.id];
        if (!phase) continue;
        setPhaseEvidence(phase, item.state, item.label, '文件状态');
      }
      if (status.stage === 'ready' && status.lessons > 0) setPhaseEvidence('complete', 'complete', '后端已确认课节文件可读取', '后端状态');
      if (status.stage === 'failed') setPhaseEvidence(activePhase, 'error', status.error || status.currentMessage, '后端状态');
    }

    function renderProcess() {
      processList.innerHTML = PHASE_ORDER.map((phase, index) => {
        const evidence = phaseEvidence.get(phase);
        const state = evidence?.state || 'pending';
        const detail = evidence?.detail || (state === 'pending' ? '尚未收到后端确认' : '');
        const stateLabel = state === 'complete' ? '已确认' : state === 'active' ? '进行中' : state === 'error' ? '失败' : '等待';
        return `<div class="ks-generation-process-step is-${escapeHtml(state)}" data-phase="${phase}">
          <span class="ks-generation-step-indicator">${state === 'complete' ? '✓' : state === 'pending' ? index + 1 : state === 'error' ? '!' : ''}</span>
          <span class="ks-generation-step-copy"><span class="ks-generation-step-label">${PHASE_LABELS[phase]}</span><span class="ks-generation-step-detail">${escapeHtml(detail)}</span></span>
          <span class="ks-generation-step-state">${stateLabel}</span>
        </div>`;
      }).join('');
    }

    function originFor(event) {
      if (event.kind === 'phase') return 'Kimi 阶段上报';
      if (event.kind === 'artifact') return '文件产物';
      if (event.kind === 'tool') return '实际工具调用';
      if (event.kind === 'retry') return '自动重试';
      if (event.kind === 'compatibility') return '兼容模式';
      if (event.kind === 'run-start' || event.kind === 'run-complete' || event.kind === 'run-failed') return '后端任务';
      return '实时事件';
    }

    function renderEventLog() {
      if (!liveEvents.length) {
        eventLog.innerHTML = '<div class="ks-generation-event-empty">等待 Kimi 上报实际执行事件…</div>';
        return;
      }
      eventLog.innerHTML = liveEvents.slice(-12).reverse().map((event) => `
        <div class="ks-generation-event-row is-${escapeHtml(event.state || 'active')}">
          <span class="ks-generation-event-dot"></span>
          <span class="ks-generation-event-copy"><span class="ks-generation-event-origin">${escapeHtml(event.origin)}</span><span>${escapeHtml(event.message)}</span></span>
        </div>`).join('');
    }

    function animateCanvas(html) {
      if (reduceMotion.matches || typeof canvasContent.animate !== 'function' || !canvasContent.childElementCount) {
        canvasContent.innerHTML = html;
        return Promise.resolve();
      }
      canvasContent.classList.add('is-leaving');
      const outgoing = canvasContent.animate([
        { opacity: 1, transform: 'translateY(0) scale(1)' },
        { opacity: 0, transform: 'translateY(-7px) scale(.994)' },
      ], { duration: 280, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' });
      return outgoing.finished.catch(() => {}).then(() => {
        canvasContent.innerHTML = html;
        canvasContent.classList.remove('is-leaving');
        return canvasContent.animate([
          { opacity: 0, transform: 'translateY(9px) scale(.994)' },
          { opacity: 1, transform: 'translateY(0) scale(1)' },
        ], { duration: 520, easing: 'cubic-bezier(.16,.78,.22,1)', fill: 'both' }).finished.catch(() => {});
      });
    }

    function renderVariant(variant, context = {}, { force = false } = {}) {
      const normalized = stageTemplates[variant] ? variant : 'material';
      const nextPhase = VARIANT_TO_PHASE[normalized] || activePhase;
      if (!force && !terminalState && phaseIndex(nextPhase) < phaseIndex(activePhase)) return;
      const changed = normalized !== activeVariant || !canvasContent.childElementCount;
      activeVariant = normalized;
      activePhase = nextPhase;
      canvas.dataset.variant = normalized;
      canvas.dataset.phase = nextPhase;
      paperStageLabel.textContent = PHASE_LABELS[nextPhase] || '正在创建课程';
      if (changed || force) {
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

    function setActivity(origin, text) {
      activityOrigin.textContent = origin || '实时事件';
      activityMessage.textContent = text || '正在等待新的后端事件';
    }

    function show() {
      if (!visible) {
        visible = true;
        root.hidden = false;
        stage.classList.add('is-generation-active');
        lessonFrame?.setAttribute('aria-hidden', 'true');
        requestAnimationFrame(() => root.classList.add('is-visible'));
      }
      startAmbient();
    }

    function update(status = {}) {
      latest = status;
      if (status.runId && status.runId !== activeRunId && !terminalRuns.has(status.runId)) resetRun(status.runId);
      ingestStatus(status);
      if (status.stage === 'ready' && status.lessons > 0) return complete(status);
      if (status.stage === 'failed') {
        fail(status);
        return Promise.resolve();
      }
      if (terminalState) return completionPromise || Promise.resolve();
      show();
      updateProgress(status.progress);
      const statusMessage = status.currentMessage || status.error || '正在创建课程…';
      if (!lastLiveEventAt || Date.now() - lastLiveEventAt > 5000) {
        liveMessage = statusMessage;
        message.textContent = liveMessage;
        setActivity('文件状态', liveMessage);
      }
      const statusPhase = phaseFromStatus(status);
      const variant = statusPhase ? PHASE_TO_VARIANT[statusPhase] : (status.canvasVariant || activeVariant || 'material');
      renderVariant(variant, status);
      renderEventLog();
      return Promise.resolve();
    }

    function appendEvent(event = {}) {
      if (!event || !event.message || !canAcceptEvent(event)) return;
      const state = ['complete', 'active', 'error', 'pending'].includes(event.state)
        ? event.state
        : event.kind === 'run-complete' ? 'complete' : event.kind === 'run-failed' ? 'error' : 'active';
      const phase = event.phase || (event.kind === 'run-complete' ? 'complete' : null);
      const origin = originFor(event);
      const key = event.key || `event:${event.id || `${event.kind}:${event.message}`}`;
      const item = { id: key, phase, message: event.message, detail: event.detail || '', state, origin };
      const existing = liveEvents.findIndex((entry) => entry.id === key);
      if (existing >= 0) liveEvents[existing] = item;
      else liveEvents.push(item);
      liveEvents = liveEvents.slice(-40);
      lastLiveEventAt = Date.now();
      liveMessage = event.message;

      if (phase) setPhaseEvidence(phase, state, event.detail || event.message, origin);
      show();
      message.textContent = liveMessage;
      setActivity(origin, liveMessage);
      renderEventLog();
      renderProcess();

      const variant = phase ? PHASE_TO_VARIANT[phase] : event.canvasVariant;
      if (variant) renderVariant(variant, event);

      if (event.kind === 'run-complete') return complete({ ...(latest || {}), runId: event.runId, currentMessage: event.message });
      if (event.kind === 'run-failed') fail({ ...(latest || {}), runId: event.runId, currentMessage: event.message });
      return undefined;
    }

    function complete(status = latest || {}) {
      if (completionPromise) return completionPromise;
      if (status.runId && status.runId !== activeRunId) resetRun(status.runId);
      terminalState = 'complete';
      terminalMessage = '课程已准备好';
      if (activeRunId) terminalRuns.add(activeRunId);
      stopAmbient();
      show();
      updateProgress(100);
      setPhaseEvidence('complete', 'complete', '后端已确认课节文件可读取', '后端状态');
      message.textContent = terminalMessage;
      const lessonCount = Number(status.lessons);
      setActivity('后端任务', Number.isInteger(lessonCount) && lessonCount > 0
        ? `已确认 ${lessonCount} 节课可以读取`
        : '课节文件已经通过后端检查');
      root.classList.remove('is-error');
      root.classList.add('is-complete', 'is-success-enter');
      renderVariant('ready', status, { force: true });
      renderProcess();

      completionPromise = new Promise((resolve) => { completionResolve = resolve; });
      if (reduceMotion.matches) {
        finishTimer = window.setTimeout(() => {
          hide({ immediate: true });
          completionResolve?.();
          completionResolve = null;
        }, 80);
      } else {
        exitTimer = window.setTimeout(() => root.classList.add('is-success-exit'), 820);
        finishTimer = window.setTimeout(() => {
          hide({ immediate: true });
          completionResolve?.();
          completionResolve = null;
        }, 1520);
      }
      return completionPromise;
    }

    function fail(status = {}) {
      if (status.runId && status.runId !== activeRunId) resetRun(status.runId);
      terminalState = 'error';
      terminalMessage = status.currentMessage || status.error || '课程创建没有完成，请返回课程库后重试';
      if (activeRunId) terminalRuns.add(activeRunId);
      stopAmbient();
      show();
      message.textContent = terminalMessage;
      setActivity('后端任务', terminalMessage);
      setPhaseEvidence(activePhase, 'error', terminalMessage, '后端状态');
      root.classList.remove('is-complete', 'is-success-enter', 'is-success-exit');
      root.classList.add('is-error');
      renderVariant('error', status, { force: true });
      renderProcess();
    }

    function hide({ immediate = false } = {}) {
      if (!visible) return;
      visible = false;
      stopAmbient();
      const finish = () => {
        root.hidden = true;
        root.classList.remove('is-visible', 'is-complete', 'is-error', 'is-success-enter', 'is-success-exit');
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
      window.clearTimeout(exitTimer);
      window.clearTimeout(finishTimer);
      stopAmbient();
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
    renderVariant('material', {}, { force: true });
    renderEventLog();
    const queued = window.__kimiGenerationEventQueue || [];
    window.__kimiGenerationEventQueue = [];
    queued.forEach((event) => appendEvent(event));
    return api;
  }

  window.KimiGenerationPreview = { mount, current: null, successExitMs: 1520 };
})();
