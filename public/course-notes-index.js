(() => {
  'use strict';
  if (window.__kimiCourseNotesIndexMounted) return;
  window.__kimiCourseNotesIndexMounted = true;

  const match = location.pathname.match(/^\/course\/([^/]+)$/);
  if (!match) return;
  const courseId = match[1];
  const tabs = document.querySelector('.left-tabs');
  const content = document.querySelector('.left-content');
  const lessonFrame = document.getElementById('lessonFrame');
  if (!tabs || !content || !lessonFrame) return;

  const tab = document.createElement('button');
  tab.type = 'button';
  tab.className = 'left-tab';
  tab.dataset.leftTab = 'notes';
  tab.textContent = '笔记';
  tabs.appendChild(tab);

  const view = document.createElement('div');
  view.className = 'context-view';
  view.id = 'left-notes';
  view.innerHTML = `
    <div class="ks-notes-index-tools">
      <input class="ks-notes-search" type="search" placeholder="搜索全部课节笔记" aria-label="搜索全部课节笔记">
      <select class="ks-notes-lesson-filter" aria-label="按课节筛选笔记"><option value="">全部课节</option></select>
    </div>
    <div class="ks-notes-index-list" aria-live="polite"></div>`;
  content.appendChild(view);

  const search = view.querySelector('.ks-notes-search');
  const filter = view.querySelector('.ks-notes-lesson-filter');
  const list = view.querySelector('.ks-notes-index-list');
  let notes = [];
  let lessonFiles = [];
  let refreshTimer = 0;

  const kindLabel = (kind) => ({
    assistant: 'Tutor',
    vocabulary: '词卡',
    curiosity: 'Curiosity',
    scratch: '草稿',
    user: '我的笔记',
  }[kind] || '我的笔记');

  const lessonTitle = (file) => {
    if (!file) return '未归档';
    const index = lessonFiles.indexOf(file);
    const title = file.replace(/^\d+-?/, '').replace(/\.html$/i, '');
    return index >= 0 ? `Lesson ${index + 1} · ${title}` : title;
  };

  function showNotesTab() {
    document.querySelectorAll('.left-tab').forEach((item) => item.classList.toggle('active', item === tab));
    document.querySelectorAll('.context-view').forEach((item) => item.classList.toggle('active', item === view));
    void refresh();
  }

  function noteCopy(note) {
    return String(note.custom || note.answer || note.question || note.anchor?.exact || note.anchor?.textQuote?.exact || '').trim();
  }

  function render() {
    const query = search.value.trim().toLowerCase();
    const selectedLesson = filter.value;
    const visible = notes.filter((note) => {
      if (selectedLesson && note.lessonFile !== selectedLesson) return false;
      if (!query) return true;
      const haystack = `${lessonTitle(note.lessonFile)} ${note.section || ''} ${noteCopy(note)}`.toLowerCase();
      return haystack.includes(query);
    });
    list.replaceChildren();
    if (!visible.length) {
      const empty = document.createElement('div');
      empty.className = 'ks-notes-empty';
      empty.textContent = notes.length ? '没有符合当前搜索的笔记。' : '还没有笔记。划选课文后即可记笔记，Tutor 回答也可以保存到这里。';
      list.appendChild(empty);
      return;
    }
    const groups = new Map();
    for (const note of visible) {
      const key = note.lessonFile || '';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(note);
    }
    for (const [lessonFile, items] of groups) {
      const group = document.createElement('section');
      group.className = 'ks-note-group';
      const heading = document.createElement('div');
      heading.className = 'ks-note-group-title';
      const title = document.createElement('span');
      title.textContent = lessonTitle(lessonFile);
      const count = document.createElement('span');
      count.textContent = `${items.length} 条`;
      heading.append(title, count);
      group.appendChild(heading);
      items.sort((a, b) => Number(b.updatedAt || b.createdAt || 0) - Number(a.updatedAt || a.createdAt || 0));
      for (const note of items) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'ks-note-index-card';
        const meta = document.createElement('div');
        meta.className = 'ks-note-index-meta';
        meta.textContent = `${kindLabel(note.kind)}${note.section ? ` · ${note.section}` : ''}`;
        const copy = document.createElement('div');
        copy.className = 'ks-note-index-copy';
        copy.textContent = noteCopy(note) || '空笔记';
        button.append(meta, copy);
        button.addEventListener('click', () => openNote(note));
        group.appendChild(button);
      }
      list.appendChild(group);
    }
  }

  async function refresh() {
    window.clearTimeout(refreshTimer);
    try {
      const [noteResponse, lessonResponse] = await Promise.all([
        fetch(`/api/courses/${courseId}/notes`),
        fetch(`/api/courses/${courseId}/lessons`),
      ]);
      notes = noteResponse.ok ? await noteResponse.json() : [];
      lessonFiles = lessonResponse.ok ? await lessonResponse.json() : [];
      if (!Array.isArray(notes)) notes = [];
      if (!Array.isArray(lessonFiles)) lessonFiles = [];
      const previous = filter.value;
      filter.replaceChildren(new Option('全部课节', ''));
      lessonFiles.forEach((file) => filter.appendChild(new Option(lessonTitle(file), file)));
      filter.value = lessonFiles.includes(previous) ? previous : '';
      render();
    } catch {
      list.textContent = '';
      const empty = document.createElement('div');
      empty.className = 'ks-notes-empty';
      empty.textContent = '笔记暂时没有加载成功。课程和 Tutor 不受影响。';
      list.appendChild(empty);
    }
  }

  function openNote(note) {
    const index = lessonFiles.indexOf(note.lessonFile);
    const focus = () => lessonFrame.contentWindow?.postMessage({ type: 'focus-note', noteId: note.id }, '*');
    if (index >= 0) {
      const item = [...document.querySelectorAll('.lesson-item')][index];
      lessonFrame.addEventListener('load', () => window.setTimeout(focus, 120), { once: true });
      item?.click();
    } else {
      focus();
    }
    if (window.matchMedia('(max-width: 860px)').matches) document.getElementById('closeLeft')?.click();
  }

  tab.addEventListener('click', showNotesTab);
  search.addEventListener('input', render);
  filter.addEventListener('change', render);
  window.addEventListener('message', (event) => {
    if (event.source === lessonFrame.contentWindow && event.data?.type === 'notes-changed') {
      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(refresh, 120);
    }
  });
  void refresh();
})();
