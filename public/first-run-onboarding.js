// First-run onboarding: real upload, Mission persistence, generation recovery, and one-shot ready handoff.
(() => {
  'use strict';

  if (location.pathname !== '/new-course') return;

  const MAX_SOURCE_BYTES = 200 * 1024 * 1024;
  const SUPPORTED_EXTENSIONS = new Set(['pdf', 'epub', 'md', 'markdown', 'txt']);
  const TRANSITION_MS = 220;
  const MIN_READING_STAGE_MS = 1400;
  const POLL_MS = 1200;
  const MISSION_POLL_MS = 400;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const byId = (id) => document.getElementById(id);
  const stages = [...document.querySelectorAll('.stage')];
  const topSteps = [byId('topStep1'), byId('topStep2'), byId('topStep3')];
  const uploadZone = byId('uploadZone');
  const fileInput = byId('fileInput');
  const fileRow = byId('fileRow');
  const fileName = byId('fileName');
  const fileSize = byId('fileSize');
  const fileType = byId('fileType');
  const removeFile = byId('removeFile');
  const uploadContinue = byId('uploadContinue');
  const uploadTransfer = byId('uploadTransfer');
  const uploadProgressLabel = byId('uploadProgressLabel');
  const uploadProgressValue = byId('uploadProgressValue');
  const uploadProgressTrack = byId('uploadProgressTrack');
  const uploadProgressFill = byId('uploadProgressFill');
  const uploadError = byId('uploadError');
  const cancelUpload = byId('cancelUpload');
  const backToLibrary = byId('backToLibrary');
  const inspectionVisual = byId('inspectionVisual');
  const missionCardVisual = byId('missionCardVisual');
  const readingTitle = byId('readingTitle');
  const readingCopy = byId('readingCopy');
  const missionMeta = byId('missionMeta');
  const questionTitle = byId('questionTitle');
  const options = byId('options');
  const missionQuestion = byId('missionQuestion');
  const missionBack = byId('missionBack');
  const missionNext = byId('missionNext');
  const missionError = byId('missionError');
  const progressFill = byId('progressFill');
  const progressValue = byId('progressValue');
  const elapsedTime = byId('elapsedTime');
  const statusLine = byId('statusLine');
  const processList = byId('processList');
  const backgroundButton = byId('backgroundButton');
  const loadingError = byId('loadingError');
  const retryButton = byId('retryButton');
  const loadingHint = byId('loadingHint');
  const visualCaption = byId('visualCaption');
  const visualScenes = [...document.querySelectorAll('.visual-scene')];
  const readyOverlay = byId('readyOverlay');
  const readyCourseTitle = byId('readyCourseTitle');
  const readyCourseSubtitle = byId('readyCourseSubtitle');
  const startFirstLesson = byId('startFirstLesson');



  const phasePresentation = {
    extracting: ['orbit', '读取材料'],
    profiling: ['orbit', '梳理结构'],
    claims: ['cards', '建立目标'],
    blueprint: ['cards', '组织课程'],
    questions: ['nodes', '生成练习'],
    quality: ['nodes', '筛选质量'],
    assembling: ['scan', '组装第一课'],
    validating: ['scan', '检查课程'],
    complete: ['scan', '准备完成'],
  };

  let currentStage = 'upload';
  let selectedFile = null;
  let courseId = new URLSearchParams(location.search).get('course');
  let missionRecord = null;
  let missionPollTimer = null;
  let uploadRequest = null;
  let pollTimer = null;
  let pollInFlight = false;
  let pollRequested = false;
  let monitoring = false;
  let eventSource = null;
  let lastProgress = 0;
  let readyTimer = null;
  let generationStartedAt = 0;
  let elapsedTimer = null;

  function setTopStep(index) {
    topSteps.forEach((step, i) => {
      const state = i < index ? 'done' : i === index ? 'active' : 'pending';
      step.classList.toggle('active', state === 'active');
      step.classList.toggle('done', state === 'done');
      step.classList.toggle('pending', state === 'pending');
      if (state === 'active') step.setAttribute('aria-current', 'step');
      else step.removeAttribute('aria-current');
      const stateLabel = step.querySelector('.top-step-state');
      if (stateLabel) stateLabel.textContent = state === 'done' ? 'Completed step' : state === 'active' ? 'Current step' : 'Upcoming step';
    });
  }

  let pendingStageTransition = null;
  let readingStageShownAt = 0;

  function showStage(name, stepIndex, { immediate = false } = {}) {
    // A fast follow-up transition must cancel a pending one; otherwise the
    // queued activate() would fire afterwards and override the newer stage
    // (e.g. upload -> reading -> back-to-upload-on-error got stuck on reading).
    if (pendingStageTransition) {
      clearTimeout(pendingStageTransition);
      pendingStageTransition = null;
      for (const stage of stages) stage.classList.remove('is-leaving');
    }
    const previous = stages.find((stage) => stage.dataset.stage === currentStage);
    const next = stages.find((stage) => stage.dataset.stage === name);
    if (!next) return;
    if (previous === next) {
      if (typeof stepIndex === 'number') setTopStep(stepIndex);
      return;
    }
    const activate = () => {
      previous?.classList.remove('is-active', 'is-visible', 'is-leaving');
      next.classList.add('is-active');
      requestAnimationFrame(() => requestAnimationFrame(() => next.classList.add('is-visible')));
      currentStage = name;
      if (typeof stepIndex === 'number') setTopStep(stepIndex);
    };
    if (immediate || reducedMotion || !previous) return activate();
    previous.classList.add('is-leaving');
    pendingStageTransition = setTimeout(() => {
      pendingStageTransition = null;
      activate();
    }, TRANSITION_MS);
  }

  function humanFileSize(bytes) {
    const value = Number(bytes) || 0;
    if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`;
    return `${(value / 1024 / 1024).toFixed(1)} MB`;
  }

  function extensionOf(name) {
    return String(name || '').split('.').pop().toLowerCase();
  }

  function setUploadError(message) {
    uploadError.textContent = message || '';
    uploadError.hidden = !message;
  }

  function validateClientFile(file) {
    const extension = extensionOf(file?.name);
    if (!SUPPORTED_EXTENSIONS.has(extension)) return '仅支持 PDF、EPUB、Markdown 和 TXT 文件。';
    if (!file?.size) return '文件为空，请选择其他材料。';
    if (file.size > MAX_SOURCE_BYTES) return '文件超过 200 MB 限制。';
    return '';
  }

  function selectFile(file) {
    const error = validateClientFile(file);
    if (error) {
      clearFile();
      setUploadError(error);
      return;
    }
    selectedFile = file;
    setUploadError('');
    fileName.textContent = file.name;
    fileType.textContent = extensionOf(file.name).toUpperCase().slice(0, 5);
    fileSize.textContent = `${humanFileSize(file.size)} · 已准备好`;
    fileRow.classList.add('is-visible');
    uploadContinue.disabled = false;
  }

  function clearFile() {
    if (uploadRequest) return;
    selectedFile = null;
    fileInput.value = '';
    fileRow.classList.remove('is-visible');
    uploadContinue.disabled = true;
    uploadTransfer.hidden = true;
    uploadProgressFill.style.transform = 'scaleX(0)';
  }

  function updateUploadProgress(progress, label = '正在上传材料') {
    const value = Math.max(0, Math.min(100, Math.round(progress)));
    uploadTransfer.hidden = false;
    uploadProgressLabel.textContent = label;
    uploadProgressValue.textContent = `${value}%`;
    uploadProgressTrack.setAttribute('aria-valuenow', String(value));
    uploadProgressFill.style.transform = `scaleX(${value / 100})`;
  }

  function setReadingMode(mode, title, copy) {
    inspectionVisual.hidden = mode !== 'inspection';
    missionCardVisual.hidden = mode !== 'mission';
    readingTitle.textContent = title;
    readingCopy.textContent = copy;
  }

  function setUploadBusy(busy) {
    uploadContinue.disabled = busy || !selectedFile;
    removeFile.disabled = busy;
    fileInput.disabled = busy;
    uploadZone.classList.toggle('is-disabled', busy);
  }

  async function parseResponse(xhr) {
    try { return JSON.parse(xhr.responseText || '{}'); }
    catch { return {}; }
  }

  function uploadSelectedFile() {
    if (!selectedFile || uploadRequest) return;
    setUploadError('');
    setUploadBusy(true);
    updateUploadProgress(0);

    const form = new FormData();
    form.append('file', selectedFile);
    form.append('title', selectedFile.name.replace(/\.[^.]+$/, ''));
    form.append('mode', document.querySelector('input[name="courseMode"]:checked')?.value || 'student');
    form.append('locale', window.LucubroI18n?.locale || 'en');

    const xhr = new XMLHttpRequest();
    uploadRequest = xhr;
    xhr.open('POST', '/api/course-onboarding');
    xhr.responseType = 'text';
    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) updateUploadProgress((event.loaded / event.total) * 100);
    });
    xhr.upload.addEventListener('load', () => {
      updateUploadProgress(100, '上传完成，正在检查材料');
      setReadingMode('inspection', '正在检查你的材料', '正在确认文件格式、内容结构和可读取性。');
      readingStageShownAt = Date.now();
      showStage('reading', 0);
    });
    xhr.addEventListener('load', async () => {
      updateUploadProgress(100, '上传完成，正在检查材料');
      uploadRequest = null;
      const data = await parseResponse(xhr);
      if (xhr.status !== 202 || !data.id) {
        setUploadBusy(false);
        showStage('upload', 0);
        setUploadError(data.message || '材料上传或检查失败，请重试。');
        return;
      }
      // Keep the inspection stage on screen long enough to register; fast
      // validations would otherwise skip straight past it.
      const elapsed = Date.now() - readingStageShownAt;
      const wait = Math.max(0, MIN_READING_STAGE_MS - elapsed);
      setTimeout(() => {
        courseId = data.id;
        history.replaceState(null, '', `/new-course?course=${encodeURIComponent(courseId)}`);
        hydrateSource(data.onboarding?.source);
        showMissionPreparation();
        startMissionPolling();
      }, wait);
    });
    xhr.addEventListener('error', () => {
      uploadRequest = null;
      setUploadBusy(false);
      showStage('upload', 0);
      setUploadError('网络连接中断，材料没有完成上传。');
    });
    xhr.send(form);
  }

  function hydrateSource(source) {
    if (!source) return;
    const name = source.originalFilename || source.storedFilename || '学习材料';
    fileName.textContent = name;
    fileType.textContent = String(source.format || extensionOf(name) || 'FILE').toUpperCase().slice(0, 5);
    fileSize.textContent = `${humanFileSize(source.sizeBytes)} · 已上传`;
    fileRow.classList.add('is-visible');
  }

  function missionDraftKey(mission = missionRecord?.mission) {
    if (!courseId || !mission) return '';
    const turn = Number(mission.turns || 0);
    const question = String(mission.question || '').slice(0, 120);
    return `lucubro:mission-answer:${courseId}:${turn}:${question}`;
  }

  function readMissionDraft(mission) {
    const key = missionDraftKey(mission);
    if (!key) return { selectionId: '', detail: '' };
    try {
      const value = JSON.parse(sessionStorage.getItem(key) || '{}');
      return {
        selectionId: String(value.selectionId || ''),
        detail: String(value.detail || '').slice(0, 2000),
      };
    } catch {
      return { selectionId: '', detail: '' };
    }
  }

  function writeMissionDraft(mission, value) {
    const key = missionDraftKey(mission);
    if (!key) return;
    try { sessionStorage.setItem(key, JSON.stringify(value)); } catch {}
  }

  function clearMissionDraft(mission) {
    const key = missionDraftKey(mission);
    if (!key) return;
    try { sessionStorage.removeItem(key); } catch {}
  }

  function showMissionPreparation() {
    missionMeta.textContent = `${fileName.textContent || '学习材料'} · 学习目标`;
    questionTitle.textContent = '正在准备问题';
    options.replaceChildren();
    const copy = document.createElement('p');
    copy.className = 'mission-preparing-copy';
    copy.textContent = '文件检查完成。Lucubro 正在根据目录和章节摘要整理可选的学习目标。';
    options.appendChild(copy);
    for (let index = 0; index < 3; index += 1) {
      const skeleton = document.createElement('div');
      skeleton.className = 'mission-option-skeleton';
      skeleton.setAttribute('aria-hidden', 'true');
      options.appendChild(skeleton);
    }
    missionNext.textContent = '继续';
    missionNext.disabled = true;
    missionBack.disabled = false;
    showStage('mission', 1);
  }

  function renderMission(record) {
    missionRecord = record;
    const mission = record && record.mission || {};
    missionError.hidden = true;
    missionError.textContent = '';
    missionMeta.textContent = `${fileName.textContent || '学习材料'} · 学习目标`;
    missionBack.textContent = '返回课程库';
    missionBack.disabled = false;
    options.replaceChildren();
    if (mission.status === 'ready') {
      questionTitle.textContent = '确认学习目标';
      const summary = document.createElement('div');
      summary.className = 'mission-summary';
      summary.textContent = mission.summary || '学习目标已经整理完成。';
      options.appendChild(summary);
      missionNext.textContent = '确认并创建课程';
      missionNext.disabled = false;
    } else if (mission.status === 'failed') {
      questionTitle.textContent = '学习目标没有整理完成';
      missionError.textContent = mission.errorMessage || '材料和已经填写的内容都已保留，可以重试。';
      missionError.hidden = false;
      const recovery = document.createElement('p');
      recovery.className = 'mission-recovery-copy';
      recovery.textContent = '重试会从当前访谈继续，不需要重新上传材料，也不会提前开始生成课程。';
      options.appendChild(recovery);
      missionNext.textContent = '继续整理';
      missionNext.disabled = false;
    } else {
      questionTitle.textContent = mission.question || '正在准备下一个问题';
      const choices = Array.isArray(mission.options) ? mission.options : [];
      const draft = readMissionDraft(mission);
      let selectedId = choices.some((choice) => choice?.id === draft.selectionId) ? draft.selectionId : '';

      if (choices.length) {
        const choiceLabel = document.createElement('div');
        choiceLabel.className = 'mission-choice-label';
        choiceLabel.textContent = '选择最接近的一项';
        options.appendChild(choiceLabel);

        const choiceList = document.createElement('div');
        choiceList.className = 'mission-choice-list';
        choiceList.setAttribute('role', 'radiogroup');
        choiceList.setAttribute('aria-label', mission.question || '学习目标选项');
        for (const choice of choices) {
          if (!choice || !choice.id || !choice.label) continue;
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'option';
          button.dataset.optionId = choice.id;
          button.setAttribute('role', 'radio');
          button.setAttribute('aria-checked', String(choice.id === selectedId));
          button.classList.toggle('is-selected', choice.id === selectedId);
          const marker = document.createElement('span');
          marker.className = 'option-marker';
          marker.setAttribute('aria-hidden', 'true');
          const content = document.createElement('span');
          const title = document.createElement('span');
          title.className = 'option-title';
          title.textContent = choice.label;
          content.appendChild(title);
          if (choice.description) {
            const description = document.createElement('span');
            description.className = 'option-description';
            description.textContent = choice.description;
            content.appendChild(description);
          }
          button.append(marker, content);
          button.addEventListener('click', () => {
            selectedId = choice.id;
            choiceList.querySelectorAll('.option').forEach((item) => {
              const selected = item.dataset.optionId === selectedId;
              item.classList.toggle('is-selected', selected);
              item.setAttribute('aria-checked', String(selected));
            });
            const detail = options.querySelector('.mission-answer')?.value || '';
            writeMissionDraft(mission, { selectionId: selectedId, detail });
            missionNext.disabled = false;
          });
          choiceList.appendChild(button);
        }
        options.appendChild(choiceList);
      }

      const answerWrap = document.createElement('label');
      answerWrap.className = 'mission-answer-wrap';
      const answerLabel = document.createElement('span');
      answerLabel.className = 'mission-answer-label';
      answerLabel.textContent = choices.length ? '补充说明（可选）' : '你的回答';
      const textarea = document.createElement('textarea');
      textarea.className = 'mission-answer';
      textarea.rows = 3;
      textarea.maxLength = choices.length ? 2000 : 4000;
      textarea.placeholder = choices.length
        ? '可以补充你的具体场景、目标或限制；不填也可以继续。'
        : '写下你的具体目标或使用场景。';
      textarea.value = draft.detail;
      textarea.addEventListener('input', () => {
        writeMissionDraft(mission, { selectionId: selectedId, detail: textarea.value });
        missionNext.disabled = choices.length ? !selectedId : !textarea.value.trim();
      });
      answerWrap.append(answerLabel, textarea);
      options.appendChild(answerWrap);

      if (mission.materialSummary) {
        const details = document.createElement('details');
        details.className = 'mission-material-details';
        const detailsSummary = document.createElement('summary');
        detailsSummary.textContent = '查看材料摘要';
        const summary = document.createElement('p');
        summary.className = 'mission-material-summary';
        summary.textContent = mission.materialSummary;
        details.append(detailsSummary, summary);
        options.appendChild(details);
      }

      missionNext.textContent = '继续';
      missionNext.disabled = choices.length ? !selectedId : !textarea.value.trim();
      setTimeout(() => {
        const selected = options.querySelector('.option.is-selected');
        const first = options.querySelector('.option');
        (selected || first || textarea).focus();
      }, 0);
    }
    showStage('mission', 1);
  }

  function stopMissionPolling() {
    clearTimeout(missionPollTimer);
    missionPollTimer = null;
  }

  async function pollMission() {
    if (!courseId) return;
    try {
      const snapshot = await requestJson(`/api/courses/${encodeURIComponent(courseId)}/onboarding`);
      const record = snapshot.onboarding;
      hydrateSource(record?.source);
      if (record?.state === 'planning_mission' || record?.mission?.status === 'planning') {
        showMissionPreparation();
        missionPollTimer = setTimeout(pollMission, MISSION_POLL_MS);
        return;
      }
      stopMissionPolling();
      renderMission(record);
    } catch {
      missionPollTimer = setTimeout(pollMission, MISSION_POLL_MS);
    }
  }

  function startMissionPolling() {
    stopMissionPolling();
    pollMission();
  }

  async function requestJson(url, options = {}) {
    const response = await fetch(url, {
      ...options,
      headers: options.body ? { 'Content-Type': 'application/json', ...(options.headers || {}) } : options.headers,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data.message || '请求没有完成');
      error.status = response.status;
      error.code = data.error;
      error.data = data;
      throw error;
    }
    return data;
  }

  async function requestOperation(courseId) {
    try {
      return await requestJson(`/api/courses/${encodeURIComponent(courseId)}/operation`);
    } catch (error) {
      if (error.status !== 404) throw error;
      return requestJson(`/api/courses/${encodeURIComponent(courseId)}/status`);
    }
  }

  async function submitMissionAndStart() {
    if (!courseId) return;
    missionNext.disabled = true;
    missionBack.disabled = true;
    try {
      const mission = missionRecord?.mission || {};
      if (mission.status === 'failed') {
        showMissionPreparation();
        await requestJson(`/api/courses/${encodeURIComponent(courseId)}/mission/retry`, { method: 'POST', body: '{}' });
        startMissionPolling();
        return;
      }
      if (mission.status !== 'ready') {
        const selected = options.querySelector('.option.is-selected');
        const detail = options.querySelector('.mission-answer')?.value.trim() || '';
        const hasChoices = Array.isArray(mission.options) && mission.options.length > 0;
        if (hasChoices && !selected) throw new Error('请先选择一个最接近的答案');
        if (!hasChoices && !detail) throw new Error('请先回答这个问题');
        const payload = hasChoices
          ? { selectionId: selected.dataset.optionId, detail }
          : { answer: detail };
        showMissionPreparation();
        await requestJson(`/api/courses/${encodeURIComponent(courseId)}/mission/answer`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        clearMissionDraft(mission);
        startMissionPolling();
        return;
      }
      await requestJson(`/api/courses/${encodeURIComponent(courseId)}/mission/confirm`, { method: 'POST', body: '{}' });
      showLoading();
      await requestJson(`/api/courses/${encodeURIComponent(courseId)}/start`, { method: 'POST', body: '{}' });
      startMonitoring();
    } catch (error) {
      missionNext.disabled = false;
      missionBack.disabled = false;
      if (missionRecord?.mission?.status === 'question') renderMission(missionRecord);
      missionError.textContent = error.message || '学习目标没有保存。材料和已经填写的内容都已保留，可以重试。';
      missionError.hidden = false;
      showStage('mission', 1);
    }
  }

  function buildProcessList(history = []) {
    processList.replaceChildren();
    history.forEach((step) => {
      const row = document.createElement('div');
      row.className = 'process-row';
      row.classList.toggle('is-done', step.state === 'complete');
      row.classList.toggle('is-active', step.state === 'active');
      row.classList.toggle('is-error', step.state === 'error');
      const dot = document.createElement('span');
      dot.className = 'step-dot';
      dot.textContent = step.state === 'complete' ? '✓' : '';
      const label = document.createElement('span');
      label.textContent = step.label;
      row.append(dot, label);
      processList.appendChild(row);
    });
  }

  function setGenerationVisual(phase) {
    const [name, caption] = phasePresentation[phase] || phasePresentation.extracting;
    visualScenes.forEach((scene) => scene.classList.toggle('is-active', scene.dataset.visual === name));
    visualCaption.textContent = caption;
  }

  function showLoading() {
    loadingError.hidden = true;
    retryButton.hidden = true;
    backgroundButton.hidden = false;
    loadingHint.hidden = false;
    setGenerationVisual('extracting');
    if (!generationStartedAt) generationStartedAt = Date.now();
    startElapsedClock();
    showStage('loading', 2);
  }

  function formatElapsed(startedAt) {
    const seconds = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
    return `已用 ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  }

  function startElapsedClock() {
    clearInterval(elapsedTimer);
    if (!generationStartedAt) generationStartedAt = Date.now();
    const render = () => { elapsedTime.textContent = formatElapsed(generationStartedAt); };
    render();
    elapsedTimer = setInterval(render, 1000);
  }

  function applyGenerationStatus(status) {
    const reportedStart = Date.parse(status.startedAt || '');
    if (Number.isFinite(reportedStart)) generationStartedAt = reportedStart;
    const value = Math.max(lastProgress, Math.max(0, Math.min(100, Number(status.progress) || 0)));
    lastProgress = value;
    progressFill.style.transform = `scaleX(${value / 100})`;
    progressValue.textContent = `${Math.floor(value)}%`;
    statusLine.textContent = status.currentMessage || '正在创建课程';
    setGenerationVisual(status.phase || 'extracting');
    buildProcessList(Array.isArray(status.history) ? status.history : []);
  }

  function clearPollTimer() {
    clearTimeout(pollTimer);
    pollTimer = null;
  }

  function stopMonitoring() {
    monitoring = false;
    pollRequested = false;
    clearPollTimer();
    eventSource?.close();
    eventSource = null;
    clearInterval(elapsedTimer);
    elapsedTimer = null;
  }

  function schedulePoll(delay = POLL_MS) {
    if (!monitoring || !courseId) return;
    if (pollInFlight) {
      pollRequested = true;
      return;
    }
    clearPollTimer();
    pollTimer = setTimeout(() => {
      pollTimer = null;
      pollGeneration();
    }, Math.max(0, delay));
  }

  function showFailure(message, { retryable = true, returnToMission = false } = {}) {
    stopMonitoring();
    showStage('loading', 2);
    statusLine.textContent = returnToMission ? '学习设置没有保存' : '课程创建没有完成';
    loadingError.textContent = `${message || '课程创建没有完成，请重试。'} 材料和已确认的学习设置仍然保留。`;
    loadingError.hidden = false;
    retryButton.hidden = !retryable;
    retryButton.disabled = false;
    backgroundButton.hidden = false;
    loadingHint.hidden = true;
  }

  async function pollGeneration() {
    if (!monitoring || !courseId) return;
    if (pollInFlight) {
      pollRequested = true;
      return;
    }
    pollInFlight = true;
    pollRequested = false;
    let terminal = false;
    try {
      const [snapshot, status] = await Promise.all([
        requestJson(`/api/courses/${encodeURIComponent(courseId)}/onboarding`),
        requestOperation(courseId),
      ]);
      if (!monitoring) return;
      const state = snapshot.onboarding?.state;
      if (state === 'ready' && status.stage === 'ready' && Number(status.lessons) > 0) {
        terminal = true;
        stopMonitoring();
        await showReady(status.lessons);
        return;
      }
      if (state === 'failed' || state === 'interrupted' || status.stage === 'failed') {
        terminal = true;
        showFailure(snapshot.onboarding?.generation?.errorMessage || status.error || '课程创建没有完成，请重试。');
        return;
      }
      applyGenerationStatus(status);
    } catch (error) {
      if (monitoring) statusLine.textContent = '连接暂时中断，正在恢复…';
    } finally {
      pollInFlight = false;
      if (!monitoring || terminal) return;
      const delay = pollRequested ? 0 : POLL_MS;
      pollRequested = false;
      schedulePoll(delay);
    }
  }

  function startMonitoring() {
    if (!courseId) return;
    stopMonitoring();
    monitoring = true;
    showLoading();
    schedulePoll(0);
    try {
      eventSource = new EventSource(`/api/courses/${encodeURIComponent(courseId)}/generation-events`);
      eventSource.addEventListener('generation-event', (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.message && lastProgress < 100) statusLine.textContent = data.message;
          if (data.phase) setGenerationVisual(data.phase);
        } catch {}
        schedulePoll(80);
      });
    } catch {}
  }

  async function retryGeneration() {
    retryButton.disabled = true;
    loadingError.hidden = true;
    try {
      await requestJson(`/api/courses/${encodeURIComponent(courseId)}/retry`, { method: 'POST', body: '{}' });
      lastProgress = 0;
      generationStartedAt = Date.now();
      startMonitoring();
    } catch (error) {
      showFailure(error.message);
      retryButton.disabled = false;
    }
  }

  async function showReady(lessonCount) {
    const readyKey = `lucubro-first-run-ready:${courseId}`;
    if (sessionStorage.getItem(readyKey) === 'shown') {
      location.replace(`/course/${encodeURIComponent(courseId)}`);
      return;
    }
    sessionStorage.setItem(readyKey, 'shown');
    let title = '我的课程';
    try {
      const info = await requestJson(`/api/courses/${encodeURIComponent(courseId)}/info`);
      title = info.title || title;
    } catch {}
    readyCourseTitle.textContent = title;
    readyCourseSubtitle.textContent = `${Number(lessonCount) || 1} 节课 · 学习区域已建立`;
    readyOverlay.classList.remove('is-hidden');
    showStage('ready', 2);
    const delay = reducedMotion ? 80 : 1350;
    readyTimer = setTimeout(() => {
      readyOverlay.classList.add('is-hidden');
      setTimeout(() => location.replace(`/course/${encodeURIComponent(courseId)}`), reducedMotion ? 1 : 260);
    }, delay);
  }

  async function resumeExistingCourse() {
    try {
      const snapshot = await requestJson(`/api/courses/${encodeURIComponent(courseId)}/onboarding`);
      const record = snapshot.onboarding;
      hydrateSource(record?.source);
      if (!record) throw new Error('没有找到建课状态');
      if (record.state === 'ready') {
        await showReady(snapshot.generation?.lessons || 1);
        return;
      }
      if (record.state === 'starting' || record.state === 'generating') {
        startMonitoring();
        return;
      }
      if (record.state === 'failed' || record.state === 'interrupted') {
        const attempts = Number(record.generation?.attempts || 0);
        if (attempts > 0) showFailure(record.generation?.errorMessage || '课程创建没有完成，请重试。');
        else {
          showStage('upload', 0, { immediate: true });
          setUploadError(record.inspection?.errorMessage || '材料检查没有完成，请重新上传。');
        }
        return;
      }
      if (record.state === 'planning_mission' || record.mission?.status === 'planning') {
        showMissionPreparation();
        startMissionPolling();
        return;
      }
      if (record.state === 'mission_ready' || record.state === 'awaiting_mission') {
        if (record.mission?.status === 'confirmed') {
          showLoading();
          await requestJson(`/api/courses/${encodeURIComponent(courseId)}/start`, { method: 'POST', body: '{}' });
          startMonitoring();
          return;
        }
        renderMission(record);
        return;
      }
      showStage('upload', 0, { immediate: true });
    } catch (error) {
      showStage('upload', 0, { immediate: true });
      setUploadError(error.message || '无法恢复建课状态。');
    }
  }

  ['dragenter', 'dragover'].forEach((type) => uploadZone.addEventListener(type, (event) => {
    event.preventDefault();
    uploadZone.classList.add('is-dragging');
  }));
  ['dragleave', 'drop'].forEach((type) => uploadZone.addEventListener(type, (event) => {
    event.preventDefault();
    uploadZone.classList.remove('is-dragging');
  }));
  uploadZone.addEventListener('drop', (event) => {
    const [file] = event.dataTransfer.files;
    if (file) selectFile(file);
  });
  fileInput.addEventListener('change', () => {
    const [file] = fileInput.files;
    if (file) selectFile(file);
  });
  removeFile.addEventListener('click', clearFile);
  uploadContinue.addEventListener('click', uploadSelectedFile);
  cancelUpload.addEventListener('click', () => { location.href = '/app'; });
  backToLibrary.addEventListener('click', () => { location.href = '/app'; });
  backgroundButton.addEventListener('click', () => { location.href = '/app'; });
  retryButton.addEventListener('click', retryGeneration);
  startFirstLesson.addEventListener('click', () => {
    clearTimeout(readyTimer);
    location.replace(`/course/${encodeURIComponent(courseId)}`);
  });
  missionBack.addEventListener('click', () => { location.href = '/app'; });
  missionNext.addEventListener('click', submitMissionAndStart);
  window.addEventListener('pagehide', stopMonitoring);

  if (courseId) resumeExistingCourse();
  else showStage('upload', 0, { immediate: true });
})();
