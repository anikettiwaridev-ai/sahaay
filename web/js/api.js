/* Sahaay - the only place that talks HTTP.
 * Contract: 00-CONTRACTS.md §3. Every function returns a Promise of parsed
 * JSON, or throws. The auth token lives in localStorage under "sahaay_token"
 * and is attached automatically; no page ever handles it.
 */
(function () {
  "use strict";

  var TOKEN_KEY = "sahaay_token";

  /* Contract §2: the server is http://127.0.0.1:8000. When the page is itself
   * served over http (Track A serves web/ statically) we use that same origin,
   * which is the identical address with no cross-origin request. Opened from
   * the filesystem, we fall back to the contract's literal base. */
  var BASE = (location.protocol === "http:" || location.protocol === "https:")
    ? location.origin
    : "http://127.0.0.1:8000";

  function getToken() {
    try { return localStorage.getItem(TOKEN_KEY) || ""; } catch (e) { return ""; }
  }

  function setToken(value) {
    try {
      if (value) { localStorage.setItem(TOKEN_KEY, value); }
      else { localStorage.removeItem(TOKEN_KEY); }
    } catch (e) { console.warn("[Sahaay] token could not be stored:", e); }
  }

  function apiError(message, status, payload) {
    var err = new Error(message);
    err.status = status || 0;
    err.payload = payload || null;
    return err;
  }

  /* The single request helper. Everything below is three lines because of it. */
  function request(method, path, body, isForm) {
    var opts = { method: method, headers: {}, credentials: "omit" };
    var token = getToken();
    if (token) { opts.headers["Authorization"] = "Bearer " + token; }
    if (isForm) {
      opts.body = body;                       // browser sets the multipart header
    } else if (body !== undefined && body !== null) {
      opts.headers["Content-Type"] = "application/json";
      opts.body = JSON.stringify(body);
    }
    return fetch(BASE + path, opts).then(function (res) {
      return res.text().then(function (text) {
        var data = null;
        if (text) { try { data = JSON.parse(text); } catch (e) { data = { raw: text }; } }
        if (!res.ok) { throw apiError("HTTP " + res.status + " " + method + " " + path, res.status, data); }
        return data;
      });
    }, function (netErr) {
      throw apiError("network: " + (netErr && netErr.message ? netErr.message : "unreachable"), 0, null);
    });
  }

  var API = {
    base: BASE,
    request: request,

    login: function (username, password) {
      return request("POST", "/auth/login", { username: username, password: password })
        .then(function (data) { setToken(data && data.token); return data; });
    },

    logout: function () {
      return request("POST", "/auth/logout", {})
        .catch(function () { return { ok: true }; })
        .then(function (data) { setToken(null); return data; });
    },

    me: function () {
      if (!getToken()) { return Promise.resolve(null); }
      return request("GET", "/auth/me").catch(function (err) {
        if (err.status === 401) { setToken(null); return null; }
        throw err;
      });
    },

    getProfile: function () {
      return request("GET", "/profile").then(function (data) { return data || {}; });
    },

    saveProfile: function (profile) {
      return request("PUT", "/profile", profile);
    },

    uploadPhoto: function (fileObject) {
      var form = new FormData();
      form.append("photo", fileObject, fileObject && fileObject.name ? fileObject.name : "photo.jpg");
      return request("POST", "/profile/photo", form, true);
    },

    getCatalogue: function () {
      return request("GET", "/catalogue")
        .then(function (data) { return (data && data.schemes) ? data.schemes : (data || []); });
    },

    getScheme: function (id) {
      return request("GET", "/catalogue/" + encodeURIComponent(id));
    },

    recommend: function (profile) {
      return request("POST", "/recommend", profile);
    },

    cost: function (schemeId, amount, rateKey) {
      return request("POST", "/cost", { scheme_id: schemeId, amount_inr: amount, channel_rate_key: rateKey });
    },

    route: function (schemeIds, amount, lat, lon, state) {
      return request("POST", "/route", { scheme_ids: schemeIds, amount_inr: amount, lat: lat, lon: lon, state: state });
    },

    packet: function (profile, schemeId, partnerId, amount) {
      return request("POST", "/packet", { profile: profile, scheme_id: schemeId, partner_id: partnerId, amount_inr: amount });
    },

    ask: function (question, lang, profile) {
      return request("POST", "/assistant/ask", { question: question, lang: lang || "hi", profile: profile || null });
    },

    transcribe: function (audioBlob) {
      var form = new FormData();
      form.append("audio", audioBlob, "speech.webm");
      return request("POST", "/intake/transcribe", form, true);
    },

    extract: function (text, lang) {
      return request("POST", "/intake/extract", { text: text, lang: lang || "hi" });
    },

    notificationPreview: function () {
      return request("GET", "/notifications/preview");
    }
  };

  window.API = API;
})();
