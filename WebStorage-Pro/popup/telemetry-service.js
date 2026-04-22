(() => {
  function createTelemetryService({ flushIntervalMs = 8000, maxQueue = 200 } = {}) {
    const state = {
      queue: [],
      timer: null,
      context: {}
    };

    function scheduleFlush() {
      if (state.timer) return;
      state.timer = window.setTimeout(() => {
        flush();
      }, flushIntervalMs);
    }

    function setContext(nextContext = {}) {
      state.context = { ...state.context, ...nextContext };
    }

    function track(event, props = {}) {
      if (!event) return;
      const payload = {
        event,
        ts: Date.now(),
        ...state.context,
        ...props
      };
      state.queue.push(payload);
      if (state.queue.length > maxQueue) {
        state.queue.splice(0, state.queue.length - maxQueue);
      }
      scheduleFlush();
    }

    function flush() {
      if (state.timer) {
        clearTimeout(state.timer);
        state.timer = null;
      }
      if (state.queue.length === 0) return;
      // Reserved for future endpoint reporting. Keep in-memory for now.
      state.queue = [];
    }

    return {
      setContext,
      track,
      flush
    };
  }

  window.createTelemetryService = createTelemetryService;
})();
