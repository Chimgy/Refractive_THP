// Served verbatim as GET /THP_analytics.js (see telemetry.controller.ts).
// Cookieless: session id lives in sessionStorage, rotates per tab session.
// Avoids CORS preflight entirely — sendBeacon (and the fetch fallback) send
// the JSON batch as a `text/plain` body, which the /telemetry route parses
// as raw text regardless of declared content-type (see main.ts).
export const THP_ANALYTICS_SCRIPT = `(function () {
  var script = document.currentScript;
  var projectId = script && script.getAttribute('data-project-id');
  var endpoint = new URL('/telemetry', script.src).toString();

  var sid = sessionStorage.getItem('thp_sid');
  var startedAt = sessionStorage.getItem('thp_start');
  if (!sid) {
    sid = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));
    startedAt = String(Date.now());
    sessionStorage.setItem('thp_sid', sid);
    sessionStorage.setItem('thp_start', startedAt);
  }

  var queue = [];
  function track(type, data) {
    queue.push(Object.assign({ type: type, url: location.href, ts: Date.now() }, data));
  }

  function flush() {
    if (!queue.length) return;
    var body = JSON.stringify({
      projectId: projectId,
      sessionId: sid,
      device: {
        viewport: [window.innerWidth, window.innerHeight],
        ua: navigator.userAgent,
        lang: navigator.language,
      },
      events: queue.splice(0),
    });
    var sent = false;
    if (navigator.sendBeacon) {
      sent = navigator.sendBeacon(endpoint, new Blob([body], { type: 'text/plain' }));
    }
    if (!sent) {
      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: body,
        keepalive: true,
      }).catch(function () {});
    }
  }

  track('pageview', { referrer: document.referrer });
  track('session_start', { sessionStart: Number(startedAt) });

  document.addEventListener('click', function (e) {
    var el = e.target.closest && e.target.closest('[data-thp-track]');
    if (el) track('click', { tag: el.getAttribute('data-thp-track') });
  });

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') {
      track('session_end', { durationMs: Date.now() - Number(startedAt) });
      flush();
    }
  });
  addEventListener('pagehide', flush);
  setInterval(flush, 5000);
})();
`;
