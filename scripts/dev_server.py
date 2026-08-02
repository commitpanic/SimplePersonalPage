#!/usr/bin/env python3
"""Simple local dev server with LLOTA proxy endpoint.

Usage:
  python scripts/dev_server.py --port 8080
"""

from __future__ import annotations

import argparse
import json
import urllib.error
import urllib.request
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

LLOTA_URL = "https://llota.app/api/public/spots"


class DevHandler(SimpleHTTPRequestHandler):
    def do_GET(self) -> None:
        if self.path == "/api/llota-spots":
            self._handle_llota_proxy()
            return
        super().do_GET()

    def _handle_llota_proxy(self) -> None:
        req = urllib.request.Request(
            LLOTA_URL,
            headers={
                "User-Agent": "SimplePersonalPage-DevServer/1.0",
                "Accept": "application/json",
            },
            method="GET",
        )

        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                body = resp.read()
                self.send_response(HTTPStatus.OK)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Cache-Control", "no-store")
                self.end_headers()
                self.wfile.write(body)
        except urllib.error.HTTPError as err:
            self._send_error_json(err.code, f"LLOTA upstream HTTP error: {err.code}")
        except Exception as err:  # noqa: BLE001
            self._send_error_json(HTTPStatus.BAD_GATEWAY, f"LLOTA proxy error: {err}")

    def _send_error_json(self, status: int, message: str) -> None:
        payload = json.dumps({"error": message}).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(payload)


def main() -> None:
    parser = argparse.ArgumentParser(description="Local static server with LLOTA proxy")
    parser.add_argument("--port", type=int, default=8080, help="Port to listen on")
    args = parser.parse_args()

    server = ThreadingHTTPServer(("", args.port), DevHandler)
    host = f"http://localhost:{args.port}"
    print(f"Serving {host} with /api/llota-spots proxy")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
