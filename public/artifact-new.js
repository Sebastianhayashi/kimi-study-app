(() => {
  'use strict';
  const form = document.getElementById('artifactForm');
  const courseSelect = document.getElementById('artifactCourse');
  const error = document.getElementById('artifactError');
  const submit = document.getElementById('artifactSubmit');
  const tr = (value) => window.LucubroI18n?.t(value) || value;

  async function json(url, options) {
    const response = await fetch(url, options);
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(tr('The request could not be completed.'));
    return body;
  }

  async function loadCourses() {
    try {
      const courses = await json('/api/courses');
      for (const course of courses.filter((item) => item.stage === 'ready')) {
        const option = document.createElement('option');
        option.value = course.id;
        option.textContent = course.title;
        courseSelect.appendChild(option);
      }
    } catch {}
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    error.hidden = true;
    submit.disabled = true;
    const rubric = [...form.querySelectorAll('input[name="rubric"]')]
      .map((input, index) => ({ label: input.value.trim(), minimum: input.value.trim(), source: 'user', index }))
      .filter((item) => item.label);
    try {
      const created = await json('/api/artifacts', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          taskType: 'zhihu-answer',
          title: form.elements.title.value.trim(),
          audience: form.elements.audience.value.trim(),
          contentStorage: form.elements.contentStorage.value,
          rubric,
          primaryCourseId: null,
        }),
      });
      const artifactId = created.artifact.id;
      if (courseSelect.value) {
        try {
          await json(`/api/artifacts/${encodeURIComponent(artifactId)}/link-course`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ courseId: courseSelect.value }),
          });
        } catch (linkError) {
          sessionStorage.setItem(`lucubro-artifact-link-error:${artifactId}`, linkError.message);
        }
      }
      location.assign(`/artifact/${encodeURIComponent(artifactId)}`);
    } catch (requestError) {
      error.textContent = requestError.message;
      error.hidden = false;
      submit.disabled = false;
    }
  });

  loadCourses();
})();
