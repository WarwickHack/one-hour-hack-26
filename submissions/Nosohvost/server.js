// GRAMMAR vs THE DEADLINE: a tiny static server plus a /whack endpoint that calls the official whack().
// Run it with `node server.js` and open http://localhost:3000
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

process.chdir(__dirname); // whack() writes its "whack" file into this folder
const { whack } = require("./whack.js");

const PUB = path.join(__dirname, "public");
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".css": "text/css",
  ".png": "image/png",
};
const PORT = Number(process.env.PORT) || 3000;

http
  .createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname === "/whack") {
      const words = whack();
      res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
      return res.end(JSON.stringify(words));
    }
    const rel = url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname).replace(/^\/+/, "");
    const file = path.normalize(path.join(PUB, rel));
    if (!file.startsWith(PUB)) {
      res.writeHead(403);
      return res.end();
    }
    fs.readFile(file, (err, data) => {
      if (err) {
        res.writeHead(404);
        return res.end("not found");
      }
      res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream" });
      res.end(data);
    });
  })
  .listen(PORT, () => console.log(`GRAMMAR vs THE DEADLINE -> http://localhost:${PORT}`));
