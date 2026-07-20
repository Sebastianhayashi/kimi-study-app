(() => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function mount(stage) {
    if (!stage) return { show() {}, update() {}, complete() {}, fail() {}, hide() {}, destroy() {} };

    stage.classList.add('ks-generation-host');
    const root = document.createElement('section');
    root.className = 'ks-generation-preview';
    root.hidden = true;
    root.setAttribute('aria-label', '课程生成进度');
    root.innerHTML = `
      <div class="ks-generation-top">
        <button class="ks-generation-summary" type="button" aria-expanded="false">
          <span class="ks-generation-message" aria-live="polite">正在准备课程生成环境…</span>
          <span class="ks-generation-disclosure">查看生成过程</span>
          <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m6 8 4 4 4-4"/></svg>
        </button>
        <div class="ks-generation-progress" role="progressbar" aria-label="课程生成进度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
          <span></span>
        </div>
        <div class="ks-generation-history" hidden></div>
      </div>

      <div class="ks-generation-canvas" data-variant="material" aria-hidden="true">
        <div class="ks-generation-paper">
          <div class="ks-generation-scan"></div>
          <div class="ks-generation-paper-head">
            <div class="ks-skeleton ks-skeleton-kicker"></div>
            <div class="ks-skeleton ks-skeleton-title"></div>
            <div class="ks-skeleton ks-skeleton-subtitle"></div>
          </div>
          <div class="ks-generation-objectives">
            <div class="ks-objective-mark"></div>
            <div class="ks-objective-lines">
              <div class="ks-skeleton"></div>
              <div class="ks-skeleton"></div>
              <div class="ks-skeleton"></div>
            </div>
          </div>
          <div class="ks-generation-section ks-generation-section-a">
            <div class="ks-skeleton ks-section-heading"></div>
            <div class="ks-skeleton ks-copy-line is-long"></div>
            <div class="ks-skeleton ks-copy-line"></div>
            <div class="ks-skeleton ks-copy-line is-short"></div>
          </div>
          <div class="ks-generation-card-grid">
            <div class="ks-generation-mini-card"><span></span><i></i></div>
            <div class="ks-generation-mini-card"><span></span><i></i></div>
            <div class="ks-generation-mini-card"><span></span><i></i></div>
          </div>
          <div class="ks-generation-section ks-generation-section-b">
            <div class="ks-skeleton ks-section-heading is-short"></div>
            <div class="ks-generation-question">
              <div class="ks-question-line"><b></b><span></span></div>
              <div class="ks-question-line"><b></b><span></span></div>
              <div class="ks-question-line"><b></b><span></span></div>
            </div>
          </div>
          <div class="ks-generation-status-chip">正在读取材料</div>
        </div>
      </div>
    `;
    stage.appendChild(root);

    const summary = root.querySelector('.ks-generation-summary');
    const message = root.querySelector('.ks-generation-message');
    const disclosure = root.querySelector('.ks-generation-disclosure');
    const progress = root.querySelector('.ks-generation-progress');
    const progressValue = progress.querySelector('span');
    const history = root.querySelector('.ks-generation-history');
    const canvas = root.querySelector('.ks-generation-canvas');
    const chip = root.querySelector('.ks-generation-status-chip');
    const lessonFrame = stage.querySelector('.lesson-frame');

    let visible = false;
    let latest = null;

    function renderHistory(items = []) {
      history.innerHTML = items.map((item) => {
        const icon = item.state === 'complete' ? '✓' : item.state === 'active' ? '●' : item.state === 'error' ? '!' : '○';
        return `<div class="ks-generation-step is-${escapeHtml(item.state)}"><span>${icon}</span><p>${escapeHtml(item.label)}</p></div>`;
      }).join('');
    }

    function setExpanded(expanded) {
      summary.setAttribute('aria-expanded', String(expanded));
      history.hidden = !expanded;
      disclosure.textContent = expanded ? '收起生成过程' : '查看生成过程';
    }

    summary.addEventListener('click', () => {
      setExpanded(summary.getAttribute('aria-expanded') !== 'true');
    });

    function show() {
      if (visible) return;
      visible = true;
      root.hidden = false;
      stage.classList.add('is-generation-active');
      lessonFrame?.setAttribute('aria-hidden', 'true');
      requestAnimationFrame(() => root.classList.add('is-visible'));
    }

    function update(status = {}) {
      latest = status;
      show();
      const value = Math.max(0, Math.min(100, Number(status.progress || 0)));
      message.textContent = status.currentMessage || '正在创建课程…';
      progress.setAttribute('aria-valuenow', String(value));
      progressValue.style.width = `${value}%`;
      canvas.dataset.variant = status.canvasVariant || 'material';
      chip.textContent = message.textContent.replace(/[…。]$/g, '');
      renderHistory(status.history);

      canvas.classList.remove('is-refreshing');
      requestAnimationFrame(() => {
        void canvas.offsetWidth;
        canvas.classList.add('is-refreshing');
      });
    }

    function complete(status = latest || {}) {
      update({
        ...status,
        progress: 100,
        canvasVariant: 'ready',
        currentMessage: '课程已经准备好',
      });
      root.classList.add('is-complete');
    }

    function fail(status = {}) {
      update({
        ...status,
        canvasVariant: 'error',
        currentMessage: status.currentMessage || '课程创建没有完成，请返回课程库后重试',
      });
      root.classList.add('is-error');
    }

    function hide({ immediate = false } = {}) {
      if (!visible) return;
      visible = false;
      const finish = () => {
        root.hidden = true;
        root.classList.remove('is-visible', 'is-complete', 'is-error');
        stage.classList.remove('is-generation-active');
        lessonFrame?.removeAttribute('aria-hidden');
      };
      if (immediate || reduceMotion.matches) finish();
      else {
        root.classList.remove('is-visible');
        window.setTimeout(finish, 260);
      }
    }

    function destroy() {
      root.remove();
      stage.classList.remove('is-generation-active', 'ks-generation-host');
      lessonFrame?.removeAttribute('aria-hidden');
    }

    return { show, update, complete, fail, hide, destroy };
  }

  window.KimiGenerationPreview = { mount };
})();
