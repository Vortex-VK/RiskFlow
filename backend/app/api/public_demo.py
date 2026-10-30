"""Single-process admission limits for the anonymous public demo."""

import math
from collections import deque
from time import monotonic
from uuid import uuid4

from starlette.types import ASGIApp, Receive, Scope, Send

from app.api.boundary import error_response


class PublicDemo:
    """Reject excess work immediately; never queue unbounded model requests.

    Limits are global to one worker, independent of spoofable forwarding headers.
    Run one worker/instance; distributed deployments need a shared limiter.
    """

    def __init__(self, app: ASGIApp) -> None:
        self.app = app
        self.requests: deque[float] = deque()
        self.simulations: deque[float] = deque()
        self.processing = False

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        path = scope["path"].rstrip("/")
        request_id = scope.setdefault("state", {}).setdefault("request_id", str(uuid4()))
        if path == "/api/v2/datasets" or path.startswith("/api/v2/datasets/"):
            await error_response(
                404, "not_found", "Saved datasets are unavailable in this demo.", request_id
            )(scope, receive, send)
            return
        if scope["method"] not in {
            "POST",
            "PUT",
            "PATCH",
            "DELETE",
        }:
            await self.app(scope, receive, send)
            return

        now = monotonic()
        for window in (self.requests, self.simulations):
            while window and window[0] <= now - 60:
                window.popleft()
        simulation = (
            path in {"/api/v1/simulations", "/api/v1/explanations", "/api/v1/explanations/compare"}
            and scope["method"] == "POST"
        )
        retry_after = 0
        if len(self.requests) >= 60:
            retry_after = max(1, math.ceil(60 - (now - self.requests[0])))
        elif simulation and len(self.simulations) >= 20:
            retry_after = max(1, math.ceil(60 - (now - self.simulations[0])))
        elif self.processing:
            retry_after = 2
        if retry_after:
            response = error_response(
                429,
                "demo_busy",
                "The demo is busy. Please wait a moment and try again.",
                request_id,
            )
            response.headers["Retry-After"] = str(retry_after)
            response.headers["Cache-Control"] = "no-store"
            await response(scope, receive, send)
            return

        self.requests.append(now)
        # Admit before RequestBoundary buffers the body, including validation and
        # unknown routes. A per-minute budget alone does not bound live memory.
        self.processing = True
        if simulation:
            self.simulations.append(now)
        try:
            await self.app(scope, receive, send)
        finally:
            self.processing = False
