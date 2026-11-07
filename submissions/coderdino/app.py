from flask import Flask, jsonify, render_template
from whack import whack

app = Flask(__name__)

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/wave")
def api_wave():
    whack()                       # mandatory unmodified call
    with open("whack", "r", encoding="utf-8") as f:
        words = [line.strip() for line in f if line.strip()]
    return jsonify({"words": words})

if __name__ == "__main__":
    app.run(debug=True, port=5000)