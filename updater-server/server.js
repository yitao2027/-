const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");

const PORT = process.env.PORT || 3000;
const RELEASES_DIR = "/opt/shaoziclaw-updater/releases";

// MIME types
const MIME_TYPES = {
  ".json": "application/json",
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".svg": "image/svg+xml",
  ".dmg": "application/octet-stream",
  ".exe": "application/octet-stream",
};

const server = http.createServer((req, res) => {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);

  // Route: /latest/{target}/{current_version}
  const match = req.url.match(/^\/latest\/([^/]+)\/([^/]+)$/);
  if (match) {
    const target = match[1];
    const currentVersion = match[2];

    try {
      const dataFile = path.join(RELEASES_DIR, "latest.json");
      if (!fs.existsSync(dataFile)) {
        res.writeHead(503, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "No release data available" }));
        return;
      }
      const releaseData = JSON.parse(fs.readFileSync(dataFile, "utf8"));

      // Same version = no update needed
      if (releaseData.version === currentVersion) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({}));
        return;
      }

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(releaseData));
    } catch (e) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // Static files from releases dir (DMG, EXE etc.)
  const filePath = path.join(RELEASES_DIR, req.url.split("?")[0]);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${path.basename(filePath)}"`
    });
    fs.createReadStream(filePath).pipe(res);
    return;
  }

  // Health check
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", hostname: os.hostname(), time: new Date().toISOString() }));
    return;
  }

  // Default: latest.json
  if (req.url === "/" || req.url === "/latest.json") {
    const dataFile = path.join(RELEASES_DIR, "latest.json");
    if (fs.existsSync(dataFile)) {
      res.writeHead(200, { "Content-Type": "application/json" });
      fs.createReadStream(dataFile).pipe(res);
    } else {
      res.writeHead(503, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "No release data available. Upload a DMG/EXE first." }));
    }
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 ShaoziClaw Update Server running on port ${PORT}`);
});
