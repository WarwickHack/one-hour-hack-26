const scores = require("../scores.js");

module.exports = async (req, res) => {
  if (req.method === "POST") return res.json(await scores.submit(req.body || {}));
  res.json(await scores.top());
};
