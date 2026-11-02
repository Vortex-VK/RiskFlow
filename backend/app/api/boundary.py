import asyncio
import logging
from time import perf_counter
from uuid import uuid4

from starlette.datastructures import Headers, MutableHeaders
from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Message, Receive, Scope, Send

MAX_BODY_BYTES = 16 * 1024 * 1024
MAX_BODY_RECEIVE_SECONDS = 30
logger = logging.getLogger("uvicorn.error")
RESPONSE_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
}


class RequestLog:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        started = perf_counter()
        status = 500

        async def record_response(message: Message) -> None:
            nonlocal status
            if message["type"] == "http.response.start":
                status = message["status"]
                request_id = scope.get("state", {}).get("request_id", "")
                headers = MutableHeaders(scope=message)
                headers["X-Request-ID"] = request_id
                headers.update(RESPONSE_HEADERS)
                if scope["path"].startswith("/api/"):
                    headers["Cache-Control"] = "no-store"
            await send(message)

        try:
            await self.app(scope, receive, record_response)
        finally:
            logger.info(
                "request_id=%s method=%s status=%d duration_ms=%.2f",
                scope.get("state", {}).get("request_id", ""),
                scope["method"],
                status,
                (perf_counter() - started) * 1000,
            )


def error_response(
    status: int,
    code: str,
    message: str,
    request_id: str,
    issues: list[dict[str, object]] | None = None,
) -> JSONResponse:
    return JSONResponse(
        status_code=status,
        headers={**RESPONSE_HEADERS, "Cache-Control": "no-store"},
        content={
            "error": {
                "code": code,
                "message": message,
                "issues": issues or [],
                "requestId": request_id,
            }
        },
    )


class RequestBoundary:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        request_id = scope.setdefault("state", {}).setdefault("request_id", str(uuid4()))
        if scope["method"] not in {"POST", "PUT", "PATCH"}:
            await self.app(scope, receive, send)
            return
        headers = Headers(scope=scope)
        if headers.get("content-encoding", "identity").lower() != "identity":
            await error_response(
                415,
                "unsupported_encoding",
                "Compressed request bodies are not supported.",
                request_id,
            )(scope, receive, send)
            return
        if headers.get("content-type", "").split(";")[0].strip().lower() != "application/json":
            await error_response(
                415, "unsupported_media_type", "Send an application/json request body.", request_id
            )(scope, receive, send)
            return
        body = bytearray()
        try:
            async with asyncio.timeout(MAX_BODY_RECEIVE_SECONDS):
                while True:
                    message = await receive()
                    if message["type"] == "http.disconnect":
                        return
                    chunk = message.get("body", b"")
                    if len(body) + len(chunk) > MAX_BODY_BYTES:
                        await error_response(
                            413,
                            "payload_too_large",
                            "Request bodies must not exceed "
                            f"{MAX_BODY_BYTES // (1024 * 1024)} MiB.",
                            request_id,
                        )(scope, receive, send)
                        return
                    body.extend(chunk)
                    if not message.get("more_body", False):
                        break
        except TimeoutError:
            await error_response(
                408, "request_timeout", "The request body took too long to arrive.", request_id
            )(scope, receive, send)
            return
        consumed = False

        async def replay_body() -> Message:
            nonlocal consumed
            if consumed:
                return await receive()
            consumed = True
            return {"type": "http.request", "body": bytes(body), "more_body": False}

        await self.app(scope, replay_body, send)
