(() => {
  const match = location.pathname.match(/^\/course\/([a-z0-9]+)$/i);
  if (!match || typeof EventSource !== 'function') return;

  const source = new EventSource(`/api/courses/${match[1]}/generation-events`);
  source.addEventListener('generation-event', (message) => {
    try {
      const event = JSON.parse(message.data);
      const preview = window.KimiGenerationPreview?.current;
      if (preview) preview.appendEvent(event);
      else (window.__kimiGenerationEventQueue ||= []).push(event);
    } catch {}
  });
  window.addEventListener('pagehide', () => source.close(), { once: true });
})();
