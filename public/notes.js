(() => {
  'use strict';

  const list = document.getElementById('notesList');
  const empty = document.getElementById('notesEmpty');
  const template = document.getElementById('noteCardTemplate');
  const search = document.getElementById('notesSearch');
  const courseFilter = document.getElementById('courseFilter');
  const kindButtons = [...document.querySelectorAll('[data-kind]')];
  const total = document.getElementById('notesTotal');
  const visibleCount = document.getElementById('visibleNotesCount');
  const filterLabel = document.getElementById('activeFilterLabel');
  const clearFilters = document.getElementById('clearFilters');
  const activityGrid = document.getElementById('activityGrid');
  const activityMonths = document.getElementById('activityMonths');
  const activityWeekdays = document.querySelector('.activity-weekdays');
  const activitySummary = document.getElementById('activitySummary');
  const activityDetail = document.getElementById('activityDetail');

  let notes = [];
  let activity = [];
  let selectedKind = '';
  let selectedDay = '';

  const i18n = () => window.LucubroI18n;
  const text = (en, zh, ja) => ({ en, 'zh-CN': zh, ja })[i18n()?.locale || 'en'];
  const copyOf = (note) => String(note.custom || note.question || note.answer || '').trim();
  const quoteOf = (note) => String(note.anchor?.exact || note.anchor?.textQuote?.exact || '').trim();
  const stampOf = (note) => Number(note.timestamp || note.updatedAt || note.createdAt || 0);
  const dayKey = (timestamp) => {
    const value = new Date(timestamp);
    return Number.isNaN(value.getTime()) ? '' : `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  };
  const kindName = (kind) => ({
    assistant: text('Lucubro answer', 'Lucubro 回答', 'Lucubro の回答'),
    scratch: text('Scratch note', '草稿', '下書き'),
    vocabulary: text('Vocabulary', '词卡', '単語'),
    curiosity: text('Curiosity', '好奇卡', '好奇心カード'),
    user: text('My note', '我的笔记', '自分のノート'),
  }[kind] || text('My note', '我的笔记', '自分のノート'));
  const dateLabel = (timestamp, options = { year: 'numeric', month: 'short', day: 'numeric' }) =>
    new Intl.DateTimeFormat(i18n()?.locale || 'en', options).format(new Date(timestamp));

  function setActivityTabStop(target, { focus = false } = {}) {
    const cells = [...activityGrid.querySelectorAll('.activity-day')];
    if (!cells.length) return;
    const next = target && cells.includes(target) ? target : cells[cells.length - 1];
    cells.forEach((cell) => { cell.tabIndex = cell === next ? 0 : -1; });
    if (focus) {
      next.focus({ preventScroll: true });
      next.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }

  function handleActivityGridKeydown(event) {
    const current = event.target.closest?.('.activity-day');
    if (!current || !activityGrid.contains(current)) return;
    const cells = [...activityGrid.querySelectorAll('.activity-day')];
    const index = cells.indexOf(current);
    if (index < 0) return;
    const last = cells.length - 1;
    let nextIndex = index;
    if (event.key === 'ArrowUp') nextIndex = index - 1;
    else if (event.key === 'ArrowDown') nextIndex = index + 1;
    else if (event.key === 'ArrowLeft') nextIndex = index - 7;
    else if (event.key === 'ArrowRight') nextIndex = index + 7;
    else if (event.key === 'Home') nextIndex = event.ctrlKey ? 0 : index - (index % 7);
    else if (event.key === 'End') nextIndex = event.ctrlKey ? last : Math.min(last, index + (6 - (index % 7)));
    else return;
    event.preventDefault();
    setActivityTabStop(cells[Math.max(0, Math.min(last, nextIndex))], { focus: true });
  }

  function updateCourseOptions() {
    const previous = courseFilter.value;
    const courses = [...new Map(notes.map((note) => [note.courseId, note.courseTitle])).entries()]
      .sort((a, b) => a[1].localeCompare(b[1]));
    courseFilter.replaceChildren(new Option(text('All courses', '全部课程', 'すべてのコース'), ''));
    courses.forEach(([id, title]) => courseFilter.appendChild(new Option(title, id)));
    courseFilter.value = courses.some(([id]) => id === previous) ? previous : '';
  }

  function visibleNotes() {
    const query = search.value.trim().toLowerCase();
    return notes.filter((note) => {
      if (courseFilter.value && note.courseId !== courseFilter.value) return false;
      if (selectedKind && (selectedKind === 'user' ? !['user', 'vocabulary', 'curiosity'].includes(note.kind || 'user') : note.kind !== selectedKind)) return false;
      if (selectedDay && dayKey(stampOf(note)) !== selectedDay) return false;
      if (!query) return true;
      return `${note.courseTitle} ${note.lessonTitle} ${note.section || ''} ${copyOf(note)} ${quoteOf(note)} ${note.answer || ''}`
        .toLowerCase().includes(query);
    });
  }

  function renderNotes() {
    const visible = visibleNotes();
    list.replaceChildren();
    visible.forEach((note, index) => {
      const card = template.content.firstElementChild.cloneNode(true);
      card.dataset.kind = note.kind || 'user';
      card.style.animationDelay = `${Math.min(index, 8) * 24}ms`;
      card.querySelector('.notebook-kind').textContent = kindName(note.kind);
      const time = card.querySelector('time');
      time.dateTime = new Date(stampOf(note)).toISOString();
      time.textContent = dateLabel(stampOf(note));
      const quote = card.querySelector('.notebook-quote');
      const exact = quoteOf(note);
      quote.hidden = !exact;
      quote.textContent = exact;
      const copy = card.querySelector('.notebook-copy');
      const primary = copyOf(note) || exact || text('Empty note', '空笔记', '空のノート');
      copy.textContent = primary;
      const answer = card.querySelector('.notebook-answer');
      const answerCopy = note.answer && note.answer !== primary ? String(note.answer).trim() : '';
      answer.hidden = !answerCopy;
      answer.textContent = answerCopy;
      card.querySelector('.notebook-course').textContent = note.courseTitle;
      card.querySelector('.notebook-lesson').textContent =
        `${text('Lesson', '课节', 'レッスン')} ${Number(note.lessonIndex) + 1} · ${note.lessonTitle}`;
      const open = card.querySelector('.notebook-open');
      open.href = `/course/${encodeURIComponent(note.courseId)}?panel=notes&note=${encodeURIComponent(note.id)}`;
      list.appendChild(card);
    });
    const countCopy = text(
      `${visible.length} ${visible.length === 1 ? 'note' : 'notes'}`,
      `${visible.length} 条笔记`,
      `${visible.length} 件のノート`,
    );
    visibleCount.textContent = countCopy;
    total.textContent = String(notes.length);
    empty.hidden = visible.length > 0;
    list.hidden = visible.length === 0;
    filterLabel.textContent = selectedDay
      ? dateLabel(`${selectedDay}T12:00:00`)
      : (courseFilter.selectedOptions[0]?.textContent || text('All courses', '全部课程', 'すべてのコース'));
  }

  function renderActivity() {
    const byDay = new Map();
    activity.forEach((event) => {
      const key = dayKey(event.timestamp);
      if (!key) return;
      if (!byDay.has(key)) byDay.set(key, []);
      byDay.get(key).push(event);
    });
    if (activityWeekdays) {
      // 2024-01-01 is a Monday; Mon/Wed/Fri labels localized via Intl, same as month labels.
      activityWeekdays.replaceChildren(...[1, 3, 5].map((day) => {
        const label = document.createElement('span');
        label.textContent = new Intl.DateTimeFormat(i18n()?.locale || 'en', { weekday: 'short' }).format(new Date(2024, 0, day));
        return label;
      }));
    }
    const end = new Date();
    end.setHours(12, 0, 0, 0);
    const start = new Date(end);
    start.setDate(start.getDate() - 370);
    start.setDate(start.getDate() - start.getDay());
    const days = [];
    for (const cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) days.push(new Date(cursor));
    const max = Math.max(1, ...[...byDay.values()].map((events) => events.length));
    activityGrid.replaceChildren();
    activityMonths.replaceChildren();
    activityGrid.setAttribute('aria-rowcount', '7');
    activityGrid.setAttribute('aria-colcount', String(Math.ceil(days.length / 7)));
    const monthSeen = new Set();
    days.forEach((date, index) => {
      if (date.getDate() <= 7) {
        const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
        if (!monthSeen.has(monthKey)) {
          monthSeen.add(monthKey);
          const label = document.createElement('span');
          label.style.gridColumn = `${Math.floor(index / 7) + 1} / span 4`;
          label.textContent = new Intl.DateTimeFormat(i18n()?.locale || 'en', { month: 'short' }).format(date);
          activityMonths.appendChild(label);
        }
      }
      const key = dayKey(date);
      const events = byDay.get(key) || [];
      const count = events.length;
      const level = count === 0 ? 0 : Math.min(4, Math.max(1, Math.ceil((count / max) * 4)));
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'activity-day';
      cell.dataset.day = key;
      cell.dataset.level = String(level);
      cell.setAttribute('role', 'gridcell');
      cell.setAttribute('aria-rowindex', String((index % 7) + 1));
      cell.setAttribute('aria-colindex', String(Math.floor(index / 7) + 1));
      cell.setAttribute('aria-selected', String(selectedDay === key));
      cell.tabIndex = -1;
      const label = text(
        `${dateLabel(date)}: ${count} ${count === 1 ? 'activity' : 'activities'}`,
        `${dateLabel(date)}：${count} 项学习活动`,
        `${dateLabel(date)}：${count} 件の学習活動`,
      );
      cell.title = label;
      cell.setAttribute('aria-label', label);
      cell.addEventListener('click', () => {
        selectedDay = selectedDay === key ? '' : key;
        document.querySelectorAll('.activity-day').forEach((item) => {
          const active = selectedDay === item.dataset.day;
          item.classList.toggle('active', active);
          item.setAttribute('aria-selected', String(active));
        });
        setActivityTabStop(cell);
        if (!count) {
          activityDetail.textContent = text('No recorded activity on this day.', '这一天还没有学习记录。', 'この日の学習記録はありません。');
        } else {
          const noteCount = events.filter((event) => event.type === 'note').length;
          const practiceCount = events.filter((event) => event.type === 'practice').length;
          const lessonCount = events.filter((event) => event.type === 'lesson-opened').length;
          activityDetail.textContent = text(
            `${dateLabel(date)} · ${lessonCount} lessons opened, ${noteCount} notes, ${practiceCount} practice attempts`,
            `${dateLabel(date)} · 打开 ${lessonCount} 个课节，记录 ${noteCount} 条笔记，完成 ${practiceCount} 次练习`,
            `${dateLabel(date)} · レッスン ${lessonCount} 件、ノート ${noteCount} 件、練習 ${practiceCount} 回`,
          );
        }
        renderNotes();
      });
      cell.classList.toggle('active', selectedDay === key);
      activityGrid.appendChild(cell);
    });
    setActivityTabStop(activityGrid.querySelector(`[data-day="${CSS.escape(selectedDay)}"]`) || activityGrid.lastElementChild);
    const activeDays = byDay.size;
    activitySummary.textContent = text(
      `${activeDays} active ${activeDays === 1 ? 'day' : 'days'} in the past year.`,
      `过去一年有 ${activeDays} 天留下了学习记录。`,
      `過去1年間に ${activeDays} 日の学習記録があります。`,
    );
    const scroll = activityGrid.parentElement;
    scroll.scrollLeft = scroll.scrollWidth;
  }

  async function load() {
    const queryCourse = new URLSearchParams(location.search).get('course') || '';
    try {
      const [notesResponse, activityResponse] = await Promise.all([fetch('/api/notes'), fetch('/api/activity')]);
      const notesData = notesResponse.ok ? await notesResponse.json() : { notes: [] };
      const activityData = activityResponse.ok ? await activityResponse.json() : { events: [] };
      notes = Array.isArray(notesData.notes) ? notesData.notes : [];
      activity = Array.isArray(activityData.events) ? activityData.events : [];
      updateCourseOptions();
      if ([...courseFilter.options].some((option) => option.value === queryCourse)) courseFilter.value = queryCourse;
      renderActivity();
      renderNotes();
      i18n()?.apply(document);
    } catch {
      empty.hidden = false;
      list.hidden = true;
      empty.querySelector('h3').textContent = text('Notes could not be loaded', '笔记暂时无法加载', 'ノートを読み込めませんでした');
      empty.querySelector('p').textContent = text('Your course data is still saved. Refresh to try again.', '课程数据仍然安全保存，请刷新重试。', 'コースデータは保存されています。更新して再試行してください。');
    }
  }

  search.addEventListener('input', renderNotes);
  courseFilter.addEventListener('change', renderNotes);
  activityGrid.addEventListener('keydown', handleActivityGridKeydown);
  kindButtons.forEach((button) => button.addEventListener('click', () => {
    selectedKind = button.dataset.kind || '';
    kindButtons.forEach((item) => item.classList.toggle('active', item === button));
    renderNotes();
  }));
  clearFilters.addEventListener('click', () => {
    search.value = '';
    courseFilter.value = '';
    selectedKind = '';
    selectedDay = '';
    kindButtons.forEach((button) => button.classList.toggle('active', !button.dataset.kind));
    document.querySelectorAll('.activity-day.active').forEach((item) => item.classList.remove('active'));
    renderNotes();
  });
  window.addEventListener('lucubro:localechange', () => {
    updateCourseOptions();
    renderActivity();
    renderNotes();
  });

  void load();
})();
