/* Manara link — signed messages between the mosque screen and the imam's phone.
 * Messages travel through an ntfy server (https://ntfy.sh by default) on a random topic.
 * Each one is signed with HMAC-SHA256 using a key that lives only in the pairing QR code,
 * so knowing the topic is not enough to control a screen. Plain ES5, no dependencies. */
(function (root) {
  'use strict';

  /* ---------- bytes ---------- */
  function utf8(s) {
    s = String(s);
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(s);
    var b = unescape(encodeURIComponent(s)), a = new Uint8Array(b.length);
    for (var i = 0; i < b.length; i++) a[i] = b.charCodeAt(i);
    return a;
  }
  function concat(a, b) { var o = new Uint8Array(a.length + b.length); o.set(a, 0); o.set(b, a.length); return o; }
  function hex(b) { var s = ''; for (var i = 0; i < b.length; i++) s += (b[i] < 16 ? '0' : '') + b[i].toString(16); return s; }
  function b64u(b) {
    var s = '';
    for (var i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function unb64u(s) {
    s = String(s || '').replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    var b = atob(s), a = new Uint8Array(b.length);
    for (var i = 0; i < b.length; i++) a[i] = b.charCodeAt(i);
    return a;
  }
  function rand(n) {
    var a = new Uint8Array(n), c = root.crypto || root.msCrypto;
    if (c && c.getRandomValues) c.getRandomValues(a);
    else for (var i = 0; i < n; i++) a[i] = Math.floor(Math.random() * 256);
    return a;
  }
  function newId(n) { return b64u(rand(n || 16)); }

  /* ---------- SHA-256 / HMAC (FIPS 180-4, RFC 2104) ---------- */
  var K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];
  function sha256(msg) {
    var len = msg.length, bitLenHi = Math.floor(len / 0x20000000), bitLenLo = (len * 8) >>> 0;
    var padLen = ((len + 9 + 63) >> 6) << 6, m = new Uint8Array(padLen);
    m.set(msg); m[len] = 0x80;
    m[padLen - 8] = (bitLenHi >>> 24) & 255; m[padLen - 7] = (bitLenHi >>> 16) & 255;
    m[padLen - 6] = (bitLenHi >>> 8) & 255; m[padLen - 5] = bitLenHi & 255;
    m[padLen - 4] = (bitLenLo >>> 24) & 255; m[padLen - 3] = (bitLenLo >>> 16) & 255;
    m[padLen - 2] = (bitLenLo >>> 8) & 255; m[padLen - 1] = bitLenLo & 255;
    var h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a,
        h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;
    var w = new Array(64);
    for (var off = 0; off < padLen; off += 64) {
      for (var i = 0; i < 16; i++) {
        var j = off + i * 4;
        w[i] = ((m[j] << 24) | (m[j + 1] << 16) | (m[j + 2] << 8) | m[j + 3]) | 0;
      }
      for (i = 16; i < 64; i++) {
        var x = w[i - 15], y = w[i - 2];
        var s0 = ((x >>> 7) | (x << 25)) ^ ((x >>> 18) | (x << 14)) ^ (x >>> 3);
        var s1 = ((y >>> 17) | (y << 15)) ^ ((y >>> 19) | (y << 13)) ^ (y >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
      }
      var a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
      for (i = 0; i < 64; i++) {
        var S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
        var ch = (e & f) ^ (~e & g);
        var t1 = (h + S1 + ch + K[i] + w[i]) | 0;
        var S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
        var maj = (a & b) ^ (a & c) ^ (b & c);
        var t2 = (S0 + maj) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      h0 = (h0 + a) | 0; h1 = (h1 + b) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0;
      h4 = (h4 + e) | 0; h5 = (h5 + f) | 0; h6 = (h6 + g) | 0; h7 = (h7 + h) | 0;
    }
    var out = new Uint8Array(32), hs = [h0, h1, h2, h3, h4, h5, h6, h7];
    for (i = 0; i < 8; i++) {
      out[i * 4] = (hs[i] >>> 24) & 255; out[i * 4 + 1] = (hs[i] >>> 16) & 255;
      out[i * 4 + 2] = (hs[i] >>> 8) & 255; out[i * 4 + 3] = hs[i] & 255;
    }
    return out;
  }
  function hmac(key, msg) {
    if (key.length > 64) key = sha256(key);
    var k = new Uint8Array(64); k.set(key);
    var ip = new Uint8Array(64), op = new Uint8Array(64);
    for (var i = 0; i < 64; i++) { ip[i] = k[i] ^ 0x36; op[i] = k[i] ^ 0x5c; }
    return sha256(concat(op, sha256(concat(ip, msg))));
  }
  function sameText(a, b) {
    if (a.length !== b.length) return false;
    var r = 0;
    for (var i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return r === 0;
  }

  /* ---------- envelopes ---------- */
  function seal(key, obj) {
    var p = JSON.stringify(obj);
    return JSON.stringify({ p: p, s: hex(hmac(unb64u(key), utf8(p))) });
  }
  function open(key, text) {
    try {
      var o = JSON.parse(text);
      if (!o || typeof o.p !== 'string' || typeof o.s !== 'string') return null;
      if (!sameText(hex(hmac(unb64u(key), utf8(o.p))), o.s)) return null;
      var v = JSON.parse(o.p);
      return v && typeof v === 'object' ? v : null;
    } catch (e) { return null; }
  }

  /* ---------- ntfy channel: live stream (SSE) with a slow poll as a safety net ---------- */
  function Channel(opt) {
    var base = String(opt.server || DEFAULT_SERVER).replace(/\/+$/, '') + '/' + encodeURIComponent(opt.topic);
    var es = null, closed = false, lastId = '', seen = {}, seenList = [];
    var retry = 0, retryT = 0, pollT = 0, watchT = 0, lastBeat = 0, state = '';
    var DELAYS = [2, 5, 10, 20, 40, 60];

    function setState(s) { if (s !== state) { state = s; if (opt.onState) try { opt.onState(s); } catch (e) {} } }
    function since() { return lastId || opt.since || '10m'; }
    function beat() { lastBeat = Date.now(); retry = 0; setState('online'); }
    function remember(id) {
      seen[id] = 1; seenList.push(id);
      if (seenList.length > 300) delete seen[seenList.shift()];
    }
    function handle(obj) {
      if (!obj || typeof obj !== 'object') return;
      if (obj.event === 'open' || obj.event === 'keepalive') { beat(); return; }
      if (obj.event !== 'message') return;
      beat();
      if (obj.id) { if (seen[obj.id]) return; remember(obj.id); lastId = obj.id; }
      if (opt.onMessage) try { opt.onMessage(String(obj.message || ''), obj); } catch (e) {}
    }
    function scheduleRetry() {
      if (closed) return;
      clearTimeout(retryT);
      retryT = setTimeout(connect, DELAYS[Math.min(retry, DELAYS.length - 1)] * 1000);
      retry++;
    }
    function connect() {
      if (closed) return;
      clearTimeout(retryT);
      if (es) { try { es.close(); } catch (e) {} es = null; }
      if (typeof EventSource === 'undefined') { setState('connecting'); poll(); return; }
      if (state !== 'online') setState('connecting');
      try { es = new EventSource(base + '/sse?since=' + encodeURIComponent(since())); }
      catch (e) { setState('offline'); scheduleRetry(); return; }
      es.onmessage = function (ev) { try { handle(JSON.parse(ev.data)); } catch (e) {} };
      es.addEventListener('open', function () { beat(); });
      es.addEventListener('keepalive', function () { beat(); });
      es.onerror = function () {
        if (es) { try { es.close(); } catch (e) {} es = null; }
        setState('offline'); scheduleRetry();
      };
    }
    function poll() {
      if (closed || typeof fetch === 'undefined') return;
      fetch(base + '/json?poll=1&since=' + encodeURIComponent(since()), { cache: 'no-store' })
        .then(function (r) { if (!r.ok) throw new Error(String(r.status)); return r.text(); })
        .then(function (t) {
          beat();
          t.split('\n').forEach(function (line) { if (line.trim()) { try { handle(JSON.parse(line)); } catch (e) {} } });
        })
        .catch(function () { if (typeof EventSource === 'undefined') setState('offline'); });
    }
    function publish(text, tries) {
      if (typeof fetch === 'undefined') return Promise.reject(new Error('no fetch'));
      tries = tries == null ? 2 : tries;
      return fetch(base, { method: 'POST', body: text, cache: 'no-store' })
        .then(function (r) { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
        .then(function (m) { if (m && m.id) remember(m.id); return m; })
        .catch(function (e) {
          if (tries <= 1) throw e;
          return new Promise(function (ok) { setTimeout(ok, 2500); }).then(function () { return publish(text, tries - 1); });
        });
    }

    connect();
    // The poll catches anything the stream missed; the watchdog restarts a stream that went quiet.
    pollT = setInterval(function () { if (state === 'online' || typeof EventSource === 'undefined') poll(); }, typeof EventSource === 'undefined' ? 15000 : 60000);
    watchT = setInterval(function () {
      if (typeof EventSource !== 'undefined' && es && lastBeat && Date.now() - lastBeat > 110000) { setState('connecting'); connect(); }
    }, 30000);

    return {
      publish: publish,
      reconnect: function () { retry = 0; connect(); },
      state: function () { return state; },
      close: function () {
        closed = true;
        clearTimeout(retryT); clearInterval(pollT); clearInterval(watchT);
        if (es) { try { es.close(); } catch (e) {} es = null; }
        setState('off');
      }
    };
  }

  var DEFAULT_SERVER = 'https://ntfy.sh';
  root.ManaraLink = {
    utf8: utf8, hex: hex, b64u: b64u, unb64u: unb64u, newId: newId,
    sha256: sha256, hmac: hmac, seal: seal, open: open,
    Channel: Channel, DEFAULT_SERVER: DEFAULT_SERVER,
    topic: function (ch) { return 'mnr-' + ch; }
  };
})(typeof window !== 'undefined' ? window : this);
