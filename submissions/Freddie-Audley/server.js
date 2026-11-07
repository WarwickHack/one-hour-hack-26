const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { whack } = require("./whack.js");

process.chdir(__dirname);

const port = Number(process.env.PORT || 4173);
const files = new Map([
  ["/", ["index.html", "text/html; charset=utf-8"]],
  ["/game.js", ["game.js", "text/javascript; charset=utf-8"]],
  ["/style.css", ["style.css", "text/css; charset=utf-8"]],
]);

const server = http.createServer((request, response) => {
  const resourceMatch = /^\/resources\/([a-z]+\.png)$/.exec(request.url || "");
  if (request.method === "GET" && resourceMatch) {
    fs.readFile(path.join(__dirname, "resources", resourceMatch[1]), (error, contents) => {
      if (error) {
        response.writeHead(error.code === "ENOENT" ? 404 : 500, {
          "Content-Type": "text/plain; charset=utf-8",
        });
        response.end(error.code === "ENOENT" ? "Not found" : "Could not load the image.");
        return;
      }

      response.writeHead(200, {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=3600",
      });
      response.end(contents);
    });
    return;
  }

  if (request.method === "POST" && request.url === "/api/round") {
    try {
      const words = whack();
      response.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      });
      response.end(JSON.stringify({ words }));
    } catch (error) {
      console.error("Could not start a round:", error);
      response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Could not start a round. Check the server output for details.");
    }
    return;
  }

  const file = files.get(request.url);
  if (request.method !== "GET" || !file) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }

  fs.readFile(path.join(__dirname, file[0]), (error, contents) => {
    if (error) {
      console.error(`Could not serve ${file[0]}:`, error);
      response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Could not load the game. Check the server output for details.");
      return;
    }

    response.writeHead(200, { "Content-Type": file[1] });
    response.end(contents);
  });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`WHACK a mole is ready at http://127.0.0.1:${port}`);
});
