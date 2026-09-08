/* Sahaay - shared helpers used by every page.
 * Contract: 00-CONTRACTS.md §3 (the App surface), §6 (element ids), §7 (text).
 *
 * Nothing here throws on a missing element. Track B's HTML may be half-written
 * when this runs; a missing id must produce a console warning and nothing else,
 * so that one unfinished page never breaks the rest of the site.
 */
(function () {
  "use strict";

  var LANG_KEY = "sahaay_lang";
  var LANG_EVENT = "sahaay:lang";
  var TOAST_MS = 3600;
  var lang = "hi";
  var toastTimer = null;

  function warn(message) {
    console.warn("[Sahaay] " + message);
  }

  /* Guarded lookup. Every id passed here is from contracts §6. */
  function byId(id) {
    var el = document.getElementById(id);
    if (!el) { warn("missing element #" + id + " - skipping that part of the page"); }
    return el;
  }

  /* Build an element without touching innerHTML, so no string needs escaping. */
  function node(tag, opts, children) {
    var el = document.createElement(tag);
    var o = opts || {};
    if (o.className) { el.className = o.className; }
    if (o.text !== undefined && o.text !== null) { el.textContent = String(o.text); }
    if (o.key) { el.setAttribute("data-t", o.key); }
    if (o.href) { el.setAttribute("href", o.href); }
    if (o.type) { el.setAttribute("type", o.type); }
    if (o.attrs) {
      Object.keys(o.attrs).forEach(function (k) { el.setAttribute(k, o.attrs[k]); });
    }
    if (o.onClick) { el.addEventListener("click", o.onClick); }
    (children || []).forEach(function (child) {
      if (child) { el.appendChild(typeof child === "string" ? document.createTextNode(child) : child); }
    });
    return el;
  }

  function clear(el) {
    if (!el) { return null; }
    while (el.firstChild) { el.removeChild(el.firstChild); }
    return el;
  }

  function fill(el, children) {
    if (!el) { return null; }
    clear(el);
    (children || []).forEach(function (child) { if (child) { el.appendChild(child); } });
    return el;
  }

  /* ---------------------------------------------------------------- text */

  function dict() {
    var all = window.STRINGS || {};
    return all[lang] || all.en || {};
  }

  function t(key, vars) {
    var table = dict();
    var value = Object.prototype.hasOwnProperty.call(table, key) ? table[key] : null;
    if (value === null) {
      warn("no string for key \"" + key + "\" in " + lang);
      return key;
    }
    if (!vars) { return value; }
    return value.replace(/\{(\w+)\}/g, function (whole, name) {
      return Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : whole;
    });
  }

  function applyLang(root) {
    var scope = root || document;
    var nodes = scope.querySelectorAll ? scope.querySelectorAll("[data-t]") : [];
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var key = el.getAttribute("data-t");
      if (!key) { continue; }
      var text = t(key);
      var tag = el.tagName;
      /* An input or textarea carrying data-t is asking for its placeholder. */
      if (tag === "INPUT" || tag === "TEXTAREA") { el.setAttribute("placeholder", text); }
      else { el.textContent = text; }
    }
    document.documentElement.setAttribute("lang", lang);
  }

  function getLang() { return lang; }

  function setLang(next) {
    lang = (next === "en") ? "en" : "hi";
    try { localStorage.setItem(LANG_KEY, lang); } catch (e) { /* private mode */ }
    applyLang(document);
    renderNav();
    document.dispatchEvent(new CustomEvent(LANG_EVENT, { detail: { lang: lang } }));
  }

  function loadLang() {
    var stored = null;
    try { stored = localStorage.getItem(LANG_KEY); } catch (e) { stored = null; }
    lang = (stored === "en") ? "en" : "hi";
  }

  /* -------------------------------------------------------------- money */

  function money(amount) {
    var n = Number(amount);
    if (amount === null || amount === undefined || !isFinite(n)) { return t("common.na"); }
    var negative = n < 0;
    var digits = String(Math.round(Math.abs(n)));
    var last3 = digits.slice(-3);
    var rest = digits.slice(0, -3);
    var grouped = rest ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + last3 : last3;
    return (negative ? "-" : "") + "₹" + grouped;
  }

  function percent(rate) {
    var n = Number(rate);
    if (rate === null || rate === undefined || !isFinite(n)) { return t("common.na"); }
    var text = (Math.round(n * 100) / 100).toString();
    return t("common.percent", { n: text });
  }

  /* -------------------------------------------------------------- toast */

  function toast(message) {
    var el = byId("toast");
    if (!el) { console.info("[Sahaay] " + message); return; }
    el.textContent = message;
    el.hidden = false;
    el.classList.add("show");
    el.style.display = "block";
    if (toastTimer) { clearTimeout(toastTimer); }
    toastTimer = setTimeout(function () {
      el.classList.remove("show");
      el.hidden = true;
      el.style.display = "";
    }, TOAST_MS);
  }

  /* ------------------------------------------------------ query strings */

  function qs(name) {
    try {
      return new URLSearchParams(location.search).get(name);
    } catch (e) {
      var match = new RegExp("[?&]" + name + "=([^&]*)").exec(location.search);
      return match ? decodeURIComponent(match[1].replace(/\+/g, " ")) : null;
    }
  }

  /* -------------------------------------------------------------- auth */

  function requireAuth() {
    if (!window.API) { warn("API is not loaded; cannot check the sign-in"); return Promise.resolve(null); }
    return window.API.me().then(function (user) {
      if (user) { return user; }
      var next = encodeURIComponent(location.pathname.split("/").pop() || "profile.html");
      location.href = "login.html?next=" + next;
      return null;
    }, function (err) {
      /* Server unreachable: say so, stay put. Do not bounce to a login page
       * that will not work either. */
      warn("sign-in check failed: " + err.message);
      toast(t("err.network"));
      return null;
    });
  }

  /* --------------------------------------------------------------- nav */

  function navLink(href, key, current) {
    var link = node("a", { href: href, key: key, text: t(key), className: "nav-link" });
    if (current === href) { link.setAttribute("aria-current", "page"); }
    return link;
  }

  function loginLink() {
    return node("a", {
      href: "login.html", key: "nav.login", text: t("nav.login"),
      className: "nav-link nav-login"
    });
  }

  /* Mark the link for the page we are on. Only inside .nav-links, so the
   * brand -- which also points at index.html -- is not underlined as a nav
   * item on the home page. */
  function markCurrent(nav, here) {
    var scope = nav.querySelector(".nav-links") || nav;
    var links = scope.querySelectorAll("a[href]");
    for (var i = 0; i < links.length; i++) {
      var href = (links[i].getAttribute("href") || "").toLowerCase();
      if (href === here) {
        links[i].setAttribute("aria-current", "page");
        links[i].classList.add("active");
      } else {
        links[i].removeAttribute("aria-current");
        links[i].classList.remove("active");
      }
    }
  }

  /* Where the Login link, or the signed-in name, lives. The pages ship a
   * plain <a href="login.html"> inside the header; wrap it once so there is
   * a container to swap when a user is signed in. */
  function accountSlot(nav) {
    var slot = nav.querySelector(".nav-account");
    if (slot) { return slot; }
    var login = nav.querySelector('a[href="login.html"]');
    if (!login || !login.parentNode) { return null; }
    slot = node("span", { className: "nav-account" });
    login.parentNode.insertBefore(slot, login);
    slot.appendChild(login);
    return slot;
  }

  /* Fills <nav id="site-nav"> -- contract §3.
   *
   * It used to clear the node and rebuild it. That deleted the brand, the
   * ministry line and #lang-toggle, whose click listener init() attaches
   * moments earlier, so the language button vanished on every page load.
   * The pages already carry that markup, so only the two things that depend
   * on state are touched here: which link is current, and the account slot.
   * The full build is kept for a page that ships an empty <nav>. */
  function renderNav() {
    var nav = byId("site-nav");
    if (!nav) { return Promise.resolve(null); }
    var here = (location.pathname.split("/").pop() || "index.html").toLowerCase();
    var account;

    if (!nav.children.length) {
      var links = node("div", { className: "nav-links" }, [
        navLink("index.html", "nav.home", here),
        navLink("schemes.html", "nav.schemes", here),
        navLink("wizard.html", "nav.wizard", here),
        navLink("assistant.html", "nav.assistant", here),
        navLink("profile.html", "nav.profile", here)
      ]);
      account = node("div", { className: "nav-account" }, [loginLink()]);
      fill(nav, [links, account]);
    } else {
      markCurrent(nav, here);
      account = accountSlot(nav);
    }

    if (!account) { return Promise.resolve(null); }
    if (!window.API) { return Promise.resolve(null); }
    return window.API.me().then(function (user) {
      if (!user) {
        /* Signed out, or the token stopped being accepted. Put the Login
         * link back if a previous render replaced it with a name. */
        if (!account.querySelector(".nav-login")) { fill(account, [loginLink()]); }
        return null;
      }
      var name = user.display_name || user.username;
      fill(account, [
        node("span", { className: "nav-user", text: t("nav.signedInAs", { name: name }) }),
        node("button", {
          className: "nav-link nav-logout",
          type: "button",
          key: "nav.logout",
          text: t("nav.logout"),
          onClick: function () {
            window.API.logout().then(function () { location.href = "index.html"; });
          }
        })
      ]);
      return user;
    }, function (err) {
      warn("nav could not read the signed-in user: " + err.message);
      return null;
    });
  }

  /* -------------------------------------------------------------- init */

  function init() {
    loadLang();
    applyLang(document);
    var toggle = byId("lang-toggle");
    if (toggle) {
      toggle.addEventListener("click", function () {
        setLang(lang === "hi" ? "en" : "hi");
        toast(t("lang.switched"));
      });
    }
    renderNav();
  }

  window.App = {
    /* contract §3 */
    t: t,
    setLang: setLang,
    getLang: getLang,
    requireAuth: requireAuth,
    renderNav: renderNav,
    money: money,
    toast: toast,
    qs: qs,
    /* internal helpers, shared with pages.js only */
    init: init,
    byId: byId,
    node: node,
    clear: clear,
    fill: fill,
    applyLang: applyLang,
    percent: percent,
    warn: warn,
    LANG_EVENT: LANG_EVENT
  };
})();
