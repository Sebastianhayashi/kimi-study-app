// Kimi Study 接线层：不改任何原型 DOM/样式，只把原型已有的交互接到真后端。
// 三个页面的 HTML 文件字节级冻结，本脚本在服务端输出时注入。
(() => {
  const path = location.pathname;

  // ---------- 落地页：按钮进入书架 ----------
  if (path === '/') {
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (btn && btn.dataset.action !== 'privacy') {
        e.stopPropagation();
        location.href = '/app';
      }
    }, true);
    return;
  }

  // ---------- 书架页：真实上传 + 轮询进度 + 进入课程 ----------
  if (path === '/app') {
    // First-run 建课使用独立页面。捕获阶段阻止旧上传弹窗继续接管主入口。
    document.addEventListener('click', (event) => {
      const trigger = event.target.closest('.create-button');
      if (!trigger) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      location.href = '/new-course';
    }, true);

    let courseId = null;
    const setStep = (el, cls, mark) => {
      el.className = 'progress-item ' + cls;
      el.querySelector('.progress-dot').textContent = mark;
    };

    // 覆盖原型的假上传（fileInput change / drop 都会调全局 beginUpload）
    window.beginUpload = function (file) {
      if (busy) return;
      busy = true;
      uploadIdle.classList.add('hide');
      uploadWorking.classList.add('show');
      dropzone.classList.add('disabled');
      fileName.textContent = file.name;
      fileSize.textContent = formatSize(file.size);
      fileBadge.textContent = (file.name.split('.').pop() || 'FILE').toUpperCase().slice(0, 4);

      const fd = new FormData();
      fd.append('file', file);
      fd.append('title', file.name.replace(/\.[^.]+$/, ''));
      fetch('/api/courses', { method: 'POST', body: fd })
        .then((r) => r.json())
        .then((data) => {
          courseId = data.id;
          setStep(progressUpload, 'done', '✓');
          setStep(progressUnderstand, 'active', '2');
          progressTitle.textContent = '正在打开课程生成界面';
          progressCopy.textContent = '你会在课程页面看到材料分析、学习目标、练习设计和课程组装的实时进度。';
          window.setTimeout(() => { location.href = `/course/${courseId}`; }, 180);
        })
        .catch(() => fail('上传失败，请重试'));
    };

    function poll() {
      fetch(`/api/courses/${courseId}/status`)
        .then((r) => r.json())
        .then((s) => {
          if (s.stage === 'ready' && s.lessons > 0) {
            setStep(progressUnderstand, 'done', '✓');
            setStep(progressOutline, 'done', '✓');
            progressTitle.textContent = '课程已经创建';
            progressCopy.textContent = `已生成 ${s.lessons} 节课，可以开始学习了。`;
            enterCourse.disabled = false;
            busy = false;
          } else if (s.stage === 'failed') {
            fail('课程创建失败，请关闭后重试');
          } else {
            if (s.stage === 'generating') {
              setStep(progressUnderstand, 'done', '✓');
              setStep(progressOutline, 'active', '3');
              progressTitle.textContent = '正在准备课程大纲';
            }
            setTimeout(poll, 4000);
          }
        })
        .catch(() => setTimeout(poll, 4000));
    }

    function fail(msg) {
      progressTitle.textContent = msg;
      busy = false; // 允许取消/关闭
    }

    // “进入课程”跳转（捕获阶段拦截原型的 toast）
    document.addEventListener('click', (e) => {
      if (e.target.closest('#enterCourse') && courseId) {
        e.stopPropagation();
        location.href = '/course/' + courseId;
      }
    }, true);

    // 真实课程列表（替换演示卡片）——纵向排布：封面在上、书名与元信息在下，沿用原型设计变量
    const cardStyle = document.createElement('style');
    cardStyle.textContent = `
      .course-card.ks-vertical { display: flex; flex-direction: column; height: auto; }
      .course-card.ks-vertical .course-cover { grid-row: auto; width: 100%; height: auto; aspect-ratio: 3/4; transform: none; }
      .course-card.ks-vertical .course-title { margin: 16px 0 0; align-self: stretch; }
      .course-card.ks-vertical .course-meta { position: static; margin-top: 6px; }
      .ks-menu { position: absolute; z-index: 60; background: #fff; border: 1px solid #e0e3e7;
        border-radius: 10px; box-shadow: 0 4px 16px rgba(0,0,0,.12); padding: 4px; min-width: 96px; }
      .ks-menu button { display: block; width: 100%; text-align: left; border: 0; background: none;
        padding: 8px 12px; border-radius: 6px; cursor: pointer; font-size: 13px; }
      .ks-menu button:hover { background: #f1f3f4; }
      .ks-menu button.ks-danger { color: #c5221f; }
    `;
    document.head.appendChild(cardStyle);

    // 卡片 ⋮ 菜单：归档 / 删除
    let cardMenu = null;
    const closeCardMenu = () => { cardMenu?.remove(); cardMenu = null; };
    function openCardMenu(btn, course, card) {
      closeCardMenu();
      cardMenu = document.createElement('div');
      cardMenu.className = 'ks-menu';
      cardMenu.innerHTML =
        '<button data-act="archive">归档</button>' +
        '<button data-act="delete" class="ks-danger">删除</button>';
      const r = btn.getBoundingClientRect();
      cardMenu.style.left = r.left + window.scrollX - 64 + 'px';
      cardMenu.style.top = r.bottom + window.scrollY + 4 + 'px';
      document.body.appendChild(cardMenu);
      cardMenu.addEventListener('click', (e) => {
        const act = e.target.dataset.act;
        if (!act) return;
        e.stopPropagation();
        closeCardMenu();
        if (act === 'delete') {
          if (!confirm(`删除《${course.title}》？此操作不可恢复。`)) return;
          fetch(`/api/courses/${course.id}`, { method: 'DELETE' }).then(() => card.remove());
        } else {
          fetch(`/api/courses/${course.id}/archive`, { method: 'POST' }).then(() => card.remove());
        }
      });
      setTimeout(() => document.addEventListener('click', closeCardMenu, { once: true }), 0);
    }

    function courseDestination(course) {
      if (course.onboardingState && course.onboardingState !== 'ready') {
        return `/new-course?course=${encodeURIComponent(course.id)}`;
      }
      return `/course/${encodeURIComponent(course.id)}`;
    }

    function courseMeta(course) {
      const material = `${course.ext} · 1 份材料`;
      if (course.onboardingState === 'awaiting_mission') return `等待学习设置 · ${material}`;
      if (course.onboardingState === 'starting' || course.onboardingState === 'generating') {
        return `正在创建课程 · ${material}`;
      }
      if (course.onboardingState === 'failed' || course.onboardingState === 'interrupted') {
        return `创建未完成，可重试 · ${material}`;
      }
      return `${course.lessons} 节课 · ${material}`;
    }

    const SHELF_POLL_MS = 2500;
    const grid = document.getElementById('courseGrid');
    const demoCards = [...grid.querySelectorAll('.course-card')];
    const tpl = demoCards.find((c) => c.querySelector('.generated-cover')) || demoCards[0];
    const templateCover = tpl.querySelector('.course-cover');
    const generatedCoverClass = templateCover.className;
    const generatedCoverHtml = templateCover.innerHTML;
    const courseCardsById = new Map();
    let shelfPollTimer = null;
    let shelfRequestInFlight = false;
    let shelfHasActive = false;
    let shelfLoaded = false;
    let shelfStopped = false;

    featuredSection.style.display = 'none'; // “继续学习”需要进度跟踪，v1 隐藏
    demoCards.forEach((card) => card.remove());

    function activeOnboarding(course) {
      return course.onboardingState === 'starting' || course.onboardingState === 'generating';
    }

    function stopShelfPolling() {
      shelfStopped = true;
      clearTimeout(shelfPollTimer);
      shelfPollTimer = null;
    }

    function scheduleShelfRefresh(delay = SHELF_POLL_MS) {
      if (shelfStopped) return;
      clearTimeout(shelfPollTimer);
      shelfPollTimer = setTimeout(() => {
        shelfPollTimer = null;
        refreshCourses();
      }, delay);
    }

    function updateCourseCard(el, course) {
      el._course = course;
      el.dataset.courseId = course.id;
      el.dataset.title = course.title;
      el.dataset.status = course.lessons ? 'learning' : 'mine';
      el.setAttribute('aria-label', course.title);
      const cover = el.querySelector('.course-cover');
      if (course.cover) {
        cover.className = 'course-cover real-cover';
        const currentImage = cover.querySelector('img');
        const src = `/api/courses/${course.id}/${course.cover}`;
        if (!currentImage || currentImage.getAttribute('src') !== src) {
          const image = document.createElement('img');
          image.src = src;
          image.alt = course.title;
          cover.replaceChildren(image);
        } else {
          currentImage.alt = course.title;
        }
      } else {
        if (!cover.querySelector('.cover-title')) {
          cover.className = generatedCoverClass;
          cover.innerHTML = generatedCoverHtml;
        }
        const coverTitle = cover.querySelector('.cover-title');
        if (coverTitle) coverTitle.textContent = course.title;
        const coverKind = cover.querySelector('.cover-kind');
        if (coverKind) coverKind.textContent = 'KIMI STUDY';
        const coverAuthor = cover.querySelector('.cover-author');
        if (coverAuthor) coverAuthor.textContent = `${course.ext} 材料`;
      }
      el.querySelector('.course-title').textContent = course.title;
      el.querySelector('.course-meta').textContent = courseMeta(course);
    }

    function createCourseCard(course) {
      const el = tpl.cloneNode(true);
      el.classList.add('ks-vertical');
      el.addEventListener('click', (event) => {
        if (event.target.closest('.course-menu')) return;
        location.href = courseDestination(el._course);
      });
      el.addEventListener('keydown', (event) => {
        if (event.target.closest('.course-menu')) return;
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        location.href = courseDestination(el._course);
      });
      el.querySelector('.course-menu').addEventListener('click', (event) => {
        event.stopPropagation();
        openCardMenu(event.currentTarget, el._course, el);
      });
      updateCourseCard(el, course);
      return el;
    }

    function renderCourses(list) {
      const seen = new Set();
      list.forEach((course) => {
        seen.add(course.id);
        let card = courseCardsById.get(course.id);
        if (!card) {
          card = createCourseCard(course);
          courseCardsById.set(course.id, card);
        } else {
          updateCourseCard(card, course);
        }
        grid.appendChild(card);
      });
      for (const [id, card] of courseCardsById) {
        if (seen.has(id)) continue;
        card.remove();
        courseCardsById.delete(id);
      }
      emptyState.style.display = list.length ? 'none' : '';
      shelfHasActive = list.some(activeOnboarding);
    }

    async function refreshCourses() {
      if (shelfStopped || shelfRequestInFlight) return;
      shelfRequestInFlight = true;
      try {
        const response = await fetch('/api/courses');
        if (!response.ok) throw new Error(`Course list failed: ${response.status}`);
        const list = await response.json();
        renderCourses(Array.isArray(list) ? list : []);
        shelfLoaded = true;
      } catch {
        // Keep the last coherent shelf and retry only while the initial load or an active course needs updates.
      } finally {
        shelfRequestInFlight = false;
        if (!shelfStopped && (shelfHasActive || !shelfLoaded)) scheduleShelfRefresh();
      }
    }

    window.addEventListener('pagehide', stopShelfPolling);
    refreshCourses();
    return;
  }

  // ---------- 课程工作区：真实课节 + 下一课 + 助教 ----------
  if (path.startsWith('/course/')) {
    const courseId = path.split('/').pop();
    const lessonFrame = document.getElementById('lessonFrame');
    const courseStage = document.querySelector('.course-stage');
    const generationProgressTools = window.KimiCoreJourneyProgress;

    function withLearnerGenerationFeedback(preview, host) {
      const root = host?.querySelector('.ks-generation-preview');
      const action = root?.querySelector('.ks-generation-status-action');
      const progressBar = root?.querySelector('.ks-generation-progress');
      const stageLabel = document.createElement('span');
      const elapsedLabel = document.createElement('span');
      stageLabel.className = 'ks-generation-stage-progress';
      elapsedLabel.className = 'ks-generation-elapsed';
      if (action) action.prepend(stageLabel, elapsedLabel);
      let startedAt = null;
      let activeRunId = null;
      let elapsedTimer = 0;

      const stopElapsed = () => {
        window.clearInterval(elapsedTimer);
        elapsedTimer = 0;
      };
      const renderElapsed = () => {
        if (!startedAt || !generationProgressTools) return;
        elapsedLabel.textContent = generationProgressTools.formatElapsed(startedAt);
      };
      const startElapsed = () => {
        if (!startedAt || elapsedTimer) return;
        renderElapsed();
        elapsedTimer = window.setInterval(renderElapsed, 1000);
      };
      const decorate = (status = {}) => {
        if (status.runId && status.runId !== activeRunId) {
          activeRunId = status.runId;
          startedAt = status.startedAt || null;
          stopElapsed();
        }
        startedAt = status.startedAt || startedAt || new Date().toISOString();
        const evidence = generationProgressTools?.deriveEvidenceProgress(status) || {
          determinate: Number.isFinite(Number(status.progress)),
          value: Number(status.progress) || 0,
          label: Number.isFinite(Number(status.progress)) ? `${Number(status.progress)}%` : '进行中',
        };
        stageLabel.textContent = status.stage === 'ready' ? '已完成' : evidence.label;
        progressBar?.classList.toggle('is-indeterminate', !evidence.determinate);
        if (status.stage === 'ready' || status.stage === 'failed') stopElapsed();
        else startElapsed();
        return { ...status, progress: evidence.determinate ? evidence.value : 0 };
      };

      const wrapped = {
        show: (...args) => preview.show?.(...args),
        update(status) { return preview.update?.(decorate(status)); },
        appendEvent(event) {
          if (event?.kind === 'run-start' && !startedAt) {
            startedAt = new Date().toISOString();
            startElapsed();
          }
          return preview.appendEvent?.(event);
        },
        complete(status) { return preview.complete?.(decorate({ ...(status || {}), stage: 'ready' })); },
        fail(status) { decorate({ ...(status || {}), stage: 'failed' }); return preview.fail?.(status); },
        hide(options) { stopElapsed(); return preview.hide?.(options); },
        destroy() { stopElapsed(); return preview.destroy?.(); },
      };
      if (window.KimiGenerationPreview?.current === preview) window.KimiGenerationPreview.current = wrapped;
      return wrapped;
    }

    const rawGenerationPreview = window.KimiGenerationPreview?.mount(courseStage) || {
      update() {}, complete() {}, fail() {}, hide() {}, appendEvent() {},
    };
    const generationPreview = withLearnerGenerationFeedback(rawGenerationPreview, courseStage);
    let generationWasActive = false;
    let generationFinishing = false;
    let generationPollTimer = null;
    let generationStartedAt = null;
    let currentLessonUrl = '';
    let resourceTools = { reset() {} };
    let lessons = [];
    let current = 0;
    const nextButton = document.getElementById('nextLessonButton');
    const nextButtonHtml = nextButton?.innerHTML || '下一课';
    const currentLessonLabel = document.querySelector('.current-lesson');
    const compactProgressBar = document.querySelector('.compact-progress .progress-track span');
    const compactProgressTrack = compactProgressBar?.parentElement;
    const compactProgressText = document.querySelector('.compact-progress > span');
    const lessonResourceSlot = document.getElementById('lessonResourceSlot');
    const overviewProgressSection = document.querySelector('#left-overview .side-section');
    const overviewProgressTitle = overviewProgressSection?.querySelector('.side-title');
    const overviewProgressNote = overviewProgressSection?.querySelector('.side-note');
    const overviewProgressBar = overviewProgressSection?.querySelector('.progress-track span');
    const overviewProgressTrack = overviewProgressBar?.parentElement;
    const overviewProgressValue = overviewProgressSection?.querySelector('.progress-value');
    const overviewRecordList = document.querySelector('#left-overview .record-list');
    const contextBar = document.querySelector('.context-bar');
    const titleOf = (f) => f.replace(/^\d+-?/, '').replace(/\.html$/, '');

    const generationEvidence = (status, complete = false) => {
      if (complete) return { determinate: true, value: 100, label: '已完成' };
      return generationProgressTools?.deriveEvidenceProgress(status) || {
        determinate: Number.isFinite(Number(status?.progress)),
        value: Math.max(0, Math.min(100, Number(status?.progress) || 0)),
        label: Number.isFinite(Number(status?.progress)) ? `${Number(status.progress)}%` : '进行中',
      };
    };
    const generationElapsed = (status) => generationProgressTools?.formatElapsed(
      status?.startedAt || generationStartedAt || Date.now(),
    ) || '已用时 00:00';

    function renderList() {
      document.querySelectorAll('.lesson-item').forEach((el, i) => {
        if (i < lessons.length) {
          el.style.display = '';
          el.querySelector('span:last-child').textContent = titleOf(lessons[i]);
          el.classList.toggle('active', i === current);
        } else {
          el.style.display = 'none';
        }
      });
    }

    function setGenerationChrome(status, { complete = false } = {}) {
      if (status?.startedAt) generationStartedAt = status.startedAt;
      const evidence = generationEvidence(status, complete);
      const progressWidth = evidence.determinate ? `${evidence.value}%` : '38%';
      const elapsed = generationElapsed(status);
      const shortElapsed = elapsed.replace('已用时 ', '');
      const initialGeneration = Number(status?.lessons || 0) === 0;

      if (overviewProgressTitle) overviewProgressTitle.textContent = '课程创建进度';
      if (overviewProgressNote) overviewProgressNote.textContent = complete ? '已完成' : elapsed;
      if (overviewProgressValue) overviewProgressValue.textContent = evidence.label;
      // The central generation preview owns the only workflow-primary progress bar.
      // Sidebar and header surfaces remain textual summaries instead of duplicating the same measure.
      if (overviewProgressTrack) overviewProgressTrack.hidden = true;
      if (overviewProgressBar) {
        overviewProgressBar.style.width = progressWidth;
        overviewProgressBar.parentElement?.classList.toggle('is-indeterminate', !evidence.determinate);
      }
      if (compactProgressText) compactProgressText.textContent = complete ? '已完成' : `${evidence.label} · ${shortElapsed}`;
      if (compactProgressTrack) compactProgressTrack.hidden = true;
      if (compactProgressBar) {
        compactProgressBar.style.width = progressWidth;
        compactProgressBar.parentElement?.classList.toggle('is-indeterminate', !evidence.determinate);
      }
      if (currentLessonLabel) {
        currentLessonLabel.textContent = complete
          ? '课程已准备好'
          : `${initialGeneration ? '第一课正在生成' : '正在生成下一课'} · ${shortElapsed}`;
      }
      if (lessonResourceSlot) lessonResourceSlot.style.visibility = 'hidden';
      if (overviewRecordList) {
        const recordState = complete ? 'complete' : '';
        const recordIcon = complete ? '✓' : '…';
        const recordTitle = complete ? '课程已准备好' : '正在创建课程';
        const recordMeta = complete
          ? '课节文件已经通过后端检查'
          : `${escapeHtml(status?.currentMessage || '正在等待新的生成进度')} · ${escapeHtml(elapsed)}`;
        overviewRecordList.innerHTML =
          '<article class="record complete"><span class="record-icon">✓</span><div><div class="record-title">材料已经上传</div><div class="record-meta">正在根据材料建立课程</div></div></article>' +
          `<article class="record ${recordState}"><span class="record-icon">${recordIcon}</span><div><div class="record-title">${recordTitle}</div><div class="record-meta">${recordMeta}</div></div></article>`;
      }
      if (nextButton) {
        nextButton.disabled = true;
        nextButton.hidden = initialGeneration || complete;
        if (!nextButton.hidden) {
          nextButton.classList.add('is-busy');
          nextButton.setAttribute('aria-label', `正在生成下一课，${elapsed}`);
          nextButton.title = `正在生成下一课，${elapsed}`;
          nextButton.innerHTML = '<span class="next-lesson-label">生成中</span><span class="next-lesson-spinner" aria-hidden="true"></span>';
        }
      }
    }

    function setGenerationFailureChrome(status = {}) {
      const evidence = generationEvidence(status);
      const terminalMessage = status.currentMessage || status.error || '课程创建没有完成，请返回课程库后重试';
      const stoppedLabel = evidence.label ? `已停止 · ${evidence.label}` : '已停止';

      if (overviewProgressTitle) overviewProgressTitle.textContent = '课程创建未完成';
      if (overviewProgressNote) overviewProgressNote.textContent = '已停止';
      if (overviewProgressValue) overviewProgressValue.textContent = stoppedLabel;
      if (overviewProgressTrack) overviewProgressTrack.hidden = true;
      if (compactProgressText) compactProgressText.textContent = `创建未完成 · ${evidence.label || '已停止'}`;
      if (compactProgressTrack) compactProgressTrack.hidden = true;
      if (currentLessonLabel) currentLessonLabel.textContent = '课程创建未完成';
      if (contextBar) contextBar.textContent = '当前上下文：课程创建未完成';
      if (lessonResourceSlot) lessonResourceSlot.style.visibility = 'hidden';
      if (overviewRecordList) {
        overviewRecordList.innerHTML =
          '<article class="record complete"><span class="record-icon">✓</span><div><div class="record-title">材料已经上传</div><div class="record-meta">材料已保留，可以返回课程库后重新创建</div></div></article>' +
          `<article class="record is-error"><span class="record-icon">!</span><div><div class="record-title">课程创建未完成</div><div class="record-meta">${escapeHtml(terminalMessage)}</div></div></article>`;
      }
      if (nextButton) {
        nextButton.hidden = true;
        nextButton.disabled = true;
        nextButton.classList.remove('is-busy');
        nextButton.setAttribute('aria-label', '课程创建未完成');
        nextButton.title = '课程创建未完成';
      }
    }

    function restoreLearningChrome() {
      if (overviewProgressTitle) overviewProgressTitle.textContent = '课程进度';
      if (overviewProgressTrack) overviewProgressTrack.hidden = false;
      if (compactProgressTrack) compactProgressTrack.hidden = false;
      renderLearningRecords();
      if (lessonResourceSlot) lessonResourceSlot.style.removeProperty('visibility');
      if (nextButton) {
        nextButton.hidden = false;
        nextButton.disabled = false;
        nextButton.classList.remove('is-busy');
        nextButton.setAttribute('aria-label', '生成下一课');
        nextButton.title = '生成下一课';
        nextButton.innerHTML = nextButtonHtml;
      }
      updateInfo();
      if (lessons.length && currentLessonLabel) {
        currentLessonLabel.textContent = `Lesson ${current + 1} · ${titleOf(lessons[current])}`;
      }
      if (contextBar && lessons.length) {
        contextBar.textContent = `当前上下文：Lesson ${current + 1} · ${titleOf(lessons[current])}`;
      }
    }

    function showLesson(i) {
      current = i;
      resourceTools.reset();
      courseStage?.classList.add('is-loading-lesson');
      currentLessonUrl = `/api/courses/${courseId}/lessons/${encodeURIComponent(lessons[i])}`;
      lessonFrame.removeAttribute('srcdoc');
      lessonFrame.src = currentLessonUrl;
      document.querySelector('.current-lesson').textContent = `Lesson ${i + 1} · ${titleOf(lessons[i])}`;
      if (contextBar) {
        contextBar.textContent = `当前上下文：Lesson ${i + 1} · ${titleOf(lessons[i])}`;
      }
      const progress = document.querySelector('.compact-progress > span');
      if (progress) progress.textContent = `${i + 1} / ${lessons.length}`;
      renderList();
      updateInfo();
    }

    let loaded = false;
    function loadLessons() {
      return fetch(`/api/courses/${courseId}/lessons`)
        .then((r) => r.json())
        .then((list) => {
          lessons = list;
          renderList();
          if (lessons.length && !loaded) {
            loaded = true;
            showLesson(0);
          }
        });
    }

    function scheduleGenerationPoll() {
      window.clearTimeout(generationPollTimer);
      generationPollTimer = window.setTimeout(pollCourseGeneration, 1800);
    }

    function pollCourseGeneration() {
      fetch(`/api/courses/${courseId}/status`)
        .then((r) => r.json())
        .then((status) => {
          if (status.stage === 'failed') {
            setGenerationFailureChrome(status);
            generationPreview.fail(status);
            return;
          }
          if (status.stage === 'ready' && status.lessons > 0) {
            if (generationWasActive) {
              if (generationFinishing) return;
              generationFinishing = true;
              setGenerationChrome(status, { complete: true });
              Promise.resolve(generationPreview.complete(status))
                .catch(() => {})
                .finally(() => location.reload());
              return;
            }
            generationPreview.hide({ immediate: true });
            restoreLearningChrome();
            loadLessons().then(restoreLearningChrome);
            return;
          }
          generationWasActive = true;
          generationFinishing = false;
          setGenerationChrome(status);
          generationPreview.update(status);
          scheduleGenerationPoll();
        })
        .catch(() => {
          generationWasActive = true;
          const reconnecting = {
            stage: 'generating',
            progress: 0,
            phase: 'extracting',
            lessons: lessons.length,
            canvasVariant: 'material',
            currentMessage: '正在连接课程生成进度…',
            history: [],
          };
          setGenerationChrome(reconnecting);
          generationPreview.update(reconnecting);
          scheduleGenerationPoll();
        });
    }

    // 学习地图：teach 工作区汇总（map.json）驱动；无则隐藏该 tab
    fetch(`/api/courses/${courseId}/map.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then((map) => {
        if (!map) {
          const mapTab = document.querySelector('[data-left-tab="map"]');
          if (mapTab) mapTab.style.display = 'none';
          return;
        }
        if (map.mission) {
          document.querySelector('.mission-title').textContent = map.mission.title;
          document.querySelector('.mission-copy').textContent = map.mission.copy;
          const lists = document.querySelectorAll('.mission-detail-list');
          const fill = (ul, items) => { if (ul && items && items.length) ul.innerHTML = items.map((i) => `<li>${escapeHtml(i)}</li>`).join(''); };
          fill(lists[0], map.mission.criteria);
          fill(lists[1], map.mission.constraints);
        }
        const stack = document.querySelector('#left-map .map-stack');
        const cards = stack.querySelectorAll(':scope > .teach-card');
        if (map.promise) cards[0].querySelector('.teach-card-copy').textContent = map.promise; // 课程承诺
        if (map.material) cards[1].querySelector('.teach-card-copy').textContent = map.material; // 材料理解
        cards[1].querySelector('.source-anchor-list')?.remove(); // demo 锚点
        if (map.methods && map.methods.length) {
          const list = stack.querySelector('.method-list');
          const tpl = list.querySelector('.method-card');
          list.innerHTML = '';
          map.methods.forEach((m) => {
            const el = tpl.cloneNode(true);
            el.querySelector('.method-title').textContent = m.name;
            el.querySelector('.method-trigger').innerHTML = `<strong>何时使用：</strong>${escapeHtml(m.when)}`;
            el.querySelector('.method-boundary').innerHTML = `<strong>边界：</strong>${escapeHtml(m.boundary)}`;
            list.appendChild(el);
          });
          stack.querySelector('.side-section .side-note').textContent = `${map.methods.length} 个`;
        }
        if (map.path && map.path.length) {
          cards[2].querySelector('.path-list').innerHTML = map.path
            .map((p, i) => `<div class="path-row"><span class="path-index">${i + 1}</span><span>${escapeHtml(p)}</span></div>`)
            .join('');
          cards[2].querySelector('.teach-card-meta').textContent = `${map.path.length} 个能力切片`;
        }
        cards[3]?.remove(); // “本课程暂不展开”演示卡
        cards[4]?.remove(); // “补充资料”演示卡
      });

    function renderLearningRecords() {
      if (!overviewRecordList) return;

      const totalLessons = lessons.length;
      const isGenerating = !!(generationWasActive || generationFinishing);

      if (totalLessons === 0) {
        if (isGenerating) {
          overviewRecordList.innerHTML = `
            <article class="record">
              <span class="record-icon">…</span>
              <div>
                <div class="record-title">正在生成课程</div>
                <div class="record-meta">请耐心等待</div>
              </div>
            </article>
          `;
        } else {
          overviewRecordList.innerHTML = `
            <article class="record warning">
              <span class="record-icon">?</span>
              <div>
                <div class="record-title">课程未就绪</div>
                <div class="record-meta">尚未生成课节文件</div>
              </div>
            </article>
          `;
        }
        return;
      }

      const record1Html = `
        <article class="record complete">
          <span class="record-icon">✓</span>
          <div>
            <div class="record-title">课程已创建</div>
            <div class="record-meta">已生成 ${totalLessons} 节课</div>
          </div>
        </article>
      `;

      const currentTitle = lessons[current] ? escapeHtml(titleOf(lessons[current])) : '';
      const record2Html = `
        <article class="record">
          <span class="record-icon">${current + 1}</span>
          <div>
            <div class="record-title">正在学习 Lesson ${current + 1}</div>
            <div class="record-meta">${currentTitle}</div>
          </div>
        </article>
      `;

      let record3Html = '';
      if (isGenerating) {
        record3Html = `
          <article class="record">
            <span class="record-icon">…</span>
            <div>
              <div class="record-title">正在生成下一课</div>
              <div class="record-meta">正在构建讲解与示范…</div>
            </div>
          </article>
        `;
      }

      overviewRecordList.innerHTML = record1Html + record2Html + record3Html;
    }

    // 头部 + 学习概览换成真实课程信息
    function updateInfo() {
      document.querySelector('.course-meta').textContent = `${lessons.length || '…'} 节课 · 1 份材料`;
      const chips = document.querySelectorAll('.mission-status .context-chip');
      if (chips[2]) chips[2].textContent = `${lessons.length || '…'} 节课`;
      const note = document.querySelector('.side-section .side-note');
      if (note) note.textContent = `${current + 1} / ${lessons.length || '…'}`;
      const pct = lessons.length ? Math.round(((current + 1) / lessons.length) * 100) : 0;
      const pv = document.querySelector('.side-section .progress-value');
      if (pv) pv.textContent = pct + '%';
      const bar = document.querySelector('.side-section .progress-track span');
      if (bar) bar.style.width = pct + '%';
      if (compactProgressBar) compactProgressBar.style.width = pct + '%';
      renderLearningRecords();
    }

    fetch(`/api/courses/${courseId}/info`)
      .then((r) => r.json())
      .then((info) => {
        document.querySelector('.course-name').textContent = info.title;
        document.title = `${info.title} · Kimi Study`;
        document.querySelector('.mission-title').textContent = `掌握《${info.title}》的核心内容与方法`;
        document.querySelector('.mission-copy').textContent = '本课程由 Kimi 根据你上传的材料生成，跟随课程目录逐课学习即可。';
        const chips = document.querySelectorAll('.mission-status .context-chip');
        if (chips[1]) chips[1].hidden = true; // “约 90 分钟”是演示数据
        updateInfo();
      });

    // 课节点击 / 下一课 / 返回：捕获阶段拦截原型的 toast
    document.addEventListener('click', (e) => {
      const item = e.target.closest('.lesson-item');
      if (item) {
        e.stopPropagation();
        const idx = [...document.querySelectorAll('.lesson-item')].indexOf(item);
        if (idx >= 0 && idx < lessons.length) showLesson(idx);
        return;
      }
      if (e.target.closest('#nextLessonButton')) {
        e.stopPropagation();
        nextLesson();
        return;
      }
      if (e.target.closest('#sendButton')) {
        // 原型在脚本加载时把旧 sendMessage 按引用注册给了按钮，必须在捕获阶段拦掉
        e.stopPropagation();
        window.sendMessage();
        return;
      }
      if (e.target.closest('#backButton')) {
        e.stopPropagation();
        location.href = '/app';
      }
    }, true);

    function nextLesson() {
      if (!nextButton || nextButton.disabled) return;
      const before = lessons.length;
      const restoreBtn = () => {
        generationWasActive = false;
        generationFinishing = false;
        generationPreview.hide({ immediate: true });
        restoreLearningChrome();
      };
      generationWasActive = true;
      generationFinishing = false;
      generationStartedAt = new Date().toISOString();
      const startingStatus = {
        stage: 'generating',
        startedAt: generationStartedAt,
        progress: 0,
        phase: 'extracting',
        canvasVariant: 'material',
        lessons: before,
        currentMessage: '正在准备下一课…',
        history: [],
      };
      setGenerationChrome(startingStatus);
      generationPreview.update(startingStatus);
      showToast('Kimi 正在准备下一课，通常需要几分钟…');
      fetch(`/api/courses/${courseId}/lessons/next`, { method: 'POST' }).then(async (r) => {
        if (r.status === 409) {
          restoreBtn();
          showToast('Kimi 正在忙，请等当前回答完成后再试');
          return;
        }
        if (!r.ok) {
          const data = await r.json().catch(() => ({}));
          throw new Error(data.error || `HTTP ${r.status}`);
        }
        const timer = window.setInterval(() => {
          fetch(`/api/courses/${courseId}/status`)
            .then((r) => r.json())
            .then((s) => {
              if (s.stage === 'failed') {
                window.clearInterval(timer);
                setGenerationFailureChrome(s);
                generationPreview.fail(s);
                return;
              }
              if (s.stage !== 'ready' || s.busy) {
                setGenerationChrome(s);
                generationPreview.update(s);
                return;
              }
              window.clearInterval(timer);
              setGenerationChrome(s, { complete: true });
              Promise.resolve(generationPreview.complete(s)).finally(() => {
                loadLessons().then(() => {
                  generationWasActive = false;
                  generationFinishing = false;
                  if (lessons.length > before) showLesson(lessons.length - 1);
                  else showToast('下一课生成失败，请重试');
                  restoreLearningChrome();
                });
              });
            });
        }, 1800);
      }).catch(() => {
        restoreBtn();
        showToast('下一课没有开始。当前课程仍然安全，请重试。');
      });
    }

    // 划词问助手：iframe 发来选中内容 -> 输入框上方引用 chip
    let selectionContext = null;
    let chipEl = null;
    function hideQuoteChip() {
      chipEl?.remove();
      chipEl = null;
      selectionContext = null;
    }
    function showQuoteChip(ctx) {
      hideQuoteChip();
      selectionContext = ctx;
      chipEl = document.createElement('div');
      chipEl.className = 'ks-selection-quote';
      const label = document.createElement('span');
      label.className = 'ks-selection-quote-copy';
      label.textContent = `引用 · ${ctx.section || '当前课节'}：“${ctx.selectedText.slice(0, 80)}${ctx.selectedText.length > 80 ? '…' : ''}”`;
      const close = document.createElement('button');
      close.type = 'button';
      close.className = 'ks-selection-quote-close';
      close.textContent = '×';
      close.title = '移除引用';
      close.setAttribute('aria-label', '移除引用');
      close.onclick = hideQuoteChip;
      chipEl.append(label, close);
      const composer = document.querySelector('.composer');
      composer.parentElement.insertBefore(chipEl, composer);
    }
    window.addEventListener('message', (e) => {
      if (e.source === lessonFrame.contentWindow && e.data?.type === 'lesson-visual-ready') {
        courseStage?.classList.remove('is-loading-lesson');
      }
      if (e.data && e.data.type === 'ask-selection') {
        showQuoteChip(e.data);
        if (e.data.suggestedPrompt) {
          assistantInput.value = String(e.data.suggestedPrompt).slice(0, 4000);
          sendButton.disabled = !assistantInput.value.trim();
        }
        if (window.matchMedia('(max-width: 860px)').matches) {
          document.getElementById('mobileAssistantButton')?.click();
        } else {
          document.getElementById('restoreAssistantButton')?.click();
        }
        assistantInput.focus();
      }
    });

    // 修复原型缺陷：桌面端侧栏被折叠（left-collapsed/right-collapsed）后，
    // 「学习概览」「助手」等按钮只加 mobile-open 类，桌面端无效，表现为“侧栏打不开”
    [
      ['mobileContextButton', 'restoreLeftButton'],
      ['courseContextButton', 'restoreLeftButton'],
      ['mobileAssistantButton', 'restoreAssistantButton'],
    ].forEach(([btnId, restoreId]) => {
      document.getElementById(btnId)?.addEventListener('click', () => {
        document.getElementById(restoreId)?.click();
      });
    });

    // 建议按钮：后端动态生成，失败回退固定四个（替换原型静态按钮，点击发送 prompt 全文）
    const DEFAULT_SUGGESTIONS = [
      { label: '用中文解释本课', prompt: '用中文解释本课' },
      { label: '总结三个核心观点', prompt: '总结三个核心观点' },
      { label: '举一个工作场景的例子', prompt: '举一个工作场景的例子' },
      { label: '检查我的理解', prompt: '检查我的理解' },
    ];
    const quickPrompts = document.querySelector('.quick-prompts');

    const glueStyle = document.createElement('style');
    glueStyle.textContent =
      '.thinking-dots i{display:inline-block;width:5px;height:5px;border-radius:50%;background:#3568c8;margin-left:4px;animation:kimiThinking 1.2s infinite}' +
      '.thinking-dots i:nth-child(2){animation-delay:.15s}.thinking-dots i:nth-child(3){animation-delay:.3s}' +
      '@keyframes kimiThinking{0%,80%,100%{opacity:.25;transform:translateY(0)}40%{opacity:1;transform:translateY(-3px)}}' +
      '.thinking-elapsed{color:#777b82;font-size:12px;margin-left:6px}' +
      '.quick-prompt:disabled{opacity:.5;cursor:default}' +
      '.message.assistant p{margin:0 0 8px}.message.assistant p:last-child{margin-bottom:0}' +
      '.message.assistant ul,.message.assistant ol{margin:4px 0 8px;padding-left:20px}' +
      '.message.assistant li{margin:2px 0}' +
      '.message.assistant code{background:#f1f5ff;border-radius:4px;padding:1px 4px;font-size:12px}' +
      '.message.assistant table{border-collapse:collapse;margin:6px 0 10px;font-size:13px}' +
      '.message.assistant th,.message.assistant td{border:1px solid #dedbd3;padding:4px 10px;text-align:left}' +
      '.message.assistant th{background:#f3f0e9}';
    document.head.appendChild(glueStyle);

    // 极简 markdown：加粗/行内代码/无序与有序列表/段落（先转义再替换，防注入）
    function mdToHtml(text) {
      const inline = (s) => escapeHtml(s)
        .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/`([^`]+)`/g, '<code>$1</code>');
      let html = '', listTag = null, inTable = false;
      const closeBlocks = () => {
        if (listTag) { html += `</${listTag}>`; listTag = null; }
        if (inTable) { html += '</table>'; inTable = false; }
      };
      for (const line of String(text).split('\n')) {
        const t = line.trim();
        const heading = t.match(/^(#{1,3})\s+(.*)/);
        const quote = t.match(/^>\s?(.*)/);
        const ul = t.match(/^[-*]\s+(.*)/);
        const ol = t.match(/^\d+[.、]\s*(.*)/);
        if (heading) {
          closeBlocks();
          const level = heading[1].length;
          html += `<h${level}>${inline(heading[2])}</h${level}>`;
        } else if (quote) {
          closeBlocks();
          html += `<blockquote>${inline(quote[1])}</blockquote>`;
        } else if (t.startsWith('|') && t.endsWith('|')) {
          const cells = t.slice(1, -1).split('|').map((c) => c.trim());
          if (cells.every((c) => /^:?-{2,}:?$/.test(c))) continue; // 分隔行 |---|
          if (!inTable) { closeBlocks(); html += '<table>'; inTable = true; }
          const tag = html.endsWith('<table>') ? 'th' : 'td';
          html += '<tr>' + cells.map((c) => `<${tag}>${inline(c)}</${tag}>`).join('') + '</tr>';
        } else if (ul || ol) {
          if (inTable) { html += '</table>'; inTable = false; }
          const tag = ul ? 'ul' : 'ol';
          if (listTag !== tag) { if (listTag) html += `</${listTag}>`; html += `<${tag}>`; listTag = tag; }
          html += `<li>${inline((ul || ol)[1])}</li>`;
        } else {
          closeBlocks();
          if (t) html += `<p>${inline(t)}</p>`;
        }
      }
      closeBlocks();
      return html;
    }

    function resourceDocument(markdown, baseUrl) {
      const safeBase = escapeHtml(baseUrl).replace(/"/g, '&quot;');
      return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><base href="${safeBase}" target="_blank"><style>*{box-sizing:border-box}body{max-width:920px;margin:0 auto;padding:34px clamp(24px,6vw,72px) 52px;color:#3c4043;background:#fff;font-family:Inter,system-ui,-apple-system,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;font-size:15px;line-height:1.78}h1,h2,h3{color:#1f1f1f}h1{font-size:28px}h2{margin-top:30px;font-size:20px}h3{margin-top:24px;font-size:17px}a{color:#0b57d0}table{display:block;max-width:100%;overflow:auto;border-collapse:collapse}th,td{padding:8px 10px;border:1px solid #dfe3ea;text-align:left}th{background:#f1f4f9}code{padding:2px 5px;border-radius:5px;background:#f1f4f9}blockquote{margin:18px 0;padding:10px 14px;border-left:3px solid #a9c7f4;background:#edf4ff}</style></head><body>${mdToHtml(markdown)}</body></html>`;
    }

    function mountResourceTools() {
      const slot = document.getElementById('lessonResourceSlot');
      if (!slot || !lessonFrame) return { reset() {} };
      slot.classList.add('ks-lesson-tools');

      const tools = [
        { kind: 'mission', label: '任务', pattern: /(?:^|\/)MISSION\.md(?:$|[?#])/i, icon: '<svg viewBox="0 0 24 24"><path d="M9 11l2 2 4-4"/><path d="M6 4h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"/></svg>' },
        { kind: 'resources', label: '资源', pattern: /(?:^|\/)RESOURCES\.md(?:$|[?#])/i, icon: '<svg viewBox="0 0 24 24"><path d="M3.5 6.5h6l2 2h9v9A2.5 2.5 0 0 1 18 20H6a2.5 2.5 0 0 1-2.5-2.5Z"/><path d="M3.5 9h17"/></svg>' },
        { kind: 'success', label: 'SUCCESS', pattern: /(?:success|succes)[^/]*\.html?(?:$|[?#])/i, icon: '<svg viewBox="0 0 24 24"><path d="M12 3l1.4 4.1L17.5 8.5l-4.1 1.4L12 14l-1.4-4.1-4.1-1.4 4.1-1.4Z"/></svg>' },
      ];
      let showingResource = false;
      let activeButton = null;
      let requestId = 0;

      // 笔记栏开关：暖橘色，跟随资源按钮家族样式；状态由课节 iframe 内的 MarginLayout 持有
      const toggleStyle = document.createElement('style');
      toggleStyle.textContent = `
        .lesson-resource-tool.kn-notes-toggle { color: #b4620d; border-color: #f2c894; background: #fff7ec; }
        .lesson-resource-tool.kn-notes-toggle:hover { background: #ffefd9; }
        .lesson-resource-tool.kn-notes-toggle[aria-pressed="true"] { color: #fff; border-color: #f2994a; background: #f2994a; }
      `;
      document.head.appendChild(toggleStyle);
      let notesButton = null;
      window.addEventListener('message', (event) => {
        if (event.data?.type === 'notes-panel-state' && notesButton) {
          notesButton.setAttribute('aria-pressed', String(!!event.data.collapsed));
        }
      });

      const setActive = (button) => {
        slot.querySelectorAll('button:not(.kn-notes-toggle)').forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
        activeButton = button;
      };

      const restoreLesson = () => {
        requestId += 1;
        showingResource = false;
        setActive(null);
        lessonFrame.removeAttribute('srcdoc');
        lessonFrame.src = currentLessonUrl;
      };

      const openResource = async (resource, button) => {
        if (showingResource && activeButton === button) {
          restoreLesson();
          return;
        }
        showingResource = true;
        setActive(button);
        const id = ++requestId;
        if (/\.md(?:$|[?#])/i.test(resource.href)) {
          try {
            const response = await fetch(resource.href);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const markdown = await response.text();
            if (id !== requestId) return;
            lessonFrame.removeAttribute('src');
            lessonFrame.srcdoc = resourceDocument(markdown, resource.href);
          } catch {
            if (id === requestId) restoreLesson();
          }
          return;
        }
        lessonFrame.removeAttribute('srcdoc');
        lessonFrame.src = resource.href;
      };

      const sync = () => {
        if (showingResource) return;
        slot.replaceChildren();
        let doc;
        try { doc = lessonFrame.contentDocument; } catch { return; }
        if (!doc) return;
        const links = [...doc.querySelectorAll('a[href]')];
        tools.forEach((tool) => {
          const link = links.find((item) => tool.pattern.test(item.href || item.getAttribute('href') || ''));
          if (!link || !link.href.startsWith(`${location.origin}/api/courses/${courseId}/`)) return;
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'pill lesson-resource-tool';
          button.setAttribute('aria-pressed', 'false');
          button.title = tool.label;
          button.innerHTML = `${tool.icon}<span class="lesson-resource-tool-label">${tool.label}</span>`;
          button.addEventListener('click', () => openResource({ href: link.href }, button));
          slot.appendChild(button);
          // 课节内的原始链接接进同一流程，避免 iframe 跳去显示裸 markdown
          links.forEach((item) => {
            if (!tool.pattern.test(item.href || item.getAttribute('href') || '')) return;
            item.addEventListener('click', (event) => {
              event.preventDefault();
              openResource({ href: link.href }, button);
            });
          });
        });
        slot.hidden = slot.childElementCount === 0;

        // 笔记栏开关（始终存在，不依赖链接发现）
        notesButton = document.createElement('button');
        notesButton.type = 'button';
        notesButton.className = 'pill lesson-resource-tool kn-notes-toggle';
        notesButton.setAttribute('aria-pressed', 'false');
        notesButton.title = '收起 / 展开笔记栏';
        notesButton.innerHTML = `<svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg><span class="lesson-resource-tool-label">笔记</span>`;
        notesButton.addEventListener('click', () => {
          lessonFrame.contentWindow?.postMessage({ type: 'toggle-notes-panel' }, '*');
        });
        slot.appendChild(notesButton);
        lessonFrame.contentWindow?.postMessage({ type: 'notes-panel-query' }, '*');
      };

      lessonFrame.addEventListener('load', sync);
      return {
        reset() {
          requestId += 1;
          showingResource = false;
          activeButton = null;
          slot.replaceChildren();
          slot.hidden = true;
        },
      };
    }

    resourceTools = mountResourceTools();

    // 助教消息渲染（带 markdown），替代原型 addAssistantMessage 的纯文本 <p>
    function renderAssistant(body) {
      const shouldStick = chatThread.scrollHeight - chatThread.scrollTop - chatThread.clientHeight < 96;
      const el = document.createElement('div');
      el.className = 'message assistant ks-markdown-message';
      const renderer = window.KimiAssistantMarkdown;
      el.innerHTML = `<div class="ks-markdown">${renderer ? renderer.render(body) : mdToHtml(body)}</div>`;
      chatThread.appendChild(el);
      if (shouldStick) requestAnimationFrame(() => { chatThread.scrollTop = chatThread.scrollHeight; });
    }

    function renderTutorError(message, retryText, retryContext) {
      const el = document.createElement('div');
      el.className = 'message assistant ks-tutor-error';
      const title = document.createElement('strong');
      title.textContent = '导师暂时没有完成回答';
      const copy = document.createElement('div');
      copy.textContent = message || '你的课程、进度和笔记都已保留。';
      const retry = document.createElement('button');
      retry.type = 'button';
      retry.textContent = '重试这个问题';
      retry.addEventListener('click', () => {
        assistantInput.value = retryText;
        if (retryContext) showQuoteChip(retryContext);
        sendButton.disabled = false;
        window.sendMessage();
      });
      el.append(title, copy, retry);
      chatThread.appendChild(el);
      chatThread.scrollTop = chatThread.scrollHeight;
    }

    function setQuickPromptsEnabled(on) {
      quickPrompts.querySelectorAll('button').forEach((b) => (b.disabled = !on));
    }

    function renderSuggestions(list) {
      quickPrompts.innerHTML = '';
      list.forEach((s) => {
        const b = document.createElement('button');
        b.className = 'quick-prompt';
        b.type = 'button';
        b.textContent = s.label;
        b.addEventListener('click', () => {
          assistantInput.value = s.prompt;
          sendButton.disabled = false;
          window.sendMessage();
        });
        quickPrompts.appendChild(b);
      });
    }

    // 覆盖原型的罐头回复（Enter / 快捷提问 / 发送按钮都调全局 sendMessage）
    window.sendMessage = function () {
      const text = assistantInput.value.trim();
      if (!text) return;
      const ctx = selectionContext;
      if (ctx) hideQuoteChip();
      const user = document.createElement('div');
      user.className = 'message user';
      user.innerHTML = `<p>${escapeHtml(text)}</p>`;
      chatThread.appendChild(user);
      assistantInput.value = '';
      sendButton.disabled = true;
      chatThread.scrollTop = chatThread.scrollHeight;

      const thinking = document.createElement('div');
      thinking.className = 'message assistant';
      thinking.innerHTML = '<p>Kimi 正在思考<span class="thinking-dots"><i></i><i></i><i></i></span><span class="thinking-elapsed"></span></p>';
      chatThread.appendChild(thinking);
      chatThread.scrollTop = chatThread.scrollHeight;
      setQuickPromptsEnabled(false);
      const startedAt = Date.now();
      const elapsedEl = thinking.querySelector('.thinking-elapsed');
      const thinkingTimer = setInterval(() => {
        elapsedEl.textContent = `已等待 ${Math.floor((Date.now() - startedAt) / 1000)}s`;
      }, 1000);
      const stopThinking = () => {
        clearInterval(thinkingTimer);
        thinking.remove();
        setQuickPromptsEnabled(true);
      };

      fetch(`/api/courses/${courseId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          context: {
            lesson: document.querySelector('.current-lesson')?.textContent || '',
            ...(ctx ? {
              section: ctx.section,
              selectedText: ctx.selectedText,
              surrounding: ctx.surrounding,
            } : {}),
          },
        }),
      })
        .then(async (response) => {
          const data = await response.json().catch(() => ({}));
          if (!response.ok) {
            const error = new Error(data.error || '导师暂时无法回答');
            error.code = data.code;
            throw error;
          }
          return data;
        })
        .then((data) => {
          stopThinking();
          const reply = data.reply || data.error || '出错了，请再试一次';
          renderAssistant(reply);
          renderSuggestions(
            Array.isArray(data.suggestions) && data.suggestions.length ? data.suggestions : DEFAULT_SUGGESTIONS);
          // 划词提问 -> 课节里默认高亮 + 贴出笔记卡（Q+A 可回溯）
          if (ctx && data.reply) {
            lessonFrame.contentWindow.postMessage(
              { type: 'create-note', anchor: ctx.anchor, section: ctx.section, question: text, answer: reply }, '*');
          }
        })
        .catch((error) => {
          stopThinking();
          renderTutorError(error.message, text, ctx);
          renderSuggestions(DEFAULT_SUGGESTIONS);
        });
    };

    // 历史记录恢复：刷新/新开窗口后还原对话和最后一组建议
    fetch(`/api/courses/${courseId}/chat`)
      .then((r) => r.json())
      .then((data) => {
        let lastSuggestions = null;
        (data.messages || []).forEach((m) => {
          if (m.role === 'user') {
            const el = document.createElement('div');
            el.className = 'message user';
            el.innerHTML = `<p>${escapeHtml(m.text)}</p>`;
            chatThread.appendChild(el);
          } else if (m.role === 'assistant') {
            renderAssistant(m.text);
            if (Array.isArray(m.suggestions) && m.suggestions.length) lastSuggestions = m.suggestions;
          }
        });
        renderSuggestions(lastSuggestions || DEFAULT_SUGGESTIONS);
        chatThread.scrollTop = chatThread.scrollHeight;
      })
      .catch(() => renderSuggestions(DEFAULT_SUGGESTIONS));

    // 新对话：清空记录并让后端下轮开新 kimi 会话
    const newChatBtn = document.createElement('button');
    newChatBtn.type = 'button';
    newChatBtn.className = 'ks-new-chat-button';
    newChatBtn.textContent = '新对话';
    newChatBtn.title = '清空记录，开始新对话';
    newChatBtn.addEventListener('click', () => {
      if (!confirm('清空当前对话记录并重新开始？')) return;
      fetch(`/api/courses/${courseId}/chat/reset`, { method: 'POST' }).then(() => {
        chatThread.querySelectorAll('.message').forEach((el, i) => { if (i > 0) el.remove(); });
        renderSuggestions(DEFAULT_SUGGESTIONS);
      });
    });
    document.querySelector('#assistantPanel .panel-header-actions')?.prepend(newChatBtn);

    lessonFrame.addEventListener('load', () => {
      window.setTimeout(() => courseStage?.classList.remove('is-loading-lesson'), 520);
    });

    pollCourseGeneration();
  }
})();
