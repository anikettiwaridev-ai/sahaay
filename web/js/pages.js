/* Sahaay - one init function per page, and a router at the bottom.
 * Contract: 00-CONTRACTS.md §6 (every id used here is from that table) and
 * §8 (no sentence lives in this file; every one comes from App.t).
 *
 * Every element lookup goes through App.byId, which warns and returns null
 * when Track B has not written that element yet. Each call site checks for
 * null and skips its own section, so a half-built page still loads.
 */
(function () {
  "use strict";

  if (!window.App || !window.API) {
    console.warn("[Sahaay] app.js or api.js did not load; page logic is skipped");
    return;
  }

  var A = window.App;
  var API = window.API;
  var SESSION_PROFILE_KEY = "sahaay_profile";   // shared with the wizard and the assistant
  var WIZARD_STEPS = 6;

  /* ------------------------------------------------------------ small bits */

  function lang() { return A.getLang(); }

  /* Pick the field of an object that is written per language: name_hi/name_en. */
  function tx(obj, base) {
    if (!obj) { return ""; }
    var suffix = lang() === "hi" ? "_hi" : "_en";
    return obj[base + suffix] || obj[base + "_en"] || obj[base + "_hi"] || obj[base] || "";
  }

  function schemeName(obj) { return tx(obj, "name"); }

  /* Track A may hand a list as strings, as {hi,en} objects, or as {hi:[],en:[]}.
   * Accept all three rather than guessing one. */
  function listFor(value) {
    if (!value) { return []; }
    if (!Array.isArray(value)) {
      if (Array.isArray(value.hi) || Array.isArray(value.en)) {
        return (lang() === "hi" ? value.hi : value.en) || value.en || value.hi || [];
      }
      return [];
    }
    return value.map(function (item) {
      if (typeof item === "string") { return item; }
      if (!item) { return ""; }
      return tx(item, "text") || (lang() === "hi" ? item.hi : item.en) || item.en || item.hi || "";
    }).filter(Boolean);
  }

  function errorText(err) {
    if (!err) { return A.t("err.unknown"); }
    if (err.status === 0) { return A.t("err.network"); }
    if (err.status === 401 || err.status === 403) { return A.t("err.auth"); }
    if (err.status === 404) { return A.t("err.notfound"); }
    return A.t("err.server");
  }

  function needsConfirmation(err) {
    var payload = err && err.payload;
    if (!payload) { return null; }
    var list = payload.needs_confirmation || (payload.detail && payload.detail.needs_confirmation);
    return (list && list.length) ? list : null;
  }

  function readSessionProfile() {
    try {
      var raw = sessionStorage.getItem(SESSION_PROFILE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { A.warn("session profile could not be read: " + e.message); return null; }
  }

  function writeSessionProfile(profile) {
    try { sessionStorage.setItem(SESSION_PROFILE_KEY, JSON.stringify(profile || {})); }
    catch (e) { A.warn("session profile could not be stored: " + e.message); }
  }

  /* Signed in: the saved profile. Not signed in: whatever the wizard left. */
  function loadWorkingProfile() {
    return API.me().then(function (user) {
      if (!user) { return readSessionProfile(); }
      return API.getProfile().then(function (profile) {
        if (profile && Object.keys(profile).length) { return profile; }
        return readSessionProfile();
      });
    }, function (err) {
      A.warn("could not check the sign-in: " + err.message);
      return readSessionProfile();
    });
  }

  /* An optional hook: an element Track B may or may not have marked up. There
   * is no id for these in contracts §6 (see the report at the end of Track C),
   * so they are found by attribute and skipped, loudly, when absent. */
  function hook(selector) {
    var el = document.querySelector(selector);
    if (!el) { A.warn("optional hook " + selector + " is not on this page - skipping it"); }
    return el;
  }

  function setSelectOptions(select, values, keyPrefix, allKey) {
    if (!select || select.options.length > 0) { return; }
    if (allKey) { select.appendChild(A.node("option", { attrs: { value: "all" }, key: allKey, text: A.t(allKey) })); }
    values.forEach(function (value) {
      select.appendChild(A.node("option", {
        attrs: { value: value }, key: keyPrefix + value, text: A.t(keyPrefix + value)
      }));
    });
  }

  function onLangChange(fn) {
    document.addEventListener(A.LANG_EVENT, function () {
      try { fn(); } catch (e) { A.warn("re-render after a language change failed: " + e.message); }
    });
  }

  /* ------------------------------------------------- shared result renders */

  function pill(text, className) {
    return A.node("span", { className: "pill " + (className || ""), text: text });
  }

  function row(labelText, valueText) {
    return A.node("div", { className: "kv" }, [
      A.node("span", { className: "kv-label", text: labelText }),
      A.node("span", { className: "kv-value", text: valueText })
    ]);
  }

  function frequencyText(freq) {
    var key = "match.freq." + (freq || "quarterly");
    return A.t(key);
  }

  function renderTopCard(rec, profile) {
    var cost = rec.cost || null;
    var children = [
      A.node("h2", { className: "match-top-title", text: A.t("match.topTitle", { scheme: schemeName(rec.scheme) }) }),
      A.node("p", { className: "match-top-rate", text: A.t("match.rateLine", { rate: A.percent(cost ? cost.rate_annual : null) }) })
    ];
    if (cost) {
      children.push(A.node("p", {
        className: "match-top-loan",
        text: A.t("match.loanLine", {
          loan: A.money(cost.loan),
          project: A.money(profile && profile.amount_inr),
          own: A.money(cost.own)
        })
      }));
    }
    (rec.reasons || []).slice(0, 3).forEach(function (reason) {
      children.push(A.node("p", { className: "match-reason", text: reason }));
    });
    return A.node("div", { className: "card match-top-card" }, children);
  }

  function renderCostTable(cost) {
    if (!cost) { return A.node("p", { className: "muted", text: A.t("common.na") }); }
    return A.node("div", { className: "card cost-card" }, [
      A.node("h3", { text: A.t("match.costTitle") }),
      row(A.t("match.costRate"), A.percent(cost.rate_annual)),
      row(A.t("match.costInstalment"), A.money(cost.instalment) + " " + frequencyText(cost.frequency)),
      row(A.t("match.costCount"), String(cost.n_instalments)),
      row(A.t("match.costMoratorium"), A.t("common.months", { n: cost.moratorium_months })),
      row(A.t("match.costTotalInterest"), A.money(cost.total_interest)),
      row(A.t("match.costTotalRepayment"), A.money(cost.total_repayment))
    ]);
  }

  function renderNearMiss(miss, catalogueName) {
    return A.node("div", { className: "card nearmiss-card" }, [
      A.node("h3", { text: A.t("match.nearmissNotYet", { scheme: catalogueName || miss.scheme_id }) }),
      A.node("p", { text: tx(miss, "reason_text") }),
      A.node("p", { className: "nearmiss-unblock", text: tx(miss, "unblock_text") })
    ]);
  }

  function renderDoorRow(route) {
    var partner = route.partner || {};
    var bits = [
      A.node("h3", { className: "door-name", text: tx(partner, "name") || partner.name || "" }),
      A.node("p", { className: "door-type", text: A.t("ptype." + (partner.type || "OTHER")) }),
      A.node("p", {
        className: "door-distance",
        text: (route.distance_km === null || route.distance_km === undefined)
          ? A.t("match.doorDistanceUnknown")
          : A.t("match.doorDistance", { km: Math.round(route.distance_km * 10) / 10 })
      }),
      A.node("p", { className: "door-rate", text: A.t("match.doorRate", { rate: A.percent(route.rate) }) })
    ];
    if (route.band) {
      bits.push(pill(A.t("band." + route.band), "band-" + route.band));
      bits.push(A.node("p", { className: "door-source muted", text: A.t("band.source") }));
    }
    (route.warnings || []).forEach(function (w) {
      bits.push(A.node("p", { className: "door-warning", text: tx(w, "text") }));
    });
    return A.node("div", { className: "card door-card" }, bits);
  }

  function renderWrongDoor(result) {
    if (!result || result.wrong_door_cost === null || result.wrong_door_cost === undefined) { return null; }
    var best = result.best_door || {};
    var worst = result.worst_door || {};
    return A.node("div", { className: "wrongdoor" }, [
      A.node("h2", { className: "wrongdoor-figure", text: A.t("match.wrongdoorTitle", { amount: A.money(result.wrong_door_cost) }) }),
      A.node("p", {
        text: A.t("match.wrongdoorBody", {
          bestRate: A.percent(best.rate),
          bestName: best.partner_name || "",
          worstRate: A.percent(worst.rate),
          worstName: worst.partner_name || ""
        })
      })
    ]);
  }

  function renderWhy(rules, nameOf) {
    var items = (rules || []).map(function (rule) {
      var line = A.t("match.whyLine", {
        scheme: nameOf(rule.scheme_id),
        rule: A.t("rule." + rule.rule_id),
        result: A.t("rule." + rule.result)
      });
      var detail = [];
      if (rule.value_seen) { detail.push(A.t("match.whySaw", { value: rule.value_seen })); }
      if (rule.threshold) { detail.push(A.t("match.whyNeeds", { threshold: rule.threshold })); }
      return A.node("li", {}, [
        A.node("span", { text: line }),
        detail.length ? A.node("span", { className: "muted", text: " — " + detail.join(" · ") }) : null
      ]);
    });
    return A.node("ul", { className: "why-list" }, items);
  }

  /* ================================================================= HOME */

  function initHome() {
    /* The home page is static copy plus the shared header. Nothing to fetch:
     * the four numbers are published figures and live in the HTML. */
    return Promise.resolve(null);
  }

  /* ================================================================ LOGIN */

  function initLogin() {
    var form = A.byId("login-form");
    var username = A.byId("login-username");
    var password = A.byId("login-password");
    var errorBox = A.byId("login-error");
    var submit = A.byId("login-submit");
    if (!form || !username || !password) { return Promise.resolve(null); }

    function showError(text) {
      if (!errorBox) { A.toast(text); return; }
      errorBox.textContent = text;
      errorBox.hidden = false;
      errorBox.style.display = "block";
    }

    function clearError() {
      if (!errorBox) { return; }
      errorBox.textContent = "";
      errorBox.hidden = true;
      errorBox.style.display = "";
    }

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      clearError();
      if (submit) { submit.disabled = true; submit.textContent = A.t("login.submitting"); }
      API.login(username.value.trim(), password.value).then(function (data) {
        var name = (data && data.user && (data.user.display_name || data.user.username)) || "";
        A.toast(A.t("login.welcome", { name: name }));
        location.href = A.qs("next") || "profile.html";
      }, function (err) {
        showError(err.status === 401 ? A.t("login.errorInvalid")
          : err.status === 0 ? A.t("login.errorNetwork") : errorText(err));
        if (submit) { submit.disabled = false; submit.textContent = A.t("login.submit"); }
      });
    });
    return Promise.resolve(null);
  }

  /* ============================================================== PROFILE */

  /* The eleven fields the completeness line counts. The checkboxes are not
   * counted - an unticked box is an answer, not a gap. */
  var PROFILE_COUNTED = [
    "pf-name", "pf-age", "pf-category", "pf-state", "pf-district",
    "pf-email", "pf-mobile", "pf-purpose", "pf-sector", "pf-amount", "pf-income"
  ];

  function initProfile() {
    var form = A.byId("profile-form");
    var loaded = {};

    var fields = {
      name: A.byId("pf-name"),
      email: A.byId("pf-email"),
      mobile: A.byId("pf-mobile"),
      state: A.byId("pf-state"),
      district: A.byId("pf-district"),
      income: A.byId("pf-income"),
      amount: A.byId("pf-amount"),
      age: A.byId("pf-age"),
      category: A.byId("pf-category"),
      education: A.byId("pf-education"),
      sector: A.byId("pf-sector"),
      purpose: A.byId("pf-purpose"),
      isWoman: A.byId("pf-is-woman"),
      casteCert: A.byId("pf-caste-cert"),
      incomeCert: A.byId("pf-income-cert"),
      photo: A.byId("pf-photo"),
      preview: A.byId("pf-photo-preview"),
      save: A.byId("pf-save"),
      status: A.byId("pf-status")
    };

    setSelectOptions(fields.category, ["sc", "st", "obc", "general"], "category.", null);
    setSelectOptions(fields.purpose, ["enterprise", "education"], "purpose.", null);
    setSelectOptions(fields.sector,
      ["tailoring", "shop", "transport", "agri_allied", "services", "manufacturing", "plantation", "construction", "other"],
      "sector.", null);
    setSelectOptions(fields.education,
      ["illiterate", "primary", "middle", "matric", "higher_secondary", "graduate"],
      "education.", null);

    function setValue(el, value) {
      if (!el) { return; }
      if (el.type === "checkbox") { el.checked = !!value; return; }
      el.value = (value === null || value === undefined) ? "" : String(value);
    }

    function updateCompleteness() {
      var done = PROFILE_COUNTED.filter(function (id) {
        var el = document.getElementById(id);
        return el && String(el.value || "").trim() !== "";
      }).length;
      var target = hook("[data-profile-complete]");
      if (target) {
        target.textContent = A.t("profile.completeness", { done: done, total: PROFILE_COUNTED.length });
      }
    }

    function paint(profile) {
      loaded = profile || {};
      setValue(fields.name, loaded.name);
      setValue(fields.email, loaded.email);
      setValue(fields.mobile, loaded.mobile);
      setValue(fields.state, loaded.state);
      setValue(fields.district, loaded.district);
      setValue(fields.income, loaded.annual_family_income_inr);
      setValue(fields.amount, loaded.amount_inr);
      setValue(fields.age, loaded.age);
      setValue(fields.education, loaded.education);
      setValue(fields.sector, loaded.sector);
      setValue(fields.purpose, loaded.purpose);
      setValue(fields.isWoman, loaded.is_woman);
      setValue(fields.casteCert, loaded.has_caste_certificate);
      setValue(fields.incomeCert, loaded.has_income_certificate);
      /* The Profile carries is_sc, not a category name, so a saved profile can
       * only restore the "sc" choice. Contract §4. */
      if (fields.category && loaded.is_sc) { fields.category.value = "sc"; }
      if (fields.preview && loaded.photo_url) { fields.preview.setAttribute("src", loaded.photo_url); }
      updateCompleteness();
    }

    function collect() {
      var out = {};
      Object.keys(loaded).forEach(function (k) { out[k] = loaded[k]; });
      out.lang = lang();
      if (fields.name) { out.name = fields.name.value.trim(); }
      if (fields.email) { out.email = fields.email.value.trim(); }
      if (fields.mobile) { out.mobile = fields.mobile.value.trim(); }
      if (fields.state) { out.state = fields.state.value.trim(); }
      if (fields.district) { out.district = fields.district.value.trim(); }
      if (fields.income) { out.annual_family_income_inr = fields.income.value ? Number(fields.income.value) : null; }
      if (fields.amount) { out.amount_inr = fields.amount.value ? Number(fields.amount.value) : null; }
      if (fields.age) { out.age = fields.age.value ? Number(fields.age.value) : null; }
      if (fields.education) { out.education = fields.education.value || null; }
      if (fields.sector) { out.sector = fields.sector.value || null; }
      if (fields.purpose) { out.purpose = fields.purpose.value || null; }
      if (fields.isWoman) { out.is_woman = !!fields.isWoman.checked; }
      if (fields.casteCert) { out.has_caste_certificate = !!fields.casteCert.checked; }
      if (fields.incomeCert) { out.has_income_certificate = !!fields.incomeCert.checked; }
      if (fields.category) { out.is_sc = fields.category.value === "sc"; }
      return out;
    }

    function showSaved() {
      if (!fields.status) { A.toast(A.t("profile.saved")); return; }
      A.fill(fields.status, [
        A.node("span", { text: A.t("profile.saved") }),
        A.node("a", { href: "match.html", className: "btn btn-link", text: A.t("profile.seeMatches") })
      ]);
      fields.status.hidden = false;
      fields.status.style.display = "block";
    }

    function loadNotificationPreview() {
      var target = hook("[data-notify-preview]");
      if (!target) { return; }
      API.notificationPreview().then(function (preview) {
        A.fill(target, [
          A.node("p", { className: "bubble", text: (preview && preview.message) || "" }),
          A.node("p", {
            className: "muted",
            text: A.t("profile.notifyTo", { channel: (preview && preview.channel) || "", to: (preview && preview.to) || "" })
          })
        ]);
      }, function (err) {
        A.warn("notification preview failed: " + err.message);
        A.fill(target, [A.node("p", { className: "muted", text: A.t("profile.notifyUnavailable") })]);
      });
    }

    PROFILE_COUNTED.forEach(function (id) {
      var el = document.getElementById(id);
      if (el) { el.addEventListener("input", updateCompleteness); }
    });

    if (fields.photo) {
      fields.photo.addEventListener("change", function () {
        var file = fields.photo.files && fields.photo.files[0];
        if (!file) { return; }
        A.toast(A.t("profile.photoUploading"));
        API.uploadPhoto(file).then(function (data) {
          loaded.photo_url = data && data.photo_url;
          if (fields.preview && loaded.photo_url) { fields.preview.setAttribute("src", loaded.photo_url); }
        }, function (err) {
          A.warn("photo upload failed: " + err.message);
          A.toast(A.t("profile.photoError"));
        });
      });
    }

    if (form) {
      form.addEventListener("submit", function (event) {
        event.preventDefault();
        var profile = collect();
        if (fields.save) { fields.save.disabled = true; fields.save.textContent = A.t("common.saving"); }
        API.saveProfile(profile).then(function (data) {
          loaded = (data && data.profile) ? data.profile : profile;
          writeSessionProfile(loaded);
          showSaved();
        }, function (err) {
          A.warn("profile save failed: " + err.message);
          A.toast(A.t("profile.saveError"));
        }).then(function () {
          if (fields.save) { fields.save.disabled = false; fields.save.textContent = A.t("common.save"); }
        });
      });
    }

    onLangChange(function () { updateCompleteness(); });

    return A.requireAuth().then(function (user) {
      if (!user) { return null; }
      loadNotificationPreview();
      return API.getProfile().then(paint, function (err) {
        A.warn("profile load failed: " + err.message);
        A.toast(A.t("profile.loadError"));
      });
    });
  }

  /* ============================================================== SCHEMES */

  var CATEGORIES = ["loan", "education", "subsidy", "training", "marketing"];
  var STATUS_ORDER = { open: 0, informational: 1, closed: 2 };

  function schemeCard(entry) {
    var closed = entry.status === "closed";
    var card = A.node("article", { className: "card scheme-card" + (closed ? " is-closed" : "") }, [
      A.node("div", { className: "scheme-card-head" }, [
        pill(A.t("cat." + entry.category), "pill-" + entry.category),
        A.node("span", { className: "status status-" + entry.status, text: A.t("status." + entry.status) })
      ]),
      A.node("h3", { className: "scheme-card-title", text: lang() === "hi" ? entry.name_hi : entry.name_en }),
      A.node("p", { className: "scheme-card-alt", text: lang() === "hi" ? entry.name_en : entry.name_hi }),
      A.node("p", { className: "scheme-card-line", text: tx(entry, "one_line") }),
      A.node("p", { className: "scheme-card-facts", text: [
        entry.rate_text || "",
        entry.max_amount_inr ? A.t("schemes.max", { amount: A.money(entry.max_amount_inr) }) : ""
      ].filter(Boolean).join("  ·  ") }),
      A.node("a", {
        className: "btn btn-view",
        href: "scheme.html?id=" + encodeURIComponent(entry.id),
        text: A.t("common.view")
      })
    ]);
    if (closed) {
      card.insertBefore(A.node("p", { className: "closed-note", text: A.t("schemes.closedNote") }), card.lastChild);
    }
    return card;
  }

  function initSchemes() {
    var grid = A.byId("scheme-grid");
    var categorySel = A.byId("filter-category");
    var statusSel = A.byId("filter-status");
    var search = A.byId("filter-search");
    var count = A.byId("scheme-count");
    var all = [];
    var loadFailed = false;

    setSelectOptions(categorySel, CATEGORIES, "cat.", "schemes.filterAll");
    setSelectOptions(statusSel, ["open", "closed"], "status.", "schemes.filterAll");

    function matches(entry) {
      var wantCategory = categorySel ? categorySel.value : "all";
      var wantStatus = statusSel ? statusSel.value : "all";
      var query = (search ? search.value : "").trim().toLowerCase();
      if (wantCategory && wantCategory !== "all" && entry.category !== wantCategory) { return false; }
      if (wantStatus && wantStatus !== "all" && entry.status !== wantStatus) { return false; }
      if (!query) { return true; }
      var haystack = [entry.id, entry.name_en, entry.name_hi, entry.one_line_en, entry.one_line_hi]
        .filter(Boolean).join(" ").toLowerCase();
      return haystack.indexOf(query) !== -1;
    }

    function render() {
      if (!grid) { return; }
      if (loadFailed) {
        /* Keep saying why the list is empty, in whichever language is current. */
        A.fill(grid, [A.node("p", { className: "error", text: A.t("schemes.loadError") })]);
        if (count) { count.textContent = A.t("schemes.count", { shown: 0, total: 0 }); }
        return;
      }
      var shown = all.filter(matches).sort(function (a, b) {
        var d = (STATUS_ORDER[a.status] || 0) - (STATUS_ORDER[b.status] || 0);
        return d !== 0 ? d : String(a.name_en).localeCompare(String(b.name_en));
      });
      A.fill(grid, shown.length
        ? shown.map(schemeCard)
        : [A.node("p", { className: "muted", text: A.t("schemes.empty") })]);
      if (count) { count.textContent = A.t("schemes.count", { shown: shown.length, total: all.length }); }
    }

    [categorySel, statusSel].forEach(function (el) { if (el) { el.addEventListener("change", render); } });
    if (search) { search.addEventListener("input", render); }
    onLangChange(render);

    return API.getCatalogue().then(function (entries) {
      all = entries || [];
      loadFailed = false;
      render();
    }, function (err) {
      A.warn("catalogue load failed: " + err.message);
      loadFailed = true;
      render();
      A.toast(errorText(err));
    });
  }

  /* ========================================================== ONE SCHEME */

  function initScheme() {
    var id = A.qs("id");
    var title = A.byId("sc-title");
    var category = A.byId("sc-category");
    var rate = A.byId("sc-rate");
    var max = A.byId("sc-max");
    var summary = A.byId("sc-summary");
    var eligibility = A.byId("sc-eligibility");
    var documents = A.byId("sc-documents");
    var howto = A.byId("sc-howto");
    var status = A.byId("sc-status");
    var tenure = A.byId("sc-tenure");
    var moratorium = A.byId("sc-moratorium");
    var checkBtn = A.byId("sc-check-btn");
    var checkResult = A.byId("sc-check-result");
    var entry = null;

    function fillList(target, values) {
      if (!target) { return; }
      var items = listFor(values);
      A.fill(target, items.map(function (text) { return A.node("li", { text: text }); }));
    }

    function paint() {
      if (!entry) { return; }
      if (title) { title.textContent = schemeName(entry); }
      if (category) {
        category.textContent = A.t("cat." + entry.category);
        /* The placeholder ships the loan colour; every category has its own. */
        category.className = "cat-pill cat-" + entry.category;
      }
      if (status) {
        status.textContent = A.t("status." + entry.status);
        status.className = "status status-" + entry.status;
      }
      if (rate) { rate.textContent = entry.rate_text || A.t("common.na"); }
      if (max) { max.textContent = entry.max_amount_inr ? A.money(entry.max_amount_inr) : A.t("common.na"); }
      /* Null for the nine entries with no published terms; print a dash
       * rather than leaving the placeholder's figure on screen. */
      if (tenure) { tenure.textContent = tx(entry, "tenure_text") || A.t("common.na"); }
      if (moratorium) { moratorium.textContent = tx(entry, "moratorium_text") || A.t("common.na"); }
      if (summary) { summary.textContent = tx(entry, "one_line"); }
      /* GET /catalogue/{id} resolves eligibility_text / documents /
       * how_to_apply against its own ?lang, which defaults to English, and
       * also returns both languages under _en / _hi suffixes. Read the
       * suffixed pair so switching language re-paints without a refetch. */
      fillList(eligibility, tx(entry, "eligibility_text"));
      fillList(documents, tx(entry, "documents"));
      fillList(howto, tx(entry, "how_to_apply"));
    }

    function showCheck(nodes, className) {
      if (!checkResult) { A.toast(A.t("scheme.checkError")); return; }
      checkResult.className = "check-result " + (className || "");
      A.fill(checkResult, nodes);
      checkResult.hidden = false;
      checkResult.style.display = "block";
    }

    function runCheck() {
      if (!entry) { return; }
      if (!entry.has_full_logic) {
        showCheck([A.node("p", { text: A.t("scheme.checkInfoOnly") })], "is-info");
        return;
      }
      showCheck([A.node("p", { text: A.t("scheme.checking") })], "is-info");
      loadWorkingProfile().then(function (profile) {
        if (!profile || !Object.keys(profile).length) {
          A.toast(A.t("scheme.checkNeedProfile"));
          location.href = "wizard.html";
          return;
        }
        return API.recommend(profile).then(function (result) {
          var rec = (result.recommendations || []).filter(function (r) {
            return r.scheme && r.scheme.id === entry.id && r.verdict !== "ineligible";
          })[0];
          if (rec) {
            var cost = rec.cost;
            showCheck([
              A.node("p", { className: "yes", text: A.t("scheme.checkYes", { scheme: schemeName(rec.scheme) }) }),
              cost ? A.node("p", {
                text: A.t("scheme.checkYesCost", {
                  rate: A.percent(cost.rate_annual),
                  loan: A.money(cost.loan),
                  instalment: A.money(cost.instalment),
                  count: cost.n_instalments
                })
              }) : null,
              A.node("a", { className: "btn", href: "match.html", text: A.t("profile.seeMatches") })
            ], "is-yes");
            return;
          }
          var miss = (result.near_misses || []).filter(function (m) { return m.scheme_id === entry.id; })[0];
          if (miss) {
            showCheck([
              A.node("p", { className: "no", text: A.t("scheme.checkNo", { reason: tx(miss, "reason_text") }) }),
              A.node("p", { text: A.t("scheme.checkNoUnblock", { unblock: tx(miss, "unblock_text") }) })
            ], "is-nearmiss");
            return;
          }
          showCheck([A.node("p", { text: A.t("scheme.checkIneligible") })], "is-no");
        });
      }).catch(function (err) {
        if (err.status === 422 && needsConfirmation(err)) {
          A.toast(A.t("scheme.checkNeedProfile"));
          location.href = "wizard.html";
          return;
        }
        A.warn("eligibility check failed: " + err.message);
        showCheck([A.node("p", { text: A.t("scheme.checkError") }), A.node("p", { className: "muted", text: errorText(err) })], "is-error");
      });
    }

    if (checkBtn) { checkBtn.addEventListener("click", runCheck); }
    onLangChange(paint);

    if (!id) {
      A.warn("scheme.html was opened without ?id=");
      if (summary) { summary.textContent = A.t("scheme.notFound"); }
      return Promise.resolve(null);
    }
    return API.getScheme(id).then(function (data) {
      entry = data;
      paint();
    }, function (err) {
      A.warn("scheme load failed: " + err.message);
      if (summary) { summary.textContent = A.t("scheme.loadError"); }
      A.toast(errorText(err));
    });
  }

  /* ================================================================ MATCH */

  function initMatch() {
    var top = A.byId("match-top");
    var others = A.byId("match-others");
    var nearmiss = A.byId("match-nearmiss");
    var costBox = A.byId("match-cost");
    var door = A.byId("match-door");
    var wrongdoor = A.byId("match-wrongdoor");
    var why = A.byId("match-why");
    var state = { profile: null, result: null };
    var catalogueNames = {};

    /* A near miss names a scheme the recommendations do not contain -- that is
     * what makes it a near miss -- so the ranked list alone cannot translate
     * its id. Without the catalogue as a second source the card read
     * "TL - not yet" to someone the page exists to serve. */
    function nameOf(schemeId) {
      var recs = (state.result && state.result.recommendations) || [];
      for (var i = 0; i < recs.length; i++) {
        if (recs[i].scheme && recs[i].scheme.id === schemeId) { return schemeName(recs[i].scheme); }
      }
      var entry = catalogueNames[schemeId];
      return entry ? schemeName(entry) : schemeId;
    }

    function paint() {
      var result = state.result;
      if (!result) { return; }
      var recs = result.recommendations || [];
      var best = recs[0] || null;

      if (top) {
        A.fill(top, best
          ? [renderTopCard(best, state.profile)]
          : [A.node("p", { className: "muted", text: A.t("match.none") })]);
      }
      if (costBox) { A.fill(costBox, [renderCostTable(best && best.cost)]); }
      if (others) {
        A.fill(others, recs.slice(1, 3).map(function (rec) {
          return A.node("div", { className: "card match-other" }, [
            A.node("h3", { text: schemeName(rec.scheme) }),
            /* Not match.rateLine: only the top card is "the lowest rate you
             * qualify for". Saying that on all three would be false. */
            A.node("p", { text: A.t("match.otherRateLine", { rate: A.percent(rec.cost ? rec.cost.rate_annual : null) }) })
          ]);
        }));
        if (recs.length > 1) { others.insertBefore(A.node("h2", { text: A.t("match.othersTitle") }), others.firstChild); }
      }
      if (nearmiss) {
        var misses = result.near_misses || [];
        A.fill(nearmiss, misses.length
          ? [A.node("h2", { text: A.t("match.nearmissTitle") })].concat(misses.map(function (m) {
            return renderNearMiss(m, nameOf(m.scheme_id));
          }))
          : []);
      }
      if (door) {
        var routes = (best && best.routes) || [];
        A.fill(door, [A.node("h2", { text: A.t("match.doorTitle") })].concat(
          routes.length ? routes.map(renderDoorRow) : [A.node("p", { className: "muted", text: A.t("match.doorNone") })]
        ));
      }
      if (wrongdoor) {
        var block = renderWrongDoor(result);
        A.fill(wrongdoor, block ? [block] : []);
      }
      if (why) {
        A.fill(why, [
          A.node("summary", { text: A.t("match.whyTitle") }),
          renderWhy(result.rules_fired, nameOf)
        ]);
      }
      wirePrint(best);
    }

    function wirePrint(best) {
      var btn = hook("[data-action=\"print-packet\"]");
      if (!btn || btn.dataset.wired === "1") { return; }
      btn.dataset.wired = "1";
      btn.addEventListener("click", function () {
        if (!best || !state.profile) { A.toast(A.t("match.packetError")); return; }
        var route = (best.routes || [])[0];
        A.toast(A.t("match.packetOpening"));
        API.packet(state.profile, best.scheme.id, route ? route.partner.id : null, state.profile.amount_inr)
          .then(function (packet) {
            if (packet && packet.packet_pdf_url) { window.open(packet.packet_pdf_url, "_blank"); }
            else { window.print(); }
          }, function (err) {
            /* POST /packet is listed in contract §2 as already built, but it
             * is not in backend/main.py and returns 404/405. Printing the page
             * itself is a real packet -- the match, the cost, the office and
             * the checklist are all on it, and print.css strips the chrome --
             * so fall back to that rather than ending the demo on an error.
             * If /packet is built later this branch simply stops being used. */
            A.warn("packet endpoint unavailable (" + err.message + "); printing the page instead");
            window.print();
          });
      });
    }

    onLangChange(paint);

    /* Names for the near-miss cards. Failing this must not stop the page:
     * without it a card falls back to the scheme id, which is ugly but not
     * wrong, and everything else on the page still renders. */
    API.getCatalogue().then(function (entries) {
      (entries || []).forEach(function (entry) { catalogueNames[entry.id] = entry; });
      paint();
    }, function (err) {
      A.warn("scheme names for the near-miss cards are unavailable: " + err.message);
    });

    if (top) { A.fill(top, [A.node("p", { className: "muted", text: A.t("match.loading") })]); }
    return loadWorkingProfile().then(function (profile) {
      if (!profile || !Object.keys(profile).length) {
        if (top) {
          A.fill(top, [
            A.node("p", { text: A.t("match.needProfile") }),
            A.node("a", { className: "btn", href: "wizard.html", text: A.t("nav.wizard") })
          ]);
        }
        return null;
      }
      state.profile = profile;
      return API.recommend(profile).then(function (result) {
        state.result = result;
        paint();
      });
    }).catch(function (err) {
      if (err.status === 422 && needsConfirmation(err)) {
        A.toast(A.t("match.needProfile"));
        location.href = "wizard.html";
        return;
      }
      A.warn("recommend failed: " + err.message);
      if (top) { A.fill(top, [A.node("p", { className: "error", text: A.t("match.error") }), A.node("p", { className: "muted", text: errorText(err) })]); }
    });
  }

  /* ============================================================ ASSISTANT */

  /* Hold-to-record, shared by the assistant panel and the wizard's first step.
   * Every failure the brief names - no permission, nothing recorded, server
   * unreachable - ends in a plain sentence and leaves typing available. */
  function makeRecorder(button, onStatus, onTranscript) {
    if (!button) { return null; }
    var recorder = null;
    var chunks = [];
    var startedAt = 0;

    function supported() {
      return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
    }

    function stop() {
      if (recorder && recorder.state === "recording") { recorder.stop(); }
    }

    function start() {
      if (!supported()) { onStatus(A.t("mic.unsupported")); return; }
      if (recorder && recorder.state === "recording") { return; }
      navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
        chunks = [];
        startedAt = Date.now();
        recorder = new MediaRecorder(stream);
        recorder.addEventListener("dataavailable", function (e) { if (e.data && e.data.size) { chunks.push(e.data); } });
        recorder.addEventListener("stop", function () {
          stream.getTracks().forEach(function (track) { track.stop(); });
          var blob = new Blob(chunks, { type: chunks.length && chunks[0].type ? chunks[0].type : "audio/webm" });
          if (Date.now() - startedAt < 700 || blob.size < 1200) { onStatus(A.t("mic.tooShort")); return; }
          onStatus(A.t("mic.processing"));
          API.transcribe(blob).then(function (data) {
            if (!data || data.speech_ok === false || !data.transcript) { onStatus(A.t("mic.tooShort")); return; }
            onStatus(A.t("mic.understood"));
            onTranscript(data.transcript, data.lang || lang());
          }, function (err) {
            A.warn("transcribe failed: " + err.message);
            onStatus(err.status === 0 ? A.t("err.network") : A.t("mic.error"));
          });
        });
        recorder.start();
        onStatus(A.t("mic.listening"));
      }, function (err) {
        A.warn("microphone refused: " + (err && err.message));
        onStatus(A.t("mic.denied"));
      });
    }

    ["mousedown", "touchstart"].forEach(function (type) {
      button.addEventListener(type, function (e) { e.preventDefault(); start(); });
    });
    ["mouseup", "mouseleave", "touchend", "touchcancel"].forEach(function (type) {
      button.addEventListener(type, function () { stop(); });
    });
    return { start: start, stop: stop };
  }

  function initAssistant() {
    var log = A.byId("chat-log");
    var form = A.byId("chat-form");
    var input = A.byId("chat-input");
    var send = A.byId("chat-send");
    var micBtn = A.byId("mic-btn");
    var micStatus = A.byId("mic-status");
    var transcript = A.byId("transcript-box");
    var names = {};

    function bubble(who, text, className) {
      if (!log) { A.toast(text); return null; }
      var el = A.node("div", { className: "msg " + (className || "") }, [
        A.node("span", { className: "msg-who", text: who }),
        A.node("p", { className: "msg-text", text: text })
      ]);
      log.appendChild(el);
      log.scrollTop = log.scrollHeight;
      return el;
    }

    function citationLine(ids) {
      var labels = (ids || []).map(function (id) { return names[id] || id; });
      if (!labels.length) { return null; }
      return A.node("p", { className: "citation", text: A.t("assistant.citation", { schemes: labels.join(", ") }) });
    }

    function ask(question) {
      if (!question) { A.toast(A.t("assistant.emptyQuestion")); return; }
      bubble(A.t("assistant.you"), question, "msg-user");
      if (input) { input.value = ""; }
      var pending = bubble(A.t("assistant.bot"), A.t("assistant.thinking"), "msg-bot is-pending");
      if (send) { send.disabled = true; }
      loadWorkingProfile().then(function (profile) {
        return API.ask(question, lang(), profile || null);
      }).then(function (data) {
        if (pending && log) { log.removeChild(pending); }
        var answer = bubble(A.t("assistant.bot"), (data && data.answer) || A.t("assistant.error"), "msg-bot");
        var cite = citationLine(data && data.cited_scheme_ids);
        if (answer && cite) { answer.appendChild(cite); }
      }, function (err) {
        A.warn("assistant.ask failed: " + err.message);
        if (pending && log) { log.removeChild(pending); }
        bubble(A.t("assistant.bot"), err.status === 0 ? A.t("err.network") : A.t("assistant.error"), "msg-bot is-error");
      }).then(function () {
        if (send) { send.disabled = false; }
      });
    }

    if (form && input) {
      form.addEventListener("submit", function (event) {
        event.preventDefault();
        ask(input.value.trim());
      });
    }

    /* The suggestion chips have no id in contracts §6; they are read by their
     * own text, so whatever Track B writes is what gets asked. */
    document.addEventListener("click", function (event) {
      var chip = event.target && event.target.closest ? event.target.closest(".chip, [data-chip]") : null;
      if (!chip) { return; }
      event.preventDefault();
      var question = (chip.getAttribute("data-chip") || chip.textContent || "").trim();
      if (input) { input.value = question; }
      ask(question);
    });

    function status(text) {
      if (micStatus) { micStatus.textContent = text; }
      else { A.toast(text); }
    }

    makeRecorder(micBtn, status, function (text) {
      if (transcript) { transcript.value = text; transcript.focus(); }
      else { A.toast(text); }
    });

    var useBtn = hook("[data-use-transcript]");
    if (useBtn) {
      useBtn.addEventListener("click", function () {
        var text = transcript ? transcript.value.trim() : "";
        if (!text) { A.toast(A.t("mic.transcriptEmpty")); return; }
        status(A.t("wizard.extracting"));
        API.extract(text, lang()).then(function (profile) {
          writeSessionProfile(profile);
          location.href = "match.html";
        }, function (err) {
          A.warn("extract failed: " + err.message);
          status(err.status === 0 ? A.t("err.network") : A.t("wizard.extractError"));
        });
      });
    }

    return API.getCatalogue().then(function (entries) {
      (entries || []).forEach(function (entry) { names[entry.id] = lang() === "hi" ? entry.name_hi : entry.name_en; });
    }, function (err) {
      A.warn("scheme names for citations are unavailable: " + err.message);
    });
  }

  /* =============================================================== WIZARD */

  function initWizard() {
    var stepBox = A.byId("wz-step");
    var next = A.byId("wz-next");
    var back = A.byId("wz-back");
    var progress = A.byId("wz-progress");
    var state = { step: 1, text: "", profile: readSessionProfile() || {}, result: null, pending: [] };

    if (!stepBox) { return Promise.resolve(null); }

    /* Same reason as initMatch: the near-miss card on step 3 names a scheme
     * the recommendations do not contain, so the ranked list cannot translate
     * its id and the card said "TL - not yet". */
    var catalogueNames = {};

    function nameOf(schemeId) {
      var recs = (state.result && state.result.recommendations) || [];
      for (var i = 0; i < recs.length; i++) {
        if (recs[i].scheme && recs[i].scheme.id === schemeId) { return schemeName(recs[i].scheme); }
      }
      var entry = catalogueNames[schemeId];
      return entry ? schemeName(entry) : schemeId;
    }

    function setProgress() {
      if (progress) { progress.textContent = A.t("wizard.progress", { n: state.step, total: WIZARD_STEPS }); }
      if (back) { back.disabled = state.step === 1; }
      if (next) { next.textContent = state.step === WIZARD_STEPS ? A.t("common.finish") : A.t("common.next"); }
    }

    function best() { return ((state.result && state.result.recommendations) || [])[0] || null; }

    /* ---- step 1: speak or type ---- */
    function stepSpeak() {
      var area = A.node("textarea", { className: "wz-text", attrs: { rows: "4", placeholder: A.t("wizard.textPlaceholder") } });
      area.value = state.text || state.profile.activity_text || "";
      area.addEventListener("input", function () { state.text = area.value; });
      var micBtn = A.node("button", { type: "button", className: "btn mic-big", text: A.t("mic.hold") });
      var micLine = A.node("p", { className: "muted", text: A.t("wizard.step1Help") });
      makeRecorder(micBtn, function (text) { micLine.textContent = text; }, function (text) {
        area.value = text;
        state.text = text;
      });
      return [
        A.node("h2", { text: A.t("wizard.step1Title") }),
        micBtn, micLine, area
      ];
    }

    /* ---- step 2: confirm every field ---- */
    var CONFIRM_FIELDS = [
      { key: "name", type: "text" },
      { key: "is_sc", type: "bool" },
      { key: "state", type: "text" },
      { key: "district", type: "text" },
      { key: "purpose", type: "choice", options: ["enterprise", "education"], prefix: "purpose." },
      { key: "sector", type: "choice", options: ["tailoring", "shop", "transport", "agri_allied", "services", "manufacturing", "plantation", "construction", "other"], prefix: "sector." },
      { key: "amount_inr", type: "number" },
      { key: "annual_family_income_inr", type: "number" },
      { key: "age", type: "number" },
      { key: "education", type: "choice", options: ["illiterate", "primary", "middle", "matric", "higher_secondary", "graduate"], prefix: "education." },
      { key: "has_caste_certificate", type: "bool" },
      { key: "has_income_certificate", type: "bool" }
    ];

    function confirmControl(field) {
      var value = state.profile[field.key];
      var control;
      if (field.type === "bool") {
        control = A.node("select", {});
        [["", "common.na"], ["yes", "common.yes"], ["no", "common.no"]].forEach(function (pair) {
          control.appendChild(A.node("option", { attrs: { value: pair[0] }, text: A.t(pair[1]) }));
        });
        control.value = (value === true) ? "yes" : (value === false ? "no" : "");
        control.addEventListener("change", function () {
          state.profile[field.key] = control.value === "" ? null : control.value === "yes";
        });
      } else if (field.type === "choice") {
        control = A.node("select", {});
        control.appendChild(A.node("option", { attrs: { value: "" }, text: A.t("common.na") }));
        field.options.forEach(function (option) {
          control.appendChild(A.node("option", { attrs: { value: option }, text: A.t(field.prefix + option) }));
        });
        control.value = value || "";
        control.addEventListener("change", function () { state.profile[field.key] = control.value || null; });
      } else {
        control = A.node("input", { type: field.type === "number" ? "number" : "text" });
        control.value = (value === null || value === undefined) ? "" : String(value);
        control.addEventListener("input", function () {
          if (field.type === "number") { state.profile[field.key] = control.value ? Number(control.value) : null; }
          else { state.profile[field.key] = control.value.trim() || null; }
        });
      }
      var needed = state.pending.indexOf(field.key) !== -1;
      return A.node("label", { className: "wz-chip" + (needed ? " is-needed" : "") }, [
        A.node("span", { className: "wz-chip-label", text: A.t("field." + field.key) }),
        control
      ]);
    }

    function stepConfirm() {
      return [
        A.node("h2", { text: A.t("wizard.step2Title") }),
        A.node("p", { className: "muted", text: A.t("wizard.step2Help") }),
        A.node("div", { className: "wz-chips" }, CONFIRM_FIELDS.map(confirmControl))
      ];
    }

    function stepMatch() {
      var rec = best();
      if (!rec) { return [A.node("p", { className: "muted", text: A.t("match.none") })]; }
      var misses = (state.result.near_misses || []).map(function (m) { return renderNearMiss(m, nameOf(m.scheme_id)); });
      return [A.node("h2", { text: A.t("wizard.step3Title") }), renderTopCard(rec, state.profile)].concat(misses);
    }

    function stepCost() {
      var rec = best();
      return [A.node("h2", { text: A.t("wizard.step4Title") }), renderCostTable(rec && rec.cost)];
    }

    function stepDoor() {
      var rec = best();
      var routes = (rec && rec.routes) || [];
      var wrong = renderWrongDoor(state.result);
      return [A.node("h2", { text: A.t("wizard.step5Title") })]
        .concat(routes.length ? routes.map(renderDoorRow) : [A.node("p", { className: "muted", text: A.t("match.doorNone") })])
        .concat(wrong ? [wrong] : []);
    }

    function stepPacket() {
      var box = A.node("div", { className: "wz-packet" }, [A.node("p", { className: "muted", text: A.t("common.loading") })]);
      var rec = best();
      var route = rec ? (rec.routes || [])[0] : null;
      if (!rec) { A.fill(box, [A.node("p", { className: "muted", text: A.t("match.none") })]); }
      else {
        API.packet(state.profile, rec.scheme.id, route ? route.partner.id : null, state.profile.amount_inr)
          .then(function (packet) {
            A.fill(box, [
              A.node("h3", { text: A.t("wizard.checklistTitle") }),
              A.node("ul", {}, (packet.checklist || []).map(function (item) {
                return A.node("li", { text: tx(item, "label") + (item.have ? " ✓" : "") });
              })),
              A.node("h3", { text: A.t("wizard.nextStepsTitle") }),
              A.node("ul", {}, listFor({ hi: packet.next_steps_hi, en: packet.next_steps_en }).map(function (text) {
                return A.node("li", { text: text });
              })),
              A.node("a", { className: "btn", href: packet.pm_suraj_url || "#", text: A.t("wizard.pmSuraj"), attrs: { target: "_blank", rel: "noopener" } }),
              A.node("button", { type: "button", className: "btn", text: A.t("match.printPacket"), onClick: function () { window.print(); } })
            ]);
          }, function (err) {
            A.warn("packet failed: " + err.message);
            A.fill(box, [A.node("p", { className: "error", text: A.t("wizard.packetError") })]);
          });
      }
      return [
        A.node("h2", { text: A.t("wizard.step6Title") }),
        box,
        A.node("a", { className: "btn btn-link", href: "login.html", text: A.t("wizard.createProfile") })
      ];
    }

    var STEPS = [stepSpeak, stepConfirm, stepMatch, stepCost, stepDoor, stepPacket];

    function render() {
      setProgress();
      var builder = STEPS[state.step - 1] || stepSpeak;
      A.fill(stepBox, builder());
    }

    function runRecommend() {
      return API.recommend(state.profile).then(function (result) {
        state.result = result;
        state.pending = [];
        writeSessionProfile(state.profile);
        return true;
      }, function (err) {
        var pending = err.status === 422 ? needsConfirmation(err) : null;
        if (pending) {
          state.pending = pending;
          A.toast(A.t("wizard.needAnswer", { field: A.t("field." + pending[0]) }));
          state.step = 2;
          render();
          return false;
        }
        A.warn("recommend failed: " + err.message);
        A.toast(errorText(err));
        return false;
      });
    }

    function advance() {
      if (state.step === 1) {
        var text = (state.text || "").trim();
        if (!text) { A.toast(A.t("wizard.emptyText")); return; }
        if (next) { next.disabled = true; next.textContent = A.t("wizard.extracting"); }
        API.extract(text, lang()).then(function (profile) {
          state.profile = profile || {};
          state.profile.activity_text = state.profile.activity_text || text;
          state.pending = state.profile.needs_confirmation || [];
          writeSessionProfile(state.profile);
          state.step = 2;
          render();
        }, function (err) {
          A.warn("extract failed: " + err.message);
          A.toast(err.status === 0 ? A.t("err.network") : A.t("wizard.extractError"));
        }).then(function () {
          if (next) { next.disabled = false; }
          setProgress();
        });
        return;
      }
      if (state.step === 2) {
        var unanswered = (state.pending || []).filter(function (key) {
          var value = state.profile[key];
          return value === null || value === undefined || value === "";
        });
        if (unanswered.length) {
          A.toast(A.t("wizard.needAnswer", { field: A.t("field." + unanswered[0]) }));
          return;
        }
        state.profile.needs_confirmation = [];
        if (next) { next.disabled = true; }
        runRecommend().then(function (ok) {
          if (next) { next.disabled = false; }
          if (ok) { state.step = 3; render(); }
        });
        return;
      }
      if (state.step < WIZARD_STEPS) { state.step += 1; render(); }
    }

    if (next) { next.addEventListener("click", function (e) { e.preventDefault(); advance(); }); }
    if (back) {
      back.addEventListener("click", function (e) {
        e.preventDefault();
        if (state.step > 1) { state.step -= 1; render(); }
      });
    }
    onLangChange(render);
    render();

    /* Names for the near-miss card on step 3. The wizard needs no login and
     * must survive this failing, so a rejection only logs. */
    return API.getCatalogue().then(function (entries) {
      (entries || []).forEach(function (entry) { catalogueNames[entry.id] = entry; });
      render();
    }, function (err) {
      A.warn("scheme names for the wizard's near-miss card are unavailable: " + err.message);
    });
  }

  /* =============================================================== ROUTER */

  var ROUTES = {
    "index.html": initHome,
    "": initHome,
    "login.html": initLogin,
    "profile.html": initProfile,
    "schemes.html": initSchemes,
    "scheme.html": initScheme,
    "match.html": initMatch,
    "assistant.html": initAssistant,
    "wizard.html": initWizard
  };

  function boot() {
    try { A.init(); } catch (e) { A.warn("shared header failed: " + e.message); }
    var page = (location.pathname.split("/").pop() || "index.html").toLowerCase();
    var run = ROUTES[page];
    if (!run) { A.warn("no page logic is registered for " + page); return; }
    try {
      var done = run();
      if (done && done.catch) { done.catch(function (err) { A.warn(page + " failed: " + (err && err.message)); }); }
    } catch (e) {
      A.warn(page + " threw: " + e.message);
    }
  }

  if (document.readyState === "loading") { document.addEventListener("DOMContentLoaded", boot); }
  else { boot(); }
})();
