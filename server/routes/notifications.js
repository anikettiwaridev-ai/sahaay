"use strict";
/**
 * The notification preview. Port of the notification half of
 * `backend/portal/routes.py`.
 *
 * The architecture is explicit that "the matching is real; delivery is a stub".
 *
 * So the message is not a written sample. The saved profile goes through the
 * same engine the match page calls, and the message quotes what came back -- the
 * scheme it ranked first and that scheme's own one-liner from the catalogue. If
 * the engine's answer changes, this changes with it. Only the sending is
 * missing, and the response says so in `delivery`.
 */

const express = require("express");

const catalogue = require("../services/catalogue-service");
const recommendEngine = require("../services/engine/recommend");
const store = require("../services/profile-store");
const { normaliseProfile, ProfileInvalid } = require("../services/profile-schema");
const { requireUser } = require("./auth");

const router = express.Router();

const NOTIFICATION = {
  en: "{name}: {n} NSFDC scheme(s) match your profile. Closest match — {scheme}. {one_line} Open Sahaay to see what it would cost and which office to walk into.",
  hi: "{name}: आपकी जानकारी से NSFDC की {n} योजना मेल खाती है। सबसे नज़दीक — {scheme}। {one_line} खर्च कितना होगा और किस दफ़्तर जाना है, यह देखने के लिए सहाय खोलें।",
};

const NO_MATCH = {
  en: "{name}: no NSFDC scheme matches your saved profile yet. We will message you when one does.",
  hi: "{name}: अभी आपकी जानकारी से NSFDC की कोई योजना मेल नहीं खाती। जैसे ही कोई मिलेगी, हम संदेश भेजेंगे।",
};

const fill = (template, values) =>
  template.replace(/\{(\w+)\}/g, (m, key) => (key in values ? String(values[key]) : m));

router.get("/notifications/preview", requireUser, (req, res) => {
  const profile = store.getProfile(req.user.username);
  const lang = profile.lang === "hi" || profile.lang === "en" ? profile.lang : "hi";
  const name = profile.name || req.user.display_name;
  const mobile = profile.mobile;

  if (!mobile) {
    res.json({
      channel: "whatsapp", to: null, message: null, delivery: "stub",
      note: "no mobile number on this profile, so nothing would be sent",
    });
    return;
  }

  let matched = [];
  let engineNote = "engine.recommend";
  try {
    const result = recommendEngine.recommend(normaliseProfile(profile), lang);
    matched = result.recommendations.map((r) => r.scheme.id);
  } catch (err) {
    if (err instanceof recommendEngine.ProfileUnconfirmed) {
      engineNote = `profile unconfirmed: ${err.fields.join(", ")}`;
    } else if (err instanceof ProfileInvalid) {
      engineNote = `saved profile failed validation: ${err.errors.map((e) => e.loc.join(".")).join(", ")}`;
    } else {
      // A preview must never be the thing that breaks the profile page.
      engineNote = `engine unavailable: ${err.name}`;
    }
  }

  let message;
  if (matched.length) {
    const entry = catalogue.detail(matched[0], lang);
    message = fill(NOTIFICATION[lang], {
      name,
      n: matched.length,
      scheme: lang === "hi" ? entry.name_hi : entry.name_en,
      one_line: entry[`one_line_${lang}`],
    });
  } else {
    message = fill(NO_MATCH[lang], { name });
  }

  res.json({
    channel: "whatsapp",
    to: String(mobile).replace(/\D/g, ""),
    message,
    delivery: "stub",
    matched_scheme_ids: matched,
    matched_by: engineNote,
    note: "ARCHITECTURE §7: the matching is real, delivery is not built",
  });
});

module.exports = router;
