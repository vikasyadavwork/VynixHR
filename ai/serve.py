"""Serve the local FAQ assistant. Keep this internal service on loopback."""

import argparse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import logging
import socket

from retriever import FAQAssistant, MODEL_PATH

MAX_BODY_BYTES = 16 * 1024


def create_server(host="127.0.0.1", port=5001, assistant=None):
    assistant = assistant or FAQAssistant()

    class Handler(BaseHTTPRequestHandler):
        server_version = "VynixHR-FAQ/1.0"

        def setup(self):
            super().setup()
            self.connection.settimeout(10)

        def send_json(self, status, payload):
            encoded = json.dumps(payload).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(encoded)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.end_headers()
            self.wfile.write(encoded)

        def do_GET(self):
            if self.path != "/health":
                return self.send_json(404, {"error": "Route not found"})
            return self.send_json(
                200,
                {
                    "status": "ok",
                    "service": "vynixhr-local-faq",
                    "model": assistant.model["algorithm"],
                    "faq_count": len(assistant.faqs),
                    "dataset_sha256": assistant.model["dataset_sha256"],
                    "policy_scope": "Fictional demo company policies only",
                },
            )

        def do_POST(self):
            if self.path != "/chat":
                return self.send_json(404, {"error": "Route not found"})
            if self.headers.get_content_type() != "application/json":
                return self.send_json(
                    415, {"error": "Content-Type must be application/json"}
                )
            if self.headers.get("Transfer-Encoding"):
                return self.send_json(
                    400, {"error": "Transfer-Encoding is not supported"}
                )
            try:
                length = int(self.headers.get("Content-Length", "0"))
            except ValueError:
                return self.send_json(400, {"error": "Invalid Content-Length"})
            if length <= 0 or length > MAX_BODY_BYTES:
                return self.send_json(
                    413, {"error": f"Request body must be 1-{MAX_BODY_BYTES} bytes"}
                )
            try:
                raw = self.rfile.read(length)
                if len(raw) != length:
                    return self.send_json(400, {"error": "Incomplete request body"})
                payload = json.loads(raw.decode("utf-8"))
                if not isinstance(payload, dict):
                    raise ValueError("Request body must be a JSON object")
                result = assistant.respond(payload.get("message"))
            except (UnicodeDecodeError, json.JSONDecodeError):
                return self.send_json(
                    400, {"error": "Request body must be valid UTF-8 JSON"}
                )
            except ValueError as error:
                return self.send_json(400, {"error": str(error)})
            except (TimeoutError, socket.timeout):
                return self.send_json(408, {"error": "Request timed out"})
            return self.send_json(200, result)

        def log_message(self, format_string, *args):
            # Log method/path/status only; do not log employee questions.
            logging.info("%s", format_string % args)

    server = ThreadingHTTPServer((host, port), Handler)
    server.daemon_threads = True
    return server


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=5001)
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
    if not MODEL_PATH.exists():
        parser.error("Model missing. Run python ai/train.py first.")
    try:
        server = create_server(args.host, args.port)
    except ValueError as error:
        parser.error(str(error))
    logging.info("Local FAQ service ready at http://%s:%s", args.host, args.port)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
