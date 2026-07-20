'use strict';

async function installMockEventSource(page) {
  await page.addInitScript(() => {
    class MockEventSource {
      static CONNECTING = 0;
      static OPEN = 1;
      static CLOSED = 2;
      static instances = [];

      constructor(url) {
        this.url = String(url);
        this.withCredentials = false;
        this.readyState = MockEventSource.CONNECTING;
        this.listeners = new Map();
        this.closed = false;
        MockEventSource.instances.push(this);
        queueMicrotask(() => {
          if (this.closed) return;
          this.readyState = MockEventSource.OPEN;
          this.dispatch('open', { type: 'open' });
        });
      }

      addEventListener(type, listener) {
        const list = this.listeners.get(type) || [];
        list.push(listener);
        this.listeners.set(type, list);
      }

      removeEventListener(type, listener) {
        const list = this.listeners.get(type) || [];
        this.listeners.set(type, list.filter((item) => item !== listener));
      }

      dispatch(type, event) {
        for (const listener of this.listeners.get(type) || []) listener.call(this, event);
        const property = this[`on${type}`];
        if (typeof property === 'function') property.call(this, event);
      }

      emitGenerationEvent(payload) {
        if (this.closed) return;
        this.dispatch('generation-event', {
          type: 'generation-event',
          data: JSON.stringify(payload),
          lastEventId: String(payload?.id ?? ''),
          origin: location.origin,
        });
      }

      emitError(message = 'mock EventSource connection lost') {
        if (this.closed) return;
        this.readyState = MockEventSource.CONNECTING;
        this.dispatch('error', { type: 'error', message });
      }

      reopen() {
        if (this.closed) return;
        this.readyState = MockEventSource.OPEN;
        this.dispatch('open', { type: 'open' });
      }

      close() {
        this.closed = true;
        this.readyState = MockEventSource.CLOSED;
      }
    }

    const latest = () => [...MockEventSource.instances].reverse().find((item) => !item.closed)
      || MockEventSource.instances.at(-1)
      || null;

    window.EventSource = MockEventSource;
    window.__kimiTestEventSource = {
      emit(payload) {
        const source = latest();
        if (!source) throw new Error('No mock EventSource instance');
        source.emitGenerationEvent(payload);
      },
      disconnect(message) {
        latest()?.emitError(message);
      },
      reconnect() {
        latest()?.reopen();
      },
      snapshot() {
        return MockEventSource.instances.map((source) => ({
          url: source.url,
          readyState: source.readyState,
          closed: source.closed,
        }));
      },
    };
  });
}

async function emitGenerationEvent(page, payload) {
  await page.evaluate((event) => window.__kimiTestEventSource.emit(event), payload);
}

async function disconnectGenerationEvents(page, message) {
  await page.evaluate((value) => window.__kimiTestEventSource.disconnect(value), message);
}

async function reconnectGenerationEvents(page) {
  await page.evaluate(() => window.__kimiTestEventSource.reconnect());
}

module.exports = {
  installMockEventSource,
  emitGenerationEvent,
  disconnectGenerationEvents,
  reconnectGenerationEvents,
};
