# The decks' local server (python3 evals/estonian-visuals/serve.py): as `python3 -m http.server 8123 --bind 127.0.0.1
# -d evals/estonian-visuals/out`, but every answer says no-store, so a reload always gets the pages as they are now
# (2026-11-20: pages inside talk.html stayed old in the browser's cache after a change). Research use only.
import functools, http.server, os
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out')
class NoStore(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()
http.server.ThreadingHTTPServer(('127.0.0.1', 8123), functools.partial(NoStore, directory=OUT)).serve_forever()
