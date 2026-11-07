"""WHACK-A-WHACK() launcher.

    python run.py

Calls whack() once to build game.html (a snapshot of words baked in), then serves it on
localhost. The game calls /whack at the start of every round, which calls the real whack()
again, so each round's moles are the words whack() just wrote.
"""
import json
import os
import threading
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HERE = os.path.dirname(os.path.abspath(__file__))
os.chdir(HERE)  # whack() writes its "whack" file into the current folder

from whack import whack  # noqa: E402  (unchanged copy of function/whack.py)

lock = threading.Lock()


def build_html() -> bytes:
    words = whack()
    with open("game_template.html", encoding="utf-8") as f:
        html = f.read().replace("/*WORDS*/[]", json.dumps(words))
    with open("game.html", "w", encoding="utf-8") as f:
        f.write(html)
    return html.encode("utf-8")


PAGE = build_html()


MEDIA = {".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp",
         ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".wav": "audio/wav"}


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        name = os.path.basename(self.path.split("?")[0])
        ext = os.path.splitext(name)[1].lower()
        if self.path.startswith("/whack"):
            with lock:
                body = json.dumps({"words": whack()}).encode()
            ctype = "application/json"
        elif ext in MEDIA:  # optional duck.png / chicken.png next to this script
            if not os.path.isfile(name):
                self.send_error(404)
                return
            with open(name, "rb") as f:
                body = f.read()
            ctype = MEDIA[ext]
        else:
            body, ctype = PAGE, "text/html; charset=utf-8"
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args):
        pass


try:
    server = ThreadingHTTPServer(("127.0.0.1", 8026), Handler)
except OSError:
    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)

url = f"http://127.0.0.1:{server.server_address[1]}/"
print(f"WHACK-A-WHACK() running at {url}  (Ctrl+C to stop)")
webbrowser.open(url)
try:
    server.serve_forever()
except KeyboardInterrupt:
    pass
