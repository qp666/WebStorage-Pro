(() => {
  function createWatchUtils() {
    function getWatchIntervalMs({
      now = Date.now(),
      lastInteractionAt = 0,
      activeWindowMs = 12000,
      activeIntervalMs = 1000,
      idleIntervalMs = 4000,
      fallbackIntervalMs = 1200
    } = {}) {
      const delta = now - lastInteractionAt;
      if (delta <= activeWindowMs) {
        return activeIntervalMs;
      }
      return idleIntervalMs || fallbackIntervalMs;
    }

    function nextRequestSeq(currentSeq = 0) {
      return Number(currentSeq) + 1;
    }

    function shouldApplyRequest(requestSeq, latestIssuedSeq) {
      return Number(requestSeq) >= Number(latestIssuedSeq);
    }

    return {
      getWatchIntervalMs,
      nextRequestSeq,
      shouldApplyRequest
    };
  }

  window.createWatchUtils = createWatchUtils;
})();
