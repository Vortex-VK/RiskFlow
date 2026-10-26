from pathlib import Path

from fastapi import FastAPI
from starlette.responses import FileResponse, Response
from starlette.staticfiles import StaticFiles
from starlette.types import Scope


class HashedAssets(StaticFiles):
    async def get_response(self, path: str, scope: Scope) -> Response:
        response = await super().get_response(path, scope)
        if response.status_code == 200:
            response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
        return response


def mount_frontend(app: FastAPI, directory: Path) -> None:
    index = directory / "index.html"
    if not index.is_file():
        raise RuntimeError("Build the frontend before enabling production asset serving.")
    app.mount("/assets", HashedAssets(directory=directory / "assets"), name="assets")

    @app.get("/", include_in_schema=False)
    def home() -> FileResponse:
        return FileResponse(index, headers={"Cache-Control": "no-cache"})
