// First-run onboarding: real upload, Mission persistence, generation recovery, and one-shot ready handoff.
(() => {
  'use strict';

  if (location.pathname !== '/new-course') return;

  const MAX_SOURCE_BYTES = 200 * 1024 * 1024;
  const SUPPORTED_EXTENSIONS = new Set(['pdf', 'epub', 'md', 'markdown', 'txt']);
  const TRANSITION_MS = 220;
  const POLL_MS = 1200;
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

  function setTopStep(index) {
    topSteps.forEach((step, i) => {
      step.classList.toggle('active', i === index);
      step.classList.toggle('done', i < index);
    });
  }

  function showStage(name, stepIndex, { immediate = false } = {}) {
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
    setTimeout(activate, TRANSITION_MS);
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
      courseId = data.id;
      history.replaceState(null, '', `/new-course?course=${encodeURIComponent(courseId)}`);
      hydrateSource(data.onboarding?.source);
      showMissionPreparation();
      startMissionPolling();
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

  function showMissionPreparation() {
    setReadingMode('mission', 'Teach 正在快速通读材料', '默认一般模式会先理解材料结构，再开始 Mission 访谈。');
    // Commit the reading-stage state immediately so a fast Mission response cannot
    // be overwritten by the previous delayed transition.
    showStage('reading', 1, { immediate: true });
  }

  function renderMission(record) {
    missionRecord = record;
    const mission = record && record.mission || {};
    missionError.hidden = true;
    missionError.textContent = '';
    missionMeta.textContent = `${fileName.textContent || '学习材料'} · 一般模式 · Teach Mission`;
    missionBack.textContent = '返回课程库';
    options.replaceChildren();
    if (mission.materialSummary) {
      const summary = document.createElement('p');
      summary.className = 'mission-material-summary';
      summary.textContent = `Teach 对材料的快速理解：${mission.materialSummary}`;
      options.appendChild(summary);
    }
    if (mission.status === 'ready') {
      questionTitle.textContent = '确认这份 Mission';
      const summary = document.createElement('div');
      summary.className = 'mission-summary';
      summary.textContent = mission.summary || 'Teach 已经写好 MISSION.md。';
      options.appendChild(summary);
      missionNext.textContent = '确认并创建课程';
      missionNext.disabled = false;
    } else if (mission.status === 'failed') {
      questionTitle.textContent = 'Mission 访谈没有完成';
      missionError.textContent = mission.errorMessage || 'Teach 暂时没有完成材料理解，请重试。';
      missionError.hidden = false;
      missionNext.textContent = '重试';
      missionNext.disabled = false;
    } else {
      questionTitle.textContent = mission.question || 'Teach 正在准备下一个问题';
      const textarea = document.createElement('textarea');
      textarea.className = 'mission-answer';
      textarea.rows = 5;
      textarea.maxLength = 4000;
      textarea.placeholder = '用你自己的话回答。Teach 会根据回答决定是否继续追问。';
      textarea.addEventListener('input', () => { missionNext.disabled = !textarea.value.trim(); });
      options.appendChild(textarea);
      missionNext.textContent = '回答 Teach';
      missionNext.disabled = true;
      setTimeout(() => textarea.focus(), 0);
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
        missionPollTimer = setTimeout(pollMission, POLL_MS);
        return;
      }
      stopMissionPolling();
      renderMission(record);
    } catch {
      missionPollTimer = setTimeout(pollMission, POLL_MS);
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
        const answer = options.querySelector('textarea')?.value.trim();
        showMissionPreparation();
        await requestJson(`/api/courses/${encodeURIComponent(courseId)}/mission/answer`, {
          method: 'POST',
          body: JSON.stringify({ answer }),
        });
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
      missionError.textContent = error.message || 'Teach Mission 没有完成，请重试。';
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
    showStage('loading', 2);
  }

  function applyGenerationStatus(status) {
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
    loadingError.textContent = message || '课程创建没有完成，请重试。';
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
        requestJson(`/api/courses/${encodeURIComponent(courseId)}/status`),
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
      startMonitoring();
    } catch (error) {
      showFailure(error.message);
      retryButton.disabled = false;
    }
  }

  async function showReady(lessonCount) {
    const readyKey = `kimi-study-first-run-ready:${courseId}`;
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
