(function migrateLucubroStorage() {
  'use strict';

  try {
    const storage = window.localStorage;
    const keys = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key) keys.push(key);
    }

    keys.forEach((oldKey) => {
      let newKey = '';
      if (oldKey.startsWith('kimi-study-')) {
        newKey = oldKey.replace(/^kimi-study-/, 'lucubro-');
      } else if (oldKey.startsWith('kimi-study:')) {
        newKey = oldKey.replace(/^kimi-study:/, 'lucubro:');
      }

      if (!newKey) return;
      if (storage.getItem(newKey) === null) {
        storage.setItem(newKey, storage.getItem(oldKey));
      }
      storage.removeItem(oldKey);
    });
  } catch {
    // Storage may be blocked or unavailable. Brand migration must never block the page.
  }
}());
