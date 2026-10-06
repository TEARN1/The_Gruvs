/* V-Gruvs speed insights: Core Web Vitals (LCP, INP, CLS, FCP, TTFB) from real
   visitors, sent once per page view to /_vgruvs/vitals. No cookies, no IDs:
   only the page path, the device class and the five numbers. */
(function () {
  'use strict';
  if (!('PerformanceObserver' in window) || navigator.webdriver) return;
  var values = {};
  var sent = false;
  var hiddenAtStart = document.visibilityState === 'hidden';
  var path = location.pathname.slice(0, 200);
  var mobile = (window.matchMedia && matchMedia('(max-width: 767px)').matches) || /Mobi|Android/i.test(navigator.userAgent);

  function observe(type, cb, opts) {
    try {
      var po = new PerformanceObserver(function (list) { list.getEntries().forEach(cb); });
      var o = opts || {};
      o.type = type;
      o.buffered = true;
      po.observe(o);
      return po;
    } catch (e) { return null; }
  }

  try {
    var nav = performance.getEntriesByType('navigation')[0];
    if (nav && nav.responseStart > 0) values.TTFB = Math.max(0, nav.responseStart - (nav.activationStart || 0));
  } catch (e) { /* older browsers */ }

  if (!hiddenAtStart) {
    observe('paint', function (e) { if (e.name === 'first-contentful-paint') values.FCP = e.startTime; });
    var lcp = observe('largest-contentful-paint', function (e) { values.LCP = e.startTime; });
    var stopLcp = function () { if (lcp) { lcp.disconnect(); lcp = null; } };
    ['keydown', 'click', 'pointerdown'].forEach(function (t) { addEventListener(t, stopLcp, { once: true, capture: true }); });
  }

  // CLS: the largest burst of layout shifts (gaps under 1 s, at most 5 s long).
  var session = 0, sessionStart = 0, sessionLast = 0;
  values.CLS = 0;
  observe('layout-shift', function (e) {
    if (e.hadRecentInput) return;
    if (session && e.startTime - sessionLast < 1000 && e.startTime - sessionStart < 5000) {
      session += e.value;
    } else {
      session = e.value;
      sessionStart = e.startTime;
    }
    sessionLast = e.startTime;
    if (session > values.CLS) values.CLS = session;
  });

  // INP: the slowest interaction (ignoring one outlier per 50 interactions).
  var interactions = {};
  function onEvent(e) {
    if (!e.interactionId) return;
    var prev = interactions[e.interactionId] || 0;
    if (e.duration > prev) interactions[e.interactionId] = e.duration;
  }
  observe('event', onEvent, { durationThreshold: 40 });
  observe('first-input', onEvent);

  function send() {
    if (sent) return;
    sent = true;
    var durations = Object.keys(interactions).map(function (k) { return interactions[k]; }).sort(function (a, b) { return b - a; });
    if (durations.length) values.INP = durations[Math.min(durations.length - 1, Math.floor(durations.length / 50))];
    var q = 'p=' + encodeURIComponent(path) + '&d=' + (mobile ? 'm' : 'd');
    Object.keys(values).forEach(function (k) {
      var v = values[k];
      if (typeof v === 'number' && isFinite(v)) q += '&' + k + '=' + (k === 'CLS' ? v.toFixed(4) : Math.round(v));
    });
    var url = '/_vgruvs/vitals?' + q;
    if (!(navigator.sendBeacon && navigator.sendBeacon(url))) {
      try { fetch(url, { method: 'POST', keepalive: true, credentials: 'omit' }); } catch (e) { /* offline */ }
    }
  }
  addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') send(); }, { capture: true });
  addEventListener('pagehide', send, { capture: true });
})();
