"use strict";

const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");

module.exports = Object.freeze({
  rootDir: ROOT,
  port: Number(process.env.SAHAAY_PORT || 3000),
  aiBaseUrl: process.env.SAHAAY_AI_BASE_URL || "http://127.0.0.1:8001",
  dataDir: path.join(ROOT, "data"),
  uploadsDir: path.join(ROOT, "uploads"),
  legacyWebDir: path.join(ROOT, "web"),
  publicDir: path.join(__dirname, "public"),
  viewsDir: path.join(__dirname, "views")
});
