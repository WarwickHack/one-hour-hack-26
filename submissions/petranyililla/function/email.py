import webbrowser
from urllib.parse import quote

def send_email(name, email, poem):
    subject = quote("A bedtime poem for you 🌙")
    body = quote(poem)

    url = f"mailto:{email}?subject={subject}&body={body}"
    webbrowser.open(url)