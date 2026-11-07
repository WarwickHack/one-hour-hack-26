const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { whack } = require("./whack.js");
const scores = require("./scores.js");

const PORT = process.env.PORT || 3026;
const PUBLIC = path.join(__dirname, "public");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png" };

function json(res, data) {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

http.createServer(async (req, res) => {
  if (req.url === "/api/whack") {
    const words = whack();
    return json(res, { words, file: fs.readFileSync("whack", "utf8") });
  }
  if (req.url === "/api/scores" && req.method === "GET") return json(res, await scores.top());
  if (req.url === "/api/scores" && req.method === "POST") {
    let raw = "";
    for await (const chunk of req) raw += chunk;
    return json(res, await scores.submit(JSON.parse(raw || "{}")));
  }
  const rel = req.url === "/" ? "index.html" : req.url.split("?")[0].slice(1);
  const target = path.join(PUBLIC, rel);
  if (!target.startsWith(PUBLIC) || !fs.existsSync(target)) {
    res.writeHead(404);
    return res.end("not found");
  }
  res.writeHead(200, { "Content-Type": TYPES[path.extname(target)] || "text/plain" });
  fs.createReadStream(target).pipe(res);
}).listen(PORT, () => console.log(`Warwick Quack Soc Social: http://localhost:${PORT}`));
