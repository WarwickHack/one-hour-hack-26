const fs = require("node:fs");
const { whack } = require("../whack.js");

// Vercel's filesystem is read-only except /tmp, and whack() writes ./whack.
module.exports = (req, res) => {
  process.chdir("/tmp");
  const words = whack();
  res.json({ words, file: fs.readFileSync("whack", "utf8") });
};
