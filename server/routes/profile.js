"use strict";
/**
 * The saved profile and its photo. Port of the profile half of
 * `backend/portal/routes.py`.
 *
 * The profile is stored as the caller sent it. It is deliberately not validated
 * against the engine's StructuredProfile here: the contract's profile carries
 * `email`, `mobile` and `photo_url`, which that shape does not declare and would
 * silently drop. /recommend validates for itself.
 */

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const express = require("express");
const multer = require("multer");

const store = require("../services/profile-store");
const { requireUser } = require("./auth");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

router.get("/profile", requireUser, (req, res) => {
  res.json(store.getProfile(req.user.username));
});

router.put("/profile", requireUser, (req, res) => {
  const body = req.body;
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    res.status(422).json({
      detail: [{ loc: ["body"], msg: "expected a profile object", type: "type_error.dict" }],
    });
    return;
  }
  res.json({ ok: true, profile: store.saveProfile(req.user.username, body) });
});

const SAFE_SUFFIX = { ".jpg": ".jpg", ".jpeg": ".jpg", ".png": ".png", ".webp": ".webp" };

/**
 * Store the image and hand back the URL.
 *
 * The filename is generated, never taken from the upload: a name is the only
 * part of an upload that can reach the filesystem, so none of it does.
 */
router.post("/profile/photo", requireUser, upload.single("photo"), (req, res) => {
  if (!req.file) {
    res.status(400).json({ detail: 'no file field named "photo"' });
    return;
  }

  const suffix = SAFE_SUFFIX[path.extname(req.file.originalname || "").toLowerCase()];
  if (suffix === undefined) {
    res.status(400).json({ detail: "photo must be .jpg, .png or .webp" });
    return;
  }

  fs.mkdirSync(store.UPLOADS, { recursive: true });
  const name = `${req.user.username}-${crypto.randomBytes(4).toString("hex")}${suffix}`;
  fs.writeFileSync(path.join(store.UPLOADS, name), req.file.buffer);
  res.json({ photo_url: `/uploads/${name}` });
});

module.exports = router;
