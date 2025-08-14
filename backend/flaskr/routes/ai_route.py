"""Authenticated proxy to the local FAQ model. No employee records leave this API."""

import json
from urllib.error import HTTPError, URLError
from urllib.request import ProxyHandler, Request, build_opener

from flask import Blueprint, abort, current_app
from flask_jwt_extended import jwt_required

from flaskr.hr_helpers import current_user, payload, string

bp = Blueprint("ai", __name__)
# Internal model calls must not pass through an inherited corporate HTTP proxy.
urlopen = build_opener(ProxyHandler({})).open


def request_ai(path, data=None):
    body = json.dumps(data).encode("utf-8") if data is not None else None
    request = Request(
        f"{current_app.config['AI_URL']}{path}",
        data=body,
        headers={"Content-Type": "application/json"},
    )
    try:
        with urlopen(request, timeout=current_app.config["AI_TIMEOUT"]) as response:
            result = json.loads(response.read(256 * 1024))
            if not isinstance(result, dict):
                raise ValueError("Expected a JSON object from the FAQ service")
            return result
    except (HTTPError, URLError, TimeoutError, OSError, ValueError):
        abort(
            503,
            description="The local FAQ assistant is unavailable. Restart the project launcher and try again.",
        )


@bp.get("/status")
@jwt_required()
def status():
    current_user()
    return request_ai("/health")


@bp.post("/chat")
@jwt_required()
def chat():
    current_user()
    data = payload({"message"})
    message = string(data, "message", required=True, maximum=2000)
    return request_ai("/chat", {"message": message})
