(() => {
  'use strict';
  if (window.__lucubroCourseNoteLinkMounted) return;
  window.__lucubroCourseNoteLinkMounted = true;

  const match = location.pathname.match(/^\/course\/([^/]+)$/);
  const lessonFrame = document.getElementById('lessonFrame');
  if (!match || !lessonFrame) return;
  const courseId = match[1];

  function currentLanguage() {
    return window.LucubroI18n?.locale || localStorage.getItem('lucubro-locale') || 'en';
  }

  function openPanel(noteId = '') {
    lessonFrame.contentWindow?.postMessage(
      noteId
        ? { type: 'focus-note', noteId }
        : { type: 'toggle-notes-panel', collapsed: false },
      '*',
    );
  }

  async function openDeepLink() {
    const params = new URLSearchParams(location.search);
    const noteId = params.get('note');
    if (!noteId && params.get('panel') !== 'notes') return;

    if (!noteId) {
      if (lessonFrame.contentDocument?.readyState === 'complete') openPanel();
      else lessonFrame.addEventListener('load', () => window.setTimeout(() => openPanel(), 80), { once: true });
      return;
    }

    try {
      const [noteResponse, lessonResponse] = await Promise.all([
        fetch(`/api/courses/${courseId}/notes`),
        fetch(`/api/courses/${courseId}/lessons`),
      ]);
      const notes = noteResponse.ok ? await noteResponse.json() : [];
      const lessonFiles = lessonResponse.ok ? await lessonResponse.json() : [];
      const note = Array.isArray(notes) ? notes.find((item) => String(item.id) === noteId) : null;
      const lessonIndex = note && Array.isArray(lessonFiles) ? lessonFiles.indexOf(note.lessonFile) : -1;
      const focus = () => window.setTimeout(() => openPanel(noteId), 100);
      if (lessonIndex >= 0) {
        const item = [...document.querySelectorAll('.lesson-item')][lessonIndex];
        lessonFrame.addEventListener('load', focus, { once: true });
        item?.click();
      } else if (lessonFrame.contentDocument?.readyState === 'complete') {
        focus();
      } else {
        lessonFrame.addEventListener('load', focus, { once: true });
      }
    } catch {
      const message = currentLanguage() === 'zh-CN'
        ? '这条笔记暂时无法打开，课程内容没有受到影响。'
        : currentLanguage() === 'ja'
          ? 'このノートは現在開けません。レッスン内容には影響ありません。'
          : 'This note could not be opened. Your lesson is unaffected.';
      window.showToast?.(message);
    }
  }

  window.LucubroCourseNotes = Object.freeze({
    open: openPanel,
    openAll: () => { location.href = `/notes?course=${encodeURIComponent(courseId)}`; },
  });

  void openDeepLink();
})();
