// Served verbatim as GET /THP_analytics.js (see telemetry.controller.ts).
// Cookieless: session id lives in sessionStorage, rotates per tab session.
// Avoids CORS preflight entirely — sendBeacon (and the fetch fallback) send
// the JSON batch as a `text/plain` body, which the /telemetry route parses
// as raw text regardless of declared content-type (see main.ts).
export const THP_ANALYTICS_SCRIPT = `(function () {
  var script = document.currentScript;
  var projectId = script && script.getAttribute('data-project-id');
  var endpoint = new URL('/telemetry', script.src).toString();

  function utmParams() {
    var params = new URLSearchParams(location.search);
    var utm = {};
    ['utm_source', 'utm_medium', 'utm_campaign'].forEach(function (key) {
      var v = params.get(key);
      if (v) utm[key] = v;
    });
    return utm;
  }

  var sid = sessionStorage.getItem('thp_sid');
  var startedAt = sessionStorage.getItem('thp_start');
  var utm;
  if (!sid) {
    sid = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));
    startedAt = String(Date.now());
    // Captured once, here, at session start — not re-parsed per pageview, or
    // a second pageview with no query string would silently drop attribution.
    utm = utmParams();
    sessionStorage.setItem('thp_sid', sid);
    sessionStorage.setItem('thp_start', startedAt);
    sessionStorage.setItem('thp_utm', JSON.stringify(utm));
  } else {
    utm = JSON.parse(sessionStorage.getItem('thp_utm') || '{}');
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
  track('session_start', Object.assign({ sessionStart: Number(startedAt) }, utm));

  document.addEventListener('click', function (e) {
    var el = e.target.closest && e.target.closest('[data-thp-track]');
    if (el) track('click', { tag: el.getAttribute('data-thp-track') });
  });

  // Runtime script errors land here (resource-load failures like a broken
  // <img> don't bubble to window, so those aren't captured — only actual JS
  // errors are). Expect a lot of "Script error." with no file/line from
  // cross-origin scripts served without CORS — that's a browser privacy
  // limitation, not a bug in this capture.
  addEventListener('error', function (e) {
    track('error', {
      message: e.message || 'Unknown error',
      file: e.filename || null,
      line: e.lineno || null,
      col: e.colno || null,
    });
  });

  // Scroll depth: fires once per milestone per page load. No SPA route
  // hooking here, so a full navigation re-executes this script from scratch
  // and naturally resets scrollHit.
  var scrollMilestones = [25, 50, 75, 100];
  var scrollHit = {};
  var scrollTimer = null;
  function checkScroll() {
    var doc = document.documentElement;
    var height = doc.scrollHeight - doc.clientHeight;
    var pct = height > 0 ? Math.min(100, Math.round(((window.scrollY || doc.scrollTop) / height) * 100)) : 100;
    scrollMilestones.forEach(function (m) {
      if (pct >= m && !scrollHit[m]) {
        scrollHit[m] = true;
        track('scroll_depth', { depth: m });
      }
    });
  }
  addEventListener('scroll', function () {
    if (scrollTimer) return;
    scrollTimer = setTimeout(function () {
      scrollTimer = null;
      checkScroll();
    }, 500);
  }, { passive: true });

  // Active dwell time: a real start/pause/resume state machine (not a reuse
  // of the session timer above) — pauses on tab-hidden AND on >30s of no
  // mouse/key/scroll/click activity, so a backgrounded or AFK tab doesn't
  // inflate "time on page".
  var dwellMs = 0;
  var dwellActive = true;
  var lastTick = Date.now();
  var idleTimer;
  function tickDwell() {
    var now = Date.now();
    if (dwellActive) dwellMs += now - lastTick;
    lastTick = now;
  }
  function pauseDwell() {
    tickDwell();
    dwellActive = false;
  }
  function resumeDwell() {
    if (!dwellActive && document.visibilityState === 'visible') {
      dwellActive = true;
      lastTick = Date.now();
    }
    clearTimeout(idleTimer);
    idleTimer = setTimeout(pauseDwell, 30000);
  }
  ['mousemove', 'keydown', 'scroll', 'click'].forEach(function (evt) {
    addEventListener(evt, resumeDwell, { passive: true });
  });
  resumeDwell();
  function flushDwell() {
    tickDwell();
    if (dwellMs > 0) {
      track('dwell', { ms: dwellMs });
      dwellMs = 0;
    }
  }

  // Core Web Vitals (partial — no INP here, deferred: a spec-accurate
  // version needs per-interaction event timing + a percentile, not just
  // "time after first click", and hand-rolling an approximation was judged
  // not worth it yet). LCP keeps updating until the page backgrounds or the
  // user interacts — a PerformanceObserver just tracks the latest candidate,
  // reported (with nav timing) at the same hidden/pagehide points as
  // session_end/dwell above. Same duplicate-tolerant design as session_end:
  // if the tab is hidden more than once, vitals can report more than once
  // too — take the latest per session at read time, nothing here dedupes it.
  var lcpValue = null;
  if (window.PerformanceObserver) {
    try {
      new PerformanceObserver(function (list) {
        var entries = list.getEntries();
        var last = entries[entries.length - 1];
        if (last) lcpValue = last.renderTime || last.loadTime || last.startTime;
      }).observe({ type: 'largest-contentful-paint', buffered: true });
    } catch (err) {}
  }
  function flushVitals() {
    var vitals = {};
    if (lcpValue !== null) vitals.lcp = Math.round(lcpValue);
    var nav = performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
    if (nav) {
      vitals.ttfb = Math.round(nav.responseStart);
      vitals.dns = Math.round(nav.domainLookupEnd - nav.domainLookupStart);
      vitals.tcp = Math.round(nav.connectEnd - nav.connectStart);
      vitals.domContentLoaded = Math.round(nav.domContentLoadedEventEnd);
      vitals.loadComplete = Math.round(nav.loadEventEnd);
    }
    if (Object.keys(vitals).length) track('vitals', vitals);
  }

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') {
      pauseDwell();
      flushDwell();
      flushVitals();
      track('session_end', { durationMs: Date.now() - Number(startedAt) });
      flush();
    } else {
      resumeDwell();
    }
  });
  addEventListener('pagehide', function () {
    flushDwell();
    flushVitals();
    flush();
  });
  setInterval(flush, 5000);
})();
`;
