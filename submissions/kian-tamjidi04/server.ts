// Whackschach server. Run from this folder: bun server.ts, then open http://localhost:3000
import { readFileSync } from "node:fs";
import { whack } from "./whack.ts";
import { CATEGORIES, CATEGORY_OF, NEUTRAL } from "./categories.ts";

// whack() writes ./whack relative to the working directory; keep it next to this file.
process.chdir(import.meta.dir);

const MAX_BODY = 2_000_000;
const ALLOWED_HOSTS = new Set(["localhost:3000", "127.0.0.1:3000"]);
const ALLOWED_ORIGINS = new Set([...ALLOWED_HOSTS].map(h => `http://${h}`));
let lastRead = 0;

const server = Bun.serve({
  hostname: "127.0.0.1",
  port: 3000,
  async fetch(req) {
    // Fixed allowlist, not anything derived from the request, so DNS rebinding can't get in.
    if (!ALLOWED_HOSTS.has(req.headers.get("host") ?? "")) return new Response("Forbidden", { status: 403 });
    const { pathname } = new URL(req.url);

    if (pathname === "/" && req.method === "GET") {
      return new Response(Bun.file("index.html"), { headers: { "content-type": "text/html; charset=utf-8" } });
    }

    if (pathname === "/categories" && req.method === "GET") {
      return Response.json({ categories: CATEGORIES, neutral: NEUTRAL, vision: Boolean(KEY) });
    }

    if (pathname === "/whack" && req.method === "GET") {
      const words = whack();
      const file = readFileSync("whack", "utf8");
      const unknown = [...new Set(words.filter(w => !(w in CATEGORY_OF)))];
      if (unknown.length) console.warn(`[whackschach] no category for: ${unknown.join(", ")} (drawn in neutral ink)`);
      return Response.json({ words, file });
    }

    if (pathname === "/read" && req.method === "POST") {
      // Spends the API key, so only this page may call it: JSON only (forces a CORS preflight
      // from other sites), same origin, bounded size, at most one reading a second.
      const sameOrigin = ALLOWED_ORIGINS.has(req.headers.get("origin") ?? "");
      const json = req.headers.get("content-type")?.startsWith("application/json");
      const size = Number(req.headers.get("content-length") ?? 0);
      if (!sameOrigin || !json || size > MAX_BODY) return Response.json({ reading: null }, { status: 403 });
      if (Date.now() - lastRead < 1000) return Response.json({ reading: null }, { status: 429 });
      lastRead = Date.now();
      const body = (await req.json().catch(() => ({}))) as { png?: string };
      if (String(body.png ?? "").length > MAX_BODY) return Response.json({ reading: null }, { status: 413 });
      const reading = await readBlot(String(body.png ?? ""));
      return Response.json({ reading });
    }

    return new Response("Not found", { status: 404 });
  },
});

console.log(`Whackschach on ${server.url}  (examiner: ${KEY ? "Claude vision" : "stand-in"})`);
