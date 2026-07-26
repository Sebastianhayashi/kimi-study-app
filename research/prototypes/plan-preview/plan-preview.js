(() => {
  'use strict';
  const plan = window.LUCUBRO_PLAN_PREVIEW;
  if (!plan) return;
  document.getElementById('sourceDigest').textContent = plan.sourceDigest;
  document.getElementById('teachMission').textContent = plan.mission;
  const list = document.getElementById('lessonList');
  plan.lessons.forEach((lesson, index) => {
    const article = document.createElement('article');
    article.className = 'lesson-card';
    article.innerHTML = `
      <span class="lesson-index" aria-hidden="true">${index + 1}</span>
      <div>
        <h2></h2>
        <dl>
          <div><dt>Objective</dt><dd data-field="objective"></dd></div>
          <div><dt>Source coverage</dt><dd data-field="coverage"></dd></div>
          <div><dt>Planned practice</dt><dd data-field="practice"></dd></div>
        </dl>
      </div>`;
    article.querySelector('h2').textContent = lesson.title;
    article.querySelector('[data-field="objective"]').textContent = lesson.objective;
    article.querySelector('[data-field="coverage"]').textContent = lesson.coverage;
    article.querySelector('[data-field="practice"]').textContent = lesson.practice;
    list.appendChild(article);
  });
  window.LucubroI18n?.apply(document);
})();
