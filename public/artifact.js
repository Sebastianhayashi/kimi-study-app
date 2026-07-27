(() => {
  'use strict';
  const loading = document.getElementById('artifactLoading');
  const error = document.getElementById('artifactError');
  const errorMessage = document.getElementById('artifactErrorMessage');
  const retry = document.getElementById('artifactRetry');
  const workspace = document.getElementById('artifactWorkspace');
  const artifactId = decodeURIComponent(location.pathname.split('/').filter(Boolean).pop() || '');
  const tr = (value) => window.LucubroI18n?.t(value) || value;
  const statusLabels = {
    waiting_for_source: 'Waiting for source',
    waiting_for_mission: 'Waiting for mission',
    draft: 'Draft',
    revising: 'Revising',
    ready: 'Ready',
    delivered: 'Delivered',
    archived: 'Archived',
    open: 'Open',
    accepted: 'Accepted',
    rejected: 'Rejected',
    modified: 'Modified',
    orphaned: 'Orphaned',
    resolved: 'Resolved',
  };
  const statusText = (value) => tr(statusLabels[value] || value || 'Draft');

  function text(id, value) { document.getElementById(id).textContent = value || ''; }
  function list(id, values, empty) {
    const host = document.getElementById(id);
    host.replaceChildren();
    const items = values.length ? values : [empty];
    for (const value of items) {
      const li = document.createElement('li');
      li.textContent = value;
      host.appendChild(li);
    }
  }

  async function load() {
    loading.hidden = false;
    error.hidden = true;
    workspace.hidden = true;
    try {
      const response = await fetch(`/api/artifacts/${encodeURIComponent(artifactId)}`);
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(tr('The artifact could not be loaded.'));
      const artifact = body.artifact;
      text('artifactStatus', statusText(artifact.status));
      text('artifactTitle', artifact.title);
      text('artifactAudience', artifact.audience);
      text('missionProblem', artifact.missionSnapshot?.problemStatement || tr('Not available yet'));
      text('missionOutput', artifact.missionSnapshot?.expectedOutput || tr('Not available yet'));
      list('artifactRubric', artifact.rubric.map((item) => `${item.label}: ${item.minimum}`), tr('No standards'));
      list('artifactGaps', artifact.gaps.map((gap) => `${gap.summary} (${statusText(gap.status)})`), tr('No critique gaps yet'));
      const draft = document.getElementById('artifactBody');
      const structureOnly = artifact.contentStorage === 'structure-only';
      draft.hidden = structureOnly;
      draft.value = body.draft || '';
      document.getElementById('structureOnlyNotice').hidden = !structureOnly;
      const courseLink = document.getElementById('artifactCourseLink');
      courseLink.href = artifact.primaryCourseId ? `/course/${encodeURIComponent(artifact.primaryCourseId)}?returnTo=${encodeURIComponent(`/artifact/${artifact.id}`)}` : '/app?view=courses';
      courseLink.textContent = tr(artifact.primaryCourseId ? 'Open linked course' : 'Link source material later');
      const deferredError = sessionStorage.getItem(`lucubro-artifact-link-error:${artifact.id}`);
      if (deferredError) {
        sessionStorage.removeItem(`lucubro-artifact-link-error:${artifact.id}`);
        errorMessage.textContent = `${tr('Artifact saved, but source material was not linked:')} ${tr('The request could not be completed.')}`;
        error.hidden = false;
      }
      document.title = `${artifact.title} · Lucubro`;
      workspace.hidden = false;
    } catch (loadError) {
      errorMessage.textContent = loadError.message;
      error.hidden = false;
    } finally {
      loading.hidden = true;
    }
  }

  retry.addEventListener('click', load);
  load();
})();
