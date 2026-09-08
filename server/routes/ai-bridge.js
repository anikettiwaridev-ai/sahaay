"use strict";

/*
 * The browser always talks to Express. These three routes are the only place
 * the conventional Node application knows that a local Python process exists.
 * Keeping this boundary narrow prevents Whisper/Ollama concerns leaking into
 * ordinary auth, catalogue, matching or EJS page code.
 */

const express = require("express");
const config = require("../config");

const router = express.Router();

function aiUrl(path, query = "") {
  return `${config.aiBaseUrl}${path}${query}`;
}

async function forwardJson(req, res, path) {
  try {
    const upstream = await fetch(aiUrl(path), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(req.body || {})
    });
    const bytes = Buffer.from(await upstream.arrayBuffer());
    res.status(upstream.status);
    if (upstream.headers.get("content-type")) {
      res.set("content-type", upstream.headers.get("content-type"));
    }
    res.send(bytes);
  } catch (err) {
    res.status(503).json({ detail: `local AI service is unavailable: ${err.message}` });
  }
}

router.post("/assistant/ask", (req, res) => forwardJson(req, res, "/assistant/ask"));
router.post("/intake/extract", (req, res) => forwardJson(req, res, "/intake/extract"));

router.post("/intake/transcribe", async (req, res) => {
  try {
    const query = typeof req.query.lang === "string" ? `?lang=${encodeURIComponent(req.query.lang)}` : "";
    const headers = {};
    if (req.headers["content-type"]) headers["content-type"] = req.headers["content-type"];
    const upstream = await fetch(aiUrl("/intake/transcribe", query), {
      method: "POST",
      headers,
      body: req,
      duplex: "half"
    });
    const bytes = Buffer.from(await upstream.arrayBuffer());
    res.status(upstream.status);
    if (upstream.headers.get("content-type")) {
      res.set("content-type", upstream.headers.get("content-type"));
    }
    res.send(bytes);
  } catch (err) {
    res.status(503).json({ detail: `local AI service is unavailable: ${err.message}` });
  }
});

router.get("/meta/ai-health", async (_req, res) => {
  try {
    const upstream = await fetch(aiUrl("/meta/health"));
    const bytes = Buffer.from(await upstream.arrayBuffer());
    res.status(upstream.status).type(upstream.headers.get("content-type") || "application/json").send(bytes);
  } catch (err) {
    res.status(503).json({ ok: false, detail: `local AI service is unavailable: ${err.message}` });
  }
});

module.exports = router;
