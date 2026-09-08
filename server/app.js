"use strict";

const express = require("express");
const ejs = require("ejs");
const config = require("./config");
const api = require("./routes/api");
const aiBridge = require("./routes/ai-bridge");
const pageRoutes = require("./routes/pages");

const app = express();

app.disable("x-powered-by");
app.set("view engine", "ejs");
/* The eight current pages are valid EJS templates: they use no server-side
 * syntax today, but Express renders them so the teammate owns normal routes
 * and can introduce small EJS values/partials later without a visual rewrite.
 * The second directory retains the migration-only error pages. */
app.set("views", [config.legacyWebDir, config.viewsDir]);
app.engine("html", ejs.renderFile);

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

/* New EJS assets belong here. Legacy assets remain read-only until their EJS
 * replacements are complete, so the verified portal is always available for
 * parity comparisons during this controlled migration. */
app.use("/assets", express.static(config.publicDir));
app.use("/uploads", express.static(config.uploadsDir));

api.init();
app.use(api);
app.use(aiBridge);

app.get("/meta/health", (_req, res) => {
  const deterministic = api.health();
  res.json({
    ...deterministic,
    service: "express",
    ai_service: config.aiBaseUrl
  });
});

app.use(pageRoutes);

/* CSS and browser JavaScript from the verified UI are shared during the EJS
 * migration. `index: false` ensures page routes above render EJS rather than
 * Express returning an HTML file as an opaque static response. */
app.use(express.static(config.legacyWebDir, { index: false }));

app.use((req, res) => {
  res.status(404).render("not-found", { path: req.path });
});

if (require.main === module) {
  app.listen(config.port, "127.0.0.1", () => {
    console.log(`Sahaay Express portal listening at http://127.0.0.1:${config.port}`);
  });
}

module.exports = app;
